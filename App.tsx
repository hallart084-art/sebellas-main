import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, memo, lazy, Suspense } from 'react';

// Hooks
import { useLocalizationContext } from './contexts/LocalizationContext';
import { useSettings } from './hooks/useSettings';
import { useImageUploader } from './hooks/useImageUploader';
import { useVideoProcessor } from './hooks/useVideoProcessor';
import { readStoredProviderApiKeys, useGemini } from './hooks/useGemini';

// Auth
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';

// Hooks & Contexts
import { LANGUAGES } from './locales';

// Components
import InputArea from './components/InputArea';
import SettingsForm from './components/SettingsForm';
import GenerationControls from './components/GenerationControls';
import ResultsDisplay from './components/ResultsDisplay';
import ApiKeyModal from './components/ApiKeyModal';

// Types & Libs
import { GeneratedPromptSet, HistoryEntry, GenerationSettings, NotificationKind, NotificationTarget, SentNotificationItem, Folder } from './types';
import * as PromptBuilder from './lib/prompts';
import { sendNotification, listSentNotifications, updateSentNotification, deleteSentNotification } from './lib/notifications';
import { useNotifications } from './hooks/useNotifications';
import { generateModelContent, shouldRotateApiKeyOnError, isTransientEmptyResponseError } from './lib/apiClient';
import { MODEL_PROVIDER_LABELS, getModelProvider, isModelSupportedForMode } from './constants';
import type { ModelProvider } from './constants';

const LazyHistoryModal = lazy(() => import('./components/HistoryModal'));
const LazyJsonMinifierModal = lazy(() => import('./components/JsonMinifierModal'));
const LazyAdminPanel = lazy(() => import('./components/AdminPanel'));
const LazyNotificationInbox = lazy(() => import('./components/NotificationInbox'));

const hasStringValue = (value: unknown): value is string =>
 typeof value === 'string' && value.trim().length > 0;

const isRecord = (value: unknown): value is Record<string, any> =>
 Boolean(value) && typeof value === 'object' && !Array.isArray(value);



const humanSubjectTerms = /\b(person|people|human|man|woman|male|female|boy|girl|child|teen|teenager|adult|elderly|senior|model|worker|employee|doctor|nurse|teacher|student|artist|athlete|customer|mother|father|parent|grandmother|grandfather|bride|groom)\b/i;
const ancestryDescriptorTerms = /\b(ancestry|descent|ethnicity|ethnic|heritage|race|racial|asian|east asian|south asian|southeast asian|black|african|african-american|afro|white|european|latina|latino|latinx|hispanic|middle eastern|arab|north african|indigenous|native american|pacific islander|polynesian|melanesian|japanese|korean|chinese|vietnamese|thai|filipino|indian|pakistani|bangladeshi|nigerian|kenyan|ethiopian|ghanaian|mexican|brazilian|colombian|italian|french|german|scottish|irish|slavic|mixed)\b/i;

const promptTextIncludesHumanWithoutAncestry = (value: unknown): boolean => {
 if (typeof value === 'string') {
 return humanSubjectTerms.test(value) && !ancestryDescriptorTerms.test(value);
 }

 if (Array.isArray(value)) {
 return value.some(promptTextIncludesHumanWithoutAncestry);
 }

 if (isRecord(value)) {
 return Object.values(value).some(promptTextIncludesHumanWithoutAncestry);
 }

 return false;
};



const sanitizeHistoryEntryForStorage = (entry: HistoryEntry): HistoryEntry => ({
 ...entry,
 sets: entry.sets.map((set: any) => {
 const {
 thumbnailUrl,
 sourceFile,
 sourceId,
 objectUrl,
 file,
 data,
 base64,
 ...rest
 } = set;
 return rest;
 }),
});

const App: React.FC = () => {
 useEffect(() => {
 if ('scrollRestoration' in window.history) {
 window.history.scrollRestoration = 'manual';
 }
 }, []);

 const { t, uiLanguage, handleLanguageChange } = useLocalizationContext();
 const { currentUser, isAdmin, logout, isLoading: authLoading, logError } = useAuth();
 
 const settings = useSettings();
 const { uploadedImages, handleImageFiles, handleDeleteImage, isDraggingOverWindow: isDraggingImage, fileInputRef: imageFileInputRef, clearUploadedImages, error: imageUploaderError, clearError: clearImageUploaderError } = useImageUploader(settings.inputMode === 'image', t);
 const videoProcessor = useVideoProcessor(settings.inputMode === 'video', t);
 const { isProviderInitialized, apiKeys, apiStatus, handleSaveApiKeys, handleCheckProviderApiKey, parseApiError } = useGemini(t);
 const selectedModelProvider = getModelProvider(settings.selectedModel);
 const isSelectedProviderInitialized = isProviderInitialized(selectedModelProvider);
 const hasAnyProviderInitialized = Object.values(apiStatus).some(Boolean);

 const [generatedPromptSets, setGeneratedPromptSets] = useState<GeneratedPromptSet[]>([]);
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);
 const [retryingIds, setRetryingIds] = useState<Set<string | number>>(new Set());
 const [error, setError] = useState<string | null>(null);

 type ActiveView = 'generator' | 'history' | 'jsonminifier' | 'admin';
 const [activeView, setActiveView] = useState<ActiveView>(() => {
 if (typeof window === 'undefined') return 'generator';
 const stored = localStorage.getItem('appActiveView');
 return stored === 'history' || stored === 'jsonminifier' || stored === 'admin' || stored === 'generator'
 ? stored
 : 'generator';
 });
 const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState<boolean>(false);
 const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false); // default closed
 const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => {
 if (typeof window === 'undefined') return false;
 return window.innerWidth < 768;
 });
 const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
 const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
 if (typeof window !== 'undefined') {
 const stored = localStorage.getItem('isSidebarOpen');
 if (stored !== null) return stored === 'true';
 return window.innerWidth >= 768;
 }
 return true;
 });
 const [isNotificationInboxOpen, setIsNotificationInboxOpen] = useState<boolean>(false);
 const [hasLoadedNotificationInbox, setHasLoadedNotificationInbox] = useState<boolean>(false);
 
 const [history, setHistory] = useState<HistoryEntry[]>([]);
 const [folders, setFolders] = useState<Folder[]>([]);

 const generationIdRef = useRef<number>(0);
 const apiKeyIndexesRef = useRef<Record<ModelProvider, number>>({ google: 0, groq: 0, mistral: 0, openrouter: 0 });
 const wasMobileViewportRef = useRef<boolean>(isMobileViewport);
 const desktopSidebarPrefRef = useRef<boolean>(isSidebarOpen);
 const initialPageShowHandledRef = useRef<boolean>(false);
 const sidebarRef = useRef<HTMLElement>(null);
 const notificationTriggerRef = useRef<HTMLButtonElement>(null);
 const apiKeyTriggerRef = useRef<HTMLButtonElement>(null);
 const historyTriggerRef = useRef<HTMLButtonElement>(null);
 const jsonMinifierTriggerRef = useRef<HTMLButtonElement>(null);

 const totalSuccessfullyGeneratedPrompts = generatedPromptSets.reduce((acc, set) => acc + (set.hasError ? 0 : set.prompts.length), 0);
 const notifications = useNotifications(currentUser, isNotificationInboxOpen);

 const activeSidebarItem: 'generator' | 'history' | 'jsonminifier' | 'notifications' | 'admin' | 'apikey' =
 activeView === 'admin'
 ? 'admin'
 : isNotificationInboxOpen
 ? 'notifications'
 : isApiKeyModalOpen
 ? 'apikey'
 : activeView;
 const sidebarOpenForView = isMobileViewport ? isMobileSidebarOpen : isSidebarOpen;
 const sidebarWidthForView = isMobileViewport
 ? (isMobileSidebarOpen ? 250 : (desktopSidebarPrefRef.current ? 250 : 72))
 : (isSidebarOpen ? 250 : 72);
 const [shouldRenderSidebarCloseButton, setShouldRenderSidebarCloseButton] = useState<boolean>(sidebarOpenForView);

 useLayoutEffect(() => {
 if (authLoading || typeof window === 'undefined') return;

 if (!currentUser) {
 localStorage.removeItem('appActiveView');
 return;
 }

 if (activeView === 'admin' && !isAdmin) {
 localStorage.setItem('appActiveView', 'generator');
 setActiveView('generator');
 return;
 }

 localStorage.setItem('appActiveView', activeView);
 }, [activeView, authLoading, currentUser, isAdmin]);

 useEffect(() => {
 if (typeof document === 'undefined') return;

 document.body.classList.toggle('view-generator', activeView === 'generator' && Boolean(currentUser));

 return () => {
 document.body.classList.remove('view-generator');
 };
 }, [activeView, currentUser]);

 useLayoutEffect(() => {
 if (authLoading || typeof window === 'undefined') return;

 if (!currentUser) {
 document.body.classList.remove('layout-booting');
 return;
 }

 document.body.classList.add('layout-booting');

 const container = document.getElementById('app-container');
 if (container) {
 if (!isMobileViewport && isSidebarOpen) {
 container.classList.add('sidebar-active');
 } else {
 container.classList.remove('sidebar-active');
 }
 }

 // Set nilai awal CSS custom property sidebar-w
 const initWidth = isMobileViewport ? 0 : (isSidebarOpen ? 250 : 72);
 document.documentElement.style.setProperty('--sidebar-w', `${initWidth}px`);

 let outerFrame = 0;
 let innerFrame = 0;

 outerFrame = window.requestAnimationFrame(() => {
 innerFrame = window.requestAnimationFrame(() => {
 document.body.classList.remove('layout-booting');
 });
 });

 return () => {
 window.cancelAnimationFrame(outerFrame);
 window.cancelAnimationFrame(innerFrame);
 };
 }, [authLoading, currentUser]);

 useEffect(() => {
 if (isNotificationInboxOpen) {
 setHasLoadedNotificationInbox(true);
 }
 }, [isNotificationInboxOpen]);

 useEffect(() => {
 if (typeof window === 'undefined' || typeof document === 'undefined') return;

 let restoreTimer: number | null = null;

 const lockMotionDuringTabRestore = () => {
 if (document.visibilityState === 'hidden') return;

 document.body.classList.add('is-tab-restoring');

 if (restoreTimer !== null) {
 window.clearTimeout(restoreTimer);
 }

 restoreTimer = window.setTimeout(() => {
 document.body.classList.remove('is-tab-restoring');
 restoreTimer = null;
 }, 360);
 };

 const handleVisibilityChange = () => {
 if (document.visibilityState === 'visible') {
 lockMotionDuringTabRestore();
 }
 };

 const handlePageShow = () => {
 if (!initialPageShowHandledRef.current) {
 initialPageShowHandledRef.current = true;
 return;
 }
 lockMotionDuringTabRestore();
 };

 document.addEventListener('visibilitychange', handleVisibilityChange);
 window.addEventListener('focus', lockMotionDuringTabRestore);
 window.addEventListener('pageshow', handlePageShow);

 return () => {
 document.removeEventListener('visibilitychange', handleVisibilityChange);
 window.removeEventListener('focus', lockMotionDuringTabRestore);
 window.removeEventListener('pageshow', handlePageShow);

 if (restoreTimer !== null) {
 window.clearTimeout(restoreTimer);
 }

 document.body.classList.remove('is-tab-restoring');
 };
 }, []);

 const openSidebar = useCallback(() => {
 if (isMobileViewport) {
 setIsMobileSidebarOpen(true);
 return;
 }
 setIsSidebarOpen(true);
 }, [isMobileViewport]);

 const closeSidebar = useCallback(() => {
 document.body.classList.remove('layout-booting', 'is-tab-restoring', 'is-viewport-resizing');
 if (isMobileViewport) {
 setIsMobileSidebarOpen(false);
 return;
 }
 setIsSidebarOpen(false);
 }, [isMobileViewport]);

 
 useEffect(() => {
 if (typeof window === 'undefined') return;

 const mediaQuery = window.matchMedia('(max-width: 767px)');
 const syncViewport = (isMobile: boolean) => setIsMobileViewport(isMobile);

 syncViewport(mediaQuery.matches);

 const onChange = (event: MediaQueryListEvent) => {
 syncViewport(event.matches);
 };

 if (typeof mediaQuery.addEventListener === 'function') {
 mediaQuery.addEventListener('change', onChange);
 return () => mediaQuery.removeEventListener('change', onChange);
 }

 mediaQuery.addListener(onChange);
 return () => mediaQuery.removeListener(onChange);
 }, []);

 useEffect(() => {
 if (typeof window === 'undefined') return;

 let resizeTimer: number | null = null;

 const handleResize = () => {
 document.body.classList.add('is-viewport-resizing');
 if (resizeTimer !== null) {
 window.clearTimeout(resizeTimer);
 }
 resizeTimer = window.setTimeout(() => {
 document.body.classList.remove('is-viewport-resizing');
 resizeTimer = null;
 }, 140);
 };

 window.addEventListener('resize', handleResize, { passive: true });

 return () => {
 window.removeEventListener('resize', handleResize);
 if (resizeTimer !== null) {
 window.clearTimeout(resizeTimer);
 }
 document.body.classList.remove('is-viewport-resizing');
 };
 }, []);

 useEffect(() => {
 if (!isMobileViewport) {
 desktopSidebarPrefRef.current = isSidebarOpen;
 }
 }, [isSidebarOpen, isMobileViewport]);

 useEffect(() => {
 const wasMobile = wasMobileViewportRef.current;
 if (wasMobile === isMobileViewport) return;

 if (isMobileViewport) {
 setIsMobileSidebarOpen(false);
 } else {
 setIsMobileSidebarOpen(false);
 if (isSidebarOpen !== desktopSidebarPrefRef.current) {
 setIsSidebarOpen(desktopSidebarPrefRef.current);
 }
 }

 wasMobileViewportRef.current = isMobileViewport;
 }, [isMobileViewport, isSidebarOpen]);

 useEffect(() => {
 if (!isMobileViewport) {
 localStorage.setItem('isSidebarOpen', String(isSidebarOpen));
 }
 const container = document.getElementById('app-container');
 if (container) {
 if (!isMobileViewport && isSidebarOpen) {
 container.classList.add('sidebar-active');
 } else {
 container.classList.remove('sidebar-active');
 }
 }
 // Sync CSS custom property untuk panel notif agar sinkron dengan CSS transition sidebar
 const targetWidth = isMobileViewport ? 0 : (isSidebarOpen ? 250 : 72);
 document.documentElement.style.setProperty('--sidebar-w', `${targetWidth}px`);
 }, [isSidebarOpen, isMobileViewport]);

 useEffect(() => {
 if (typeof window === 'undefined') return;

 if (sidebarOpenForView) {
 setShouldRenderSidebarCloseButton(true);
 return;
 }

 const hideTimer = window.setTimeout(() => {
 setShouldRenderSidebarCloseButton(false);
 }, 220);

 return () => window.clearTimeout(hideTimer);
 }, [sidebarOpenForView]);

 useEffect(() => {
 handleSaveApiKeys(readStoredProviderApiKeys());
 try {
 const savedHistoryRaw = localStorage.getItem('prompt_generation_history');
 if (savedHistoryRaw) {
 const parsedHistory: any[] = JSON.parse(savedHistoryRaw);
 const migratedHistory: HistoryEntry[] = parsedHistory.map(entry => sanitizeHistoryEntryForStorage({
 ...entry,
 settings: { ...entry.settings, inputMode: entry.settings.inputMode ?? (entry.settings.useImageInput ? 'image' : 'text'), videoNames: entry.settings.videoNames ?? (entry.settings.videoName ? [entry.settings.videoName] : []) },
 sets: entry.sets.map((set: any) => ({ ...set, id: set.id || crypto.randomUUID() }))
 }));
 setHistory(migratedHistory);
 localStorage.setItem('prompt_generation_history', JSON.stringify(migratedHistory.slice(0, 50)));
 }
 } catch (e) {
 console.error("Failed to parse from localStorage", e);
 }
 
 try {
 const savedFoldersRaw = localStorage.getItem('prompt_generation_folders');
 if (savedFoldersRaw) {
 const parsedFolders: Folder[] = JSON.parse(savedFoldersRaw);
 setFolders(parsedFolders);
 }
 } catch (e) {
 console.error("Failed to parse folders from localStorage", e);
 }
 }, [handleSaveApiKeys]);

 const saveHistory = useCallback((updatedHistory: HistoryEntry[]) => {
 const historyToSave = updatedHistory.slice(0, 50).map(sanitizeHistoryEntryForStorage);
 
 try {
 localStorage.setItem('prompt_generation_history', JSON.stringify(historyToSave));
 setHistory(historyToSave); 
 } catch (e) {
 console.error("Could not save history to localStorage:", e);
 // Do not setError here, as it masks successful generation.
 }
 }, []);

 const saveFolders = useCallback((updatedFolders: Folder[]) => {
 try {
 localStorage.setItem('prompt_generation_folders', JSON.stringify(updatedFolders));
 setFolders(updatedFolders);
 } catch (e) {
 console.error("Could not save folders to localStorage:", e);
 }
 }, []);

 const reserveNextApiKeyStartIndex = useCallback((provider: ModelProvider): number | null => {
 const providerKeys = apiKeys[provider] ?? [];
 if (providerKeys.length === 0) return null;

 const currentIndex = apiKeyIndexesRef.current[provider] % providerKeys.length;
 apiKeyIndexesRef.current[provider] = (currentIndex + 1) % providerKeys.length;
 return currentIndex;
 }, [apiKeys]);

 const processAndGenerate = useCallback(async (
 placeholder: GeneratedPromptSet,
 promptBuilder: () => { contents: any; config: any; }
 ): Promise<GeneratedPromptSet> => {
 try {
 const provider = getModelProvider(settings.selectedModel);
 const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
 if (!isProviderInitialized(provider) || providerKeys.length === 0) throw new Error(`No ${provider} API key found. Please add your API key in Settings → API Keys.`);
 if (!isModelSupportedForMode(settings.selectedModel, settings.inputMode)) {
 throw new Error(`${settings.selectedModel} does not support ${settings.inputMode} mode.`);
 }
 const { contents, config } = promptBuilder();

 let responseText = '';
 let lastGenerationError: unknown = null;
 const startKeyIndex = reserveNextApiKeyStartIndex(provider);
 if (startKeyIndex === null) throw new Error(`No ${provider} API key found. Please add your API key in Settings → API Keys.`);
 const isXml = settings.promptQualityOption === 'xml';

 for (let attempt = 0; attempt < providerKeys.length; attempt += 1) {
 const selectedApiKey = providerKeys[(startKeyIndex + attempt) % providerKeys.length];

 try {
 responseText = await generateModelContent({
 model: settings.selectedModel,
 contents,
 config,
 apiKey: selectedApiKey,
 isXmlQuality: isXml,
 });
 lastGenerationError = null;
 break;
 } catch (requestError) {
 lastGenerationError = requestError;
 const canTryAnotherKey = (shouldRotateApiKeyOnError(requestError) || isTransientEmptyResponseError(requestError)) && attempt < providerKeys.length - 1;
 if (!canTryAnotherKey) {
 throw requestError;
 }
 console.warn(`Retrying ${provider} request with the next API key after a key-specific error.`, requestError);
 }
 }

 if (lastGenerationError) throw lastGenerationError;
 
 if (!responseText) throw new Error(t('errorApiResponseNoValidText'));

  let parsedPrompts: (string | Record<string, any>)[] = [];
  const s = responseText.trim();
  let extractedArray: any[] = [];

    /**
     * Bersihkan teks mentah yang berisi syntax JSON array agar user tidak melihat
     * karakter seperti [, ], \", \\n. Ekstraksikan konten teks murni.
     * Tidak menggunakan regex — parsing karakter per karakter.
     */
    const cleanRawFallbackText = (raw: string): string => {
      const t = raw.trim();
      // Jika teks dimulai dengan [ dan berisi ", coba ekstrak string pertama di dalamnya.
      if (t.startsWith('[')) {
        let i = 1; // lewati '['
        // Lewati whitespace
        while (i < t.length && (t[i] === ' ' || t[i] === '\n' || t[i] === '\r' || t[i] === '\t')) i++;
        if (i < t.length && t[i] === '"') {
          // Temukan konten string: kumpulkan karakter dari quote pembuka sampai akhir
          i++; // lewati '"'
          let content = '';
          let esc = false;
          while (i < t.length) {
            if (esc) {
              // Handle escape sequences: \n → newline, \t → tab, lainnya → karakter asli
              if (t[i] === 'n') content += '\n';
              else if (t[i] === 't') content += '\t';
              else if (t[i] === 'r') content += '\r';
              else content += t[i];
              esc = false;
              i++;
              continue;
            }
            if (t[i] === '\\') { esc = true; i++; continue; }
            if (t[i] === '"') break; // akhir string (atau terpotong)
            content += t[i];
            i++;
          }
          if (content.trim().length > 0) return content.trim();
        }
      }
      // Bukan JSON array — kembalikan teks apa adanya.
      return t;
    };

  try {
    // apiClient sudah menghapus code fence dan memvalidasi JSON tidak terpotong.
    // Fallback bertingkat: (1) parse langsung, (2) repair literal control chars dalam string
    // (beberapa model mengembalikan \n mentah di dalam string JSON — bukan JSON valid), (3) cari bracket terluar.

    const tryParseToArray = (candidate: any): any[] => {
      if (Array.isArray(candidate)) return candidate;
      // String tunggal dari AI — bungkus ke array agar tidak ditolak.
      if (typeof candidate === 'string' && candidate.trim().length > 0) return [candidate];
      if (candidate && typeof candidate === 'object') {
        // Cek semua nilai object — lebih robust dari hardcoded key
        const firstArr = Object.values(candidate).find(v => Array.isArray(v));
        if (firstArr) return firstArr as any[];
        const arr = (candidate as any).prompts || (candidate as any).items || (candidate as any).results;
        if (Array.isArray(arr)) return arr;
        // Jika object memiliki nilai string (misal single footage object tanpa array),
        // periksa apakah ini object bermakna (punya >2 key) dan bungkus sebagai [object].
        const values = Object.values(candidate);
        if (values.length > 2 && values.some(v => typeof v === 'string' && (v as string).length > 20)) {
          return [candidate];
        }
      }
      return [];
    };

    /**
     * Perbaiki JSON yang mengandung literal newline/tab/CR di dalam string JSON.
     * Beberapa model AI mengembalikan string multi-baris tanpa escaping yang membuat
     * JSON menjadi tidak valid. Fungsi ini bersifat universal — diterapkan ke semua provider.
     * Scan karakter per karakter agar hanya karakter di dalam string literal yang diubah.
     */
    const repairJsonStrings = (text: string): string => {
      let result = '';
      let inString = false;
      let escaped = false;
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { result += ch; escaped = false; continue; }
        if (ch === '\\' && inString) { result += ch; escaped = true; continue; }
        if (ch === '"') { inString = !inString; result += ch; continue; }
        if (inString) {
          if (ch === '\n') { result += '\\n'; continue; }
          if (ch === '\r') { result += '\\r'; continue; }
          if (ch === '\t') { result += '\\t'; continue; }
        }
        result += ch;
      }
      return result;
    };

    // Langkah 1: coba parse langsung.
    try {
      extractedArray = tryParseToArray(JSON.parse(s));
    } catch {
      // Langkah 2: repair literal control chars di dalam string (berlaku untuk semua provider/model)
      try {
        extractedArray = tryParseToArray(JSON.parse(repairJsonStrings(s)));
      } catch {
        // Langkah 3 (fallback): cari bracket terluar, coba dengan dan tanpa repair.
        outer: for (const [open, close] of [['[', ']'], ['{', '}']]) {
          const start = s.indexOf(open);
          if (start === -1) continue;
          let end = s.lastIndexOf(close);
          while (end > start) {
            const sub = s.substring(start, end + 1);
            try {
              extractedArray = tryParseToArray(JSON.parse(sub));
              break;
            } catch {
              try {
                extractedArray = tryParseToArray(JSON.parse(repairJsonStrings(sub)));
                break;
              } catch { /* lanjut geser end */ }
            }
            end = s.lastIndexOf(close, end - 1);
          }
          if (extractedArray.length > 0) break outer;
        }
      }
    }

    // Langkah 4 (recovery): perbaiki JSON array yang terpotong.
    // Jika AI memulai JSON array tapi terpotong di tengah (misal: '["prompt text...'),
    // coba tutup JSON secara otomatis tanpa regex.
    if (extractedArray.length === 0 && s.indexOf('[') !== -1) {
      const arrStart = s.indexOf('[');
      const partial = s.substring(arrStart);
      // Coba berbagai kombinasi penutup, dari paling spesifik ke paling umum.
      const repairs = [
        partial + '"]',      // tutup string terbuka + tutup array
        partial + '"}]',     // tutup string + object + array
        partial + '"}}]',    // tutup string + 2 nested objects + array
        partial + '"}}}]',   // tutup string + 3 nested objects + array
        partial + '", ""]',  // tutup string + tambah elemen kosong + array (edge case)
        partial + '}]',      // tutup object terbuka + tutup array
        partial + '}}]',     // tutup 2 nested objects + array
        partial + ']',       // tutup array saja (elemen terakhir sudah lengkap)
        partial + '"]]}',    // tutup string + inner array + outer object (wrapped response)
      ];
      for (const candidate of repairs) {
        try {
          extractedArray = tryParseToArray(JSON.parse(candidate));
          if (extractedArray.length > 0) {
            console.warn('[processAndGenerate] Berhasil memperbaiki JSON array terpotong dengan menutup bracket.');
            break;
          }
        } catch { /* coba perbaikan berikutnya */ }
        try {
          extractedArray = tryParseToArray(JSON.parse(repairJsonStrings(candidate)));
          if (extractedArray.length > 0) {
            console.warn('[processAndGenerate] Berhasil memperbaiki JSON array terpotong (dengan repair strings).');
            break;
          }
        } catch { /* coba perbaikan berikutnya */ }
      }
      // Jika repair di atas gagal, coba potong di elemen terakhir yang lengkap.
      if (extractedArray.length === 0) {
        let lastComma = -1;
        let inStr = false;
        let esc = false;
        for (let j = 1; j < partial.length; j++) {
          if (esc) { esc = false; continue; }
          if (partial[j] === '\\' && inStr) { esc = true; continue; }
          if (partial[j] === '"') { inStr = !inStr; continue; }
          if (!inStr && partial[j] === ',') lastComma = j;
        }
        if (lastComma > 0) {
          const trimmed = partial.substring(0, lastComma) + ']';
          try {
            extractedArray = tryParseToArray(JSON.parse(trimmed));
            if (extractedArray.length > 0) {
              console.warn('[processAndGenerate] Berhasil memperbaiki JSON array terpotong dengan memotong elemen terakhir yang tidak lengkap.');
            }
          } catch {
            try {
              extractedArray = tryParseToArray(JSON.parse(repairJsonStrings(trimmed)));
              if (extractedArray.length > 0) {
                console.warn('[processAndGenerate] Berhasil memperbaiki JSON array terpotong (potong + repair strings).');
              }
            } catch { /* semua repair gagal */ }
          }
        }
      }
    }

    // Langkah 5 (fallback terakhir): gunakan teks mentah sebagai prompt tunggal.
    // Ini menangani kasus di mana AI mengembalikan plain text alih-alih JSON array.
    // Jika teks berisi syntax JSON array (["...]), bersihkan agar user tidak melihat JSON mentah.
    if (extractedArray.length === 0 && s.length > 0) {
      console.warn('[processAndGenerate] JSON parse gagal, menggunakan response teks mentah sebagai prompt tunggal.');
      extractedArray = [cleanRawFallbackText(s)];
    }
  } catch (e) {
    // JSON parse melempar exception — gunakan teks mentah jika tersedia.
    if (s.length > 0) {
      console.warn('[processAndGenerate] JSON parse exception, menggunakan response teks mentah sebagai prompt tunggal.', e);
      extractedArray = [cleanRawFallbackText(s)];
    } else {
      throw new Error(t('errorApiResponseNotExpectedFormat', { displayName: placeholder.originalConcept, responseText: responseText.slice(0, 100) }));
    }
  }

  // Flat() dan slice() di luar try/catch agar bug internal tidak tersamar sebagai format error.
  if (Array.isArray(extractedArray[0])) {
    extractedArray = extractedArray.flat();
  }
  parsedPrompts = extractedArray.slice(0, settings.numPrompts);

  // Normalisasi prompt: beberapa model mengembalikan object (misal {"prompt": "text"})
  // alih-alih string langsung di dalam array. Untuk semua style KECUALI footage/video
  // (yang memang menggunakan format object), ekstrak teks dari object.
  const isFootageMode = settings.styleOption === 'footage' || settings.inputMode === 'video';
  if (!isFootageMode) {
    parsedPrompts = parsedPrompts.map(item => {
      // Sudah string → kembalikan langsung.
      if (typeof item === 'string') {
        const t = item.trim();
        // Cek apakah string ini berisi JSON object (misal: '{"prompt": "text"}')
        // Gunakan t.trimEnd() agar multiline JSON (trailing whitespace/newline) tetap terdeteksi.
        const trimmedT = t.trimEnd();
        if (trimmedT.startsWith('{') && trimmedT.endsWith('}')) {
          try {
            const parsed = JSON.parse(trimmedT);
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
              const strs = Object.values(parsed).filter((v): v is string => typeof v === 'string' && v.length > 0);
              if (strs.length > 0) return strs.reduce((a, b) => a.length >= b.length ? a : b);
            }
          } catch { /* bukan JSON, kembalikan string asli */ }
        }
        // Cek apakah string ini berisi JSON array (misal: '["<Subject>...')
        if (t.startsWith('[')) {
          return cleanRawFallbackText(t);
        }
        return item;
      }
      // Object → ekstrak string terpanjang sebagai prompt text.
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const strs = Object.values(item).filter((v): v is string => typeof v === 'string' && v.length > 0);
        if (strs.length > 0) return strs.reduce((a, b) => a.length >= b.length ? a : b);
        // Object tanpa string value — cek nested objects (misal footage-like structure).
        const allStrings: string[] = [];
        const collectStrings = (obj: any) => {
          for (const val of Object.values(obj)) {
            if (typeof val === 'string' && val.length > 0) allStrings.push(val);
            else if (val && typeof val === 'object' && !Array.isArray(val)) collectStrings(val);
          }
        };
        collectStrings(item);
        if (allStrings.length > 0) return allStrings.join(', ');
      }
      // Fallback: jika object tidak menghasilkan string apapun, kembalikan string kosong
      // agar raw JSON tidak bocor ke UI (lebih baik prompt kosong dari pada "{\"prompt\":\"...\"}" tampil).
      return '';
    });
  } else {
    // Footage/video mode: object adalah format yang diinginkan, hanya log warning jika format tidak sesuai.
    const hasIncomplete = parsedPrompts.some(p => typeof p === 'string' || !isRecord(p));
    if (hasIncomplete) {
      console.warn('[processAndGenerate] Beberapa footage prompt tidak dalam format object JSON yang lengkap. Hasil tetap ditampilkan.');
    }
  }

  // Bersihkan bracket artifact dari template placeholder.
  // AI kadang mengisi placeholder [main subject] tapi tetap mempertahankan [ ] di output.
  // Contoh: "[A stylized face] single continuous line..." → "A stylized face single continuous line..."
  // Hanya berlaku untuk string (bukan footage object).
  parsedPrompts = parsedPrompts.map(item => {
    if (typeof item !== 'string') return item;
    let s = item.trim();
    // Hapus bracket pembuka di awal jika ada. 
    // Cek: dimulai [ tapi BUKAN JSON array (tidak dimulai [" atau [{ ).
    if (s.length > 2 && s[0] === '[' && s[1] !== '"' && s[1] !== '{' && s[1] !== '[') {
      // Cari ] penutup yang sesuai — bisa di tengah kalimat.
      const closingIdx = s.indexOf(']');
      if (closingIdx > 0) {
        // Hapus [ dan ] — gabungkan konten di dalam bracket dengan sisa teks setelahnya.
        s = s.substring(1, closingIdx) + s.substring(closingIdx + 1);
        s = s.trim();
      }
    }
    // Juga cek jika SELURUH string dibungkus [ ... ] (bracket menyeluruh).
    if (s.length > 2 && s[0] === '[' && s[s.length - 1] === ']' && s[1] !== '"') {
      s = s.substring(1, s.length - 1).trim();
    }
    return s;
  });

 if (parsedPrompts.some(promptTextIncludesHumanWithoutAncestry)) {
 console.warn("Generated prompts still contain a human subject without an ancestry descriptor after model self-check.");
 }



 if (parsedPrompts.length > 0) {
 return { ...placeholder, prompts: parsedPrompts, hasError: false };
 } else {
 throw new Error(t('errorApiResponseNoValidText'));
 }
 } catch (err) {
 const errorMessage = parseApiError(err);
 const providerLabel = MODEL_PROVIDER_LABELS[getModelProvider(settings.selectedModel)];
 const errorMessageWithProvider = `[${providerLabel}] ${errorMessage}`;
 
 console.error(t('errorGeneratingPromptsForConceptConsole', { displayName: placeholder.originalConcept }), err);
 const errorPrompts = [t('errorFailedToGeneratePromptsApiError', { displayName: placeholder.originalConcept, errorMessage: errorMessageWithProvider })];
 
 logError(errorMessageWithProvider, settings.selectedModel, String(err), settings.styleOption);
 
 return { ...placeholder, prompts: errorPrompts, hasError: true };
 }
 }, [apiKeys, reserveNextApiKeyStartIndex, isProviderInitialized, settings.selectedModel, settings.inputMode, settings.styleOption, settings.numPrompts, t, parseApiError, logError]);

 type GenerationJob = () => Promise<GeneratedPromptSet>;
 type GenerationTask = { placeholders: GeneratedPromptSet[], jobs: GenerationJob[] };

 const waitForBatchDelay = (seconds: number): Promise<void> => {
 if (seconds <= 0) return Promise.resolve();
 return new Promise(resolve => window.setTimeout(resolve, seconds * 1000));
 };

 const fileToBase64 = (file: File): Promise<string> => {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = () => resolve((reader.result as string).split(',')[1]);
 reader.onerror = error => reject(error);
 });
 };

 const generateForTextMode = useCallback((isQuick: boolean) => {
 const concepts = settings.conceptsInput.split(/[,;]/).map(c => c.trim()).filter(Boolean);
 if (concepts.length === 0) {
 setError(t('errorNoValidConceptsToProcess'));
 return { placeholders: [], jobs: [] };
 }
 const placeholders = concepts.map(concept => ({
 id: crypto.randomUUID(), originalConcept: concept, prompts: [], hasError: false, inputMode: 'text' as const,
 }));
 const jobs = concepts.map((concept, index) =>
 () => processAndGenerate(placeholders[index], () => PromptBuilder.buildTextPrompt(concept, settings, isQuick))
 );
 return { placeholders, jobs };
 }, [settings, processAndGenerate, t]);
 
 const generateForImageMode = useCallback((isQuick: boolean) => {
 if (uploadedImages.length === 0) {
 setError(t('errorNoImageUploaded'));
 return { placeholders: [], jobs: [] };
 }
 const placeholders = uploadedImages.map(image => ({
 id: crypto.randomUUID(),
 originalConcept: image.name,
 prompts: [],
 hasError: false,
 inputMode: 'image' as const,
 sourceId: image.id,
 sourceFile: image.file,
 thumbnailUrl: image.objectUrl, // Use objectUrl for immediate display, but it won't be saved to history
 }));
 const jobs = uploadedImages.map((image, index) => async () => {
 const base64Data = await fileToBase64(image.file);
 return processAndGenerate(placeholders[index], () => PromptBuilder.buildImagePrompt({ data: base64Data, mimeType: image.type }, settings, isQuick));
 });
 return { placeholders, jobs };
 }, [uploadedImages, settings, processAndGenerate, t]);

 const videoToBase64 = (file: File): Promise<{data: string; mimeType: string}> => {
 return new Promise((resolve, reject) => {
 const reader = new FileReader();
 reader.readAsDataURL(file);
 reader.onload = () => {
 const result = reader.result as string;
 const base64Data = result.split(',')[1];
 resolve({ data: base64Data, mimeType: file.type });
 };
 reader.onerror = error => reject(error);
 });
 };

 const generateForVideoMode = useCallback(async (isQuick: boolean) => {
 if (videoProcessor.uploadedVideos.length === 0) {
 setError(t('errorNoVideoUploaded'));
 return { placeholders: [], jobs: [] };
 }
 const placeholders = videoProcessor.uploadedVideos.map(video => ({
 id: crypto.randomUUID(), originalConcept: video.name, prompts: [], hasError: false, inputMode: 'video' as const, sourceId: video.id, sourceFile: video.file,
 }));
 
 const jobs = videoProcessor.uploadedVideos.map((video, index) => async () => {
 const placeholder = placeholders[index];
 try {
 if (!video.file) throw new Error(t('errorLoadingVideoUrl'));
 const videoData = await videoToBase64(video.file);
 return processAndGenerate(placeholder, () => PromptBuilder.buildVideoPrompt(videoData, settings, isQuick));
 } catch (err) {
 const errorMessage = (err instanceof Error) ? err.message : String(err);
 console.error(`Error processing video "${video.name}":`, err);
 const errorPrompts = [`Failed to generate prompts for video "${video.name}" due to processing error: ${errorMessage}`];
 return { ...placeholder, prompts: errorPrompts, hasError: true };
 }
 });
 return { placeholders, jobs };
 }, [videoProcessor.uploadedVideos, settings, processAndGenerate, t]);

 const retryFailedSet = useCallback(async (failedSet: GeneratedPromptSet): Promise<GeneratedPromptSet> => {
 const retryMode = failedSet.inputMode ?? settings.inputMode;
 const retryPlaceholder: GeneratedPromptSet = {
 ...failedSet,
 prompts: [],
 hasError: false,
 };

 if (retryMode === 'text') {
 return processAndGenerate(
 retryPlaceholder,
 () => PromptBuilder.buildTextPrompt(failedSet.originalConcept, settings, false)
 );
 }

 if (retryMode === 'image') {
 const image = uploadedImages.find(item =>
 item.id === failedSet.sourceId ||
 item.name === failedSet.originalConcept ||
 item.objectUrl === failedSet.thumbnailUrl
 );
 const sourceFile = failedSet.sourceFile ?? image?.file;
 if (!sourceFile) {
 return {
 ...failedSet,
 prompts: [t('errorRetrySourceMissing')],
 hasError: true,
 inputMode: 'image',
 };
 }

 const base64Data = await fileToBase64(sourceFile);
 return processAndGenerate(
 {
 ...retryPlaceholder,
 sourceId: image?.id ?? failedSet.sourceId,
 sourceFile,
 thumbnailUrl: image?.objectUrl ?? failedSet.thumbnailUrl,
 inputMode: 'image',
 },
 () => PromptBuilder.buildImagePrompt({ data: base64Data, mimeType: sourceFile.type }, settings, false)
 );
 }

 const video = videoProcessor.uploadedVideos.find(item =>
 item.id === failedSet.sourceId ||
 item.name === failedSet.originalConcept
 );
 const sourceFile = failedSet.sourceFile ?? video?.file;
 if (!sourceFile) {
 return {
 ...failedSet,
 prompts: [t('errorRetrySourceMissing')],
 hasError: true,
 inputMode: 'video',
 };
 }

 const videoData = await videoToBase64(sourceFile);
 return processAndGenerate(
 { ...retryPlaceholder, sourceId: video?.id ?? failedSet.sourceId, sourceFile, inputMode: 'video' },
 () => PromptBuilder.buildVideoPrompt(videoData, settings, false)
 );
 }, [settings, processAndGenerate, uploadedImages, videoProcessor.uploadedVideos, t]);

 const handleRetryFailedSet = useCallback(async (failedSet: GeneratedPromptSet) => {
 if (!failedSet.hasError || isLoading || isRetryingAll || retryingIds.has(failedSet.id)) return;
 setRetryingIds(prev => new Set(prev).add(failedSet.id));
 setError(null);

 try {
 const retriedSet = await retryFailedSet(failedSet);
 setGeneratedPromptSets(prev => {
 if (retriedSet.hasError) {
 return prev.map(set => set.id === failedSet.id ? retriedSet : set);
 }
 return [...prev.filter(set => set.id !== failedSet.id), retriedSet];
 });
 if (retriedSet.hasError) {
 setError(t('errorSomePromptsFailed'));
 }
 } catch (err) {
 const errorMessage = parseApiError(err);
 const retriedSet = {
 ...failedSet,
 prompts: [t('errorFailedToGeneratePromptsApiError', { displayName: failedSet.originalConcept, errorMessage })],
 hasError: true,
 };
 setGeneratedPromptSets(prev => prev.map(set => set.id === failedSet.id ? retriedSet : set));
 setError(t('errorSomePromptsFailed'));
 } finally {
 setRetryingIds(prev => {
 const next = new Set(prev);
 next.delete(failedSet.id);
 return next;
 });
 }
 }, [isLoading, isRetryingAll, retryingIds, retryFailedSet, parseApiError, t]);

 const handleRetryAllFailedSets = useCallback(async () => {
    const failedSets = generatedPromptSets.filter(set => set.hasError);
    if (failedSets.length === 0 || isLoading || isRetryingAll || retryingIds.size > 0) return;

    const currentGenerationId = ++generationIdRef.current;
    setIsRetryingAll(true);
    setError(null);

    let hasAnyRetryFailed = false;
    const workerCount = Math.max(1, Math.min(50, settings.workerCount || 1));
    const batchDelaySeconds = Math.max(0, Math.min(300, settings.batchDelaySeconds || 0));

    for (let startIndex = 0; startIndex < failedSets.length; startIndex += workerCount) {
      const batch = failedSets.slice(startIndex, startIndex + workerCount);
      const batchIds = batch.map(set => set.id);
      
      setRetryingIds(prev => new Set([...prev, ...batchIds]));

      const batchResults = await Promise.all(batch.map(async (failedSet) => {
        try {
          return await retryFailedSet(failedSet);
        } catch (err) {
          const errorMessage = parseApiError(err);
          return {
            ...failedSet,
            prompts: [t('errorFailedToGeneratePromptsApiError', { displayName: failedSet.originalConcept, errorMessage })],
            hasError: true,
          };
        }
      }));

      if (generationIdRef.current !== currentGenerationId) return;

      if (batchResults.some(set => set.hasError)) {
        hasAnyRetryFailed = true;
      }

      setGeneratedPromptSets(prev => {
        const batchIdsSet = new Set(batchResults.map(set => set.id));
        const untouchedSets = prev.filter(set => !batchIdsSet.has(set.id));
        const successfulRetries = batchResults.filter(set => !set.hasError);
        const failedRetries = batchResults.filter(set => set.hasError);
        return [...untouchedSets, ...successfulRetries, ...failedRetries];
      });

      setRetryingIds(prev => {
        const next = new Set(prev);
        batchIds.forEach(id => next.delete(id));
        return next;
      });

      const hasMoreBatches = startIndex + workerCount < failedSets.length;
      if (hasMoreBatches && batchDelaySeconds > 0) {
        await waitForBatchDelay(batchDelaySeconds);
        if (generationIdRef.current !== currentGenerationId) return;
      }
    }

    if (generationIdRef.current !== currentGenerationId) return;

    if (hasAnyRetryFailed) {
      setError(t('errorSomePromptsFailed'));
    }

    setIsRetryingAll(false);
  }, [generatedPromptSets, isLoading, isRetryingAll, retryingIds, retryFailedSet, settings.workerCount, settings.batchDelaySeconds, parseApiError, t]);

 const handleGeneratePrompts = useCallback(async (isQuick: boolean = false) => {
 if (settings.numPrompts <= 0) { setError(t('errorNumPromptsPositive')); return; }
 if (isLoading || isRetryingAll || retryingIds.size > 0) return;
 if (!isProviderInitialized(getModelProvider(settings.selectedModel))) {
 const providerLabel = MODEL_PROVIDER_LABELS[getModelProvider(settings.selectedModel)];
 setError(`Please add your ${providerLabel} API key before generating.`);
 return;
 }
 if (!isModelSupportedForMode(settings.selectedModel, settings.inputMode)) {
 setError(`${settings.selectedModel} does not support ${settings.inputMode} mode.`);
 return;
 }

 // Validation for Custom style
 if (settings.styleOption === 'custom' && !settings.customTemplate.trim()) {
 setError(t('errorCustomTemplateRequired'));
 return;
 }
 
 const currentGenerationId = ++generationIdRef.current;
 setIsLoading(true);
 setError(null);

 let generationTask: GenerationTask | undefined;

 switch (settings.inputMode) {
 case 'text': generationTask = generateForTextMode(isQuick); break;
 case 'image': generationTask = generateForImageMode(isQuick); break;
 case 'video': generationTask = await generateForVideoMode(isQuick); break;
 }
 
 if (!generationTask || generationTask.jobs.length === 0) {
 setIsLoading(false);
 return;
 }

 const finalSets: GeneratedPromptSet[] = [];
 const workerCount = Math.max(1, Math.min(50, settings.workerCount || 1));
 const batchDelaySeconds = Math.max(0, Math.min(300, settings.batchDelaySeconds || 0));

 for (let startIndex = 0; startIndex < generationTask.jobs.length; startIndex += workerCount) {
 const batch = generationTask.jobs.slice(startIndex, startIndex + workerCount);
 const batchStartedAt = Date.now();
 
 const batchResults = await Promise.all(batch.map(async job => {
 const result = await job();
 // Update state immediately as each job finishes
 if (generationIdRef.current === currentGenerationId) {
 setGeneratedPromptSets(prev => [...prev, result]);
 }
 return result;
 }));
 
 finalSets.push(...batchResults);

 if (generationIdRef.current !== currentGenerationId) return;

 const hasMoreBatches = startIndex + workerCount < generationTask.jobs.length;
 if (hasMoreBatches && batchDelaySeconds > 0) {
 await waitForBatchDelay(batchDelaySeconds);
 if (generationIdRef.current !== currentGenerationId) return;
 }
 }
 
 if (generationIdRef.current !== currentGenerationId) return;
 
    if (finalSets.some(s => s.hasError)) {
      setError(t('errorSomePromptsFailed'));
    }

 setIsLoading(false);

 if (finalSets.some(s => !s.hasError && s.prompts.length > 0)) {
 const currentSettings: GenerationSettings = {
 ...settings,
 conceptsInput: settings.inputMode === 'text' ? settings.conceptsInput : '',
 imageNames: settings.inputMode === 'image' ? uploadedImages.map(img => img.name) : [],
 videoNames: settings.inputMode === 'video' ? videoProcessor.uploadedVideos.map(v => v.name) : [],
 };
 saveHistory([{ id: Date.now(), timestamp: Date.now(), settings: currentSettings, sets: finalSets, folderId: settings.targetFolderId || null }, ...history]);
 }
  }, [settings, uploadedImages, videoProcessor.uploadedVideos, saveHistory, history, t, isProviderInitialized, generateForTextMode, generateForImageMode, generateForVideoMode, isLoading, isRetryingAll, retryingIds]);
 
 const formatPromptsForExport = useCallback((promptsToExport?: (string | Record<string, any>)[]): string => {
 const allPrompts = promptsToExport || generatedPromptSets.filter(set => !set.hasError && set.prompts.length > 0).flatMap(set => set.prompts);
 if (allPrompts.length === 0) return '';

 const objectPrompts = allPrompts.map(prompt => {
 if (typeof prompt === 'object' && prompt !== null) return prompt;
 if (typeof prompt !== 'string') return null;

 try {
 const parsed = JSON.parse(prompt);
 return isRecord(parsed) ? parsed : null;
 } catch {
 return null;
 }
 });

 if (objectPrompts.every(isRecord)) {
 return objectPrompts.map(p => JSON.stringify(p, null, 2)).join('\n\n');
 }

 // Output prompts are separated by --- divider for XML only, otherwise \n\n
 const isXmlFormat = settings.promptQualityOption === 'xml' && (settings.styleOption === 'photographic' || settings.styleOption === 'sameAsReference');
 const separator = isXmlFormat ? '\n---\n' : '\n\n';

 return allPrompts.map((p, idx) => {
 let strPrompt = (typeof p === 'object' && p !== null) ? JSON.stringify(p, null, 2) : String(p);
 return strPrompt;
 }).join(separator) + separator;
 }, [generatedPromptSets, settings.promptQualityOption, settings.styleOption]);

 const handleClearAllResults = useCallback(() => {
 setGeneratedPromptSets([]);
 setError(null);
 }, []);

 const handleClearUploadedImagesCompletely = useCallback(() => {
 clearUploadedImages();
 setGeneratedPromptSets(prev => prev.map(set => {
 if (set.inputMode !== 'image') return set;
 const { sourceFile, thumbnailUrl, ...rest } = set;
 return rest;
 }));
 }, [clearUploadedImages]);

 const handleClearUploadedVideosCompletely = useCallback(() => {
 videoProcessor.clearAllVideos();
 setGeneratedPromptSets(prev => prev.map(set => {
 if (set.inputMode !== 'video') return set;
 const { sourceFile, ...rest } = set;
 return rest;
 }));
 }, [videoProcessor.clearAllVideos]);
 
 const handleDeleteHistoryEntry = useCallback((id: number) => saveHistory(history.filter(entry => entry.id !== id)), [history, saveHistory]);
 const handleClearHistory = useCallback(() => saveHistory([]), [saveHistory]);
 const handleNewPrompt = useCallback(() => {
 settings.setConceptsInput('');
 handleClearUploadedImagesCompletely();
 handleClearUploadedVideosCompletely();
 setGeneratedPromptSets([]);
 setError(null);
 }, [settings, handleClearUploadedImagesCompletely, handleClearUploadedVideosCompletely, setGeneratedPromptSets, setError]);

 const isDraggingOver = isDraggingImage || videoProcessor.isDraggingOverWindow;

 const getSessionToken = useCallback((): string | null => {
 if (currentUser?.sessionToken) return currentUser.sessionToken;
 try {
 const raw = localStorage.getItem('auth_session');
 if (!raw || !currentUser) return null;
 const parsed = JSON.parse(raw) as { username?: string; sessionToken?: string };
 if ((parsed.username || '').toLowerCase() !== currentUser.username.toLowerCase()) return null;
 return parsed.sessionToken || null;
 } catch {
 return null;
 }
 }, [currentUser]);

 const handleSendNotification = useCallback(
 async (payload: {
 title: string;
 message: string;
 target: NotificationTarget;
 recipientUsername?: string;
 kind: NotificationKind;
 }): Promise<{ success: boolean; message: string }> => {
 if (!currentUser || !isAdmin) return { success: false, message: 'Akses ditolak.' };
 const sessionToken = getSessionToken();
 if (!sessionToken) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

 const result = await sendNotification({
 senderUsername: currentUser.username,
 senderSessionToken: sessionToken,
 title: payload.title,
 message: payload.message,
 target: payload.target,
 recipientUsername: payload.recipientUsername,
 kind: payload.kind,
 });
 if (!result.success) {
 return { success: false, message: result.error || 'Gagal mengirim notifikasi.' };
 }
 const targetLabel = payload.target === 'all' ? 'semua user aktif' : payload.recipientUsername || 'user tujuan';
 return { success: true, message: `Notifikasi terkirim ke ${targetLabel} (${result.insertedCount}).` };
 },
 [currentUser, isAdmin, getSessionToken]
 );

 const handleListSentNotifications = useCallback(async (): Promise<{
 success: boolean;
 message?: string;
 items: SentNotificationItem[];
 }> => {
 if (!currentUser || !isAdmin) return { success: false, message: 'Akses ditolak.', items: [] };
 const sessionToken = getSessionToken();
 if (!sessionToken) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.', items: [] };

 try {
 const items = await listSentNotifications(currentUser.username, sessionToken, 40);
 return { success: true, items };
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Gagal memuat notifikasi terkirim.';
 return { success: false, message, items: [] };
 }
 }, [currentUser, isAdmin, getSessionToken]);

 const handleUpdateSentNotification = useCallback(
 async (payload: { dispatchId: string; title: string; message: string; kind: NotificationKind }): Promise<{ success: boolean; message: string }> => {
 if (!currentUser || !isAdmin) return { success: false, message: 'Akses ditolak.' };
 const sessionToken = getSessionToken();
 if (!sessionToken) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

 const result = await updateSentNotification({
 senderUsername: currentUser.username,
 senderSessionToken: sessionToken,
 dispatchId: payload.dispatchId,
 title: payload.title,
 message: payload.message,
 kind: payload.kind,
 });
 if (!result.success) {
 return { success: false, message: result.error || 'Gagal memperbarui notifikasi.' };
 }
 return { success: true, message: `Notifikasi diperbarui (${result.updatedCount}).` };
 },
 [currentUser, isAdmin, getSessionToken]
 );

 const handleDeleteSentNotification = useCallback(
 async (dispatchId: string): Promise<{ success: boolean; message: string }> => {
 if (!currentUser || !isAdmin) return { success: false, message: 'Akses ditolak.' };
 const sessionToken = getSessionToken();
 if (!sessionToken) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

 const result = await deleteSentNotification(currentUser.username, sessionToken, dispatchId);
 if (!result.success) {
 return { success: false, message: result.error || 'Gagal menghapus notifikasi.' };
 }
 return { success: true, message: `Notifikasi dihapus (${result.deletedCount}).` };
 },
 [currentUser, isAdmin, getSessionToken]
 );

 // --- Auth gate ---
 if (authLoading) {
 return <div style={{ minHeight: '100vh' }}></div>;
 }

 if (!currentUser) {
 return <LoginPage />;
 }

 if (!currentUser.isActive) {
 return (
 <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
 <div style={{ textAlign: 'center', maxWidth: 360 }}>
 <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#EF4444' }}>block</span>
 <h2 style={{ margin: '0.75rem 0 0.5rem', fontWeight: 700 }}>Akun Dinonaktifkan</h2>
 <p style={{ color: '#6B7280', marginBottom: '1.5rem' }}>Akun Anda telah dinonaktifkan oleh admin. Hubungi admin untuk informasi lebih lanjut.</p>
 <button className="btn btn-primary btn-action" onClick={logout}>
 <span className="material-symbols-outlined">logout</span>
 Keluar
 </button>
 </div>
 </div>
 );
 }

 return (
 <>
 {/* Sidebar Panel */}
 <aside
 ref={sidebarRef}
 data-notification-trigger="true"
 className={`sidebar border-border-default ${sidebarOpenForView ? 'open' : ''} ${isMobileViewport ? 'mobile-viewport' : 'desktop-viewport'}`}
 style={{ width: `${sidebarWidthForView}px` }}
 >
 <div className="flex flex-col h-full p-4 justify-between">
 
 <div className="flex flex-col gap-4">
 {/* Logo / Header Branding */}
 <div className="flex items-center justify-between pb-3 border-b results-item-divider group logo-container relative">
 <div className="flex items-center gap-2 logo-wrapper pl-3">
 <div 
 className="relative flex items-center gap-2 cursor-pointer" 
 onClick={() => {
 if (!sidebarOpenForView) {
 openSidebar();
 } else {
 setActiveView('generator');
 }
 }}
 >
 <div className={`relative w-[38px] h-[38px] flex items-center justify-center shrink-0 rounded-lg ${!sidebarOpenForView ? 'sidebar-logo-collapsed-trigger' : ''}`}>
 <svg className={`app-brand-icon w-8 h-8 fill-current absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${!sidebarOpenForView ? 'sidebar-logo-collapsed-mark' : ''}`} viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
 <path d="M456.55,38.52H267.52c-4.19,0-8.07,2.2-10.21,5.8L137.03,246.21c-2.14,3.6-6.02,5.8-10.21,5.8H25.41
 c-9.22,0-14.93,10.05-10.21,17.97l113.23,190.04c2.14,3.6,6.02,5.8,10.21,5.8h189.04c9.22,0,14.93-10.05,10.21-17.97L232.1,270.3
 c-4.72-7.92,0.99-17.97,10.21-17.97h101.02c4.19,0,8.07-2.2,10.21-5.8L466.77,56.49C471.49,48.57,465.78,38.52,456.55,38.52z"/>
 <path d="M263.45,681.48h189.04c4.19,0,8.07-2.2,10.21-5.8l120.28-201.88c2.14-3.6,6.02-5.8,10.21-5.8h101.4
 c9.22,0,14.93-10.05,10.21-17.97L591.57,259.99c-2.14-3.6-6.02-5.8-10.21-5.8H392.33c-9.22,0-14.93,10.05-10.21,17.97L487.9,449.7
 c4.72,7.92-0.99,17.97-10.21,17.97H376.67c-4.19,0-8.07,2.2-10.21,5.8L253.23,663.51C248.51,671.43,254.22,681.48,263.45,681.48z"/>
 </svg>
 {!sidebarOpenForView && (
 <span className="material-symbols-rounded text-xl text-indigo-500 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 sidebar-open-icon">
 left_panel_open
 </span>
 )}
 </div>
 <span className="font-bold text-lg tracking-tight sora-brand title-brand">Sebellas</span>
 </div>
 </div>
 {shouldRenderSidebarCloseButton && (
 <button 
 type="button"
 onClick={closeSidebar}
 className={`sidebar-close-fade-btn w-[38px] h-[38px] flex items-center justify-center rounded-lg toggle-sidebar-btn ${sidebarOpenForView ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
 aria-label="Close menu"
 aria-hidden={!sidebarOpenForView}
 disabled={!sidebarOpenForView}
 >
 <span className="material-symbols-rounded text-xl text-gray-500">left_panel_close</span>
 </button>
 )}
 </div>



 {/* Tools Menu Section */}
 <div className="flex flex-col gap-1 mt-1">
 <button 
 type="button"
 onClick={() => {
 setIsNotificationInboxOpen(false);
 setActiveView('generator');
 }}
 className={`sidebar-item ${activeSidebarItem === 'generator' ? 'active' : ''}`}
 >
 <span className="material-symbols-rounded text-xl">auto_awesome</span>
 <span>{t('generateMenuLabel')}</span>
 </button>
 <button 
 type="button"
 onClick={() => {
 setIsNotificationInboxOpen(false);
 setActiveView('history');
 }}
 className={`sidebar-item ${activeSidebarItem === 'history' ? 'active' : ''}`}
 >
 <svg
 xmlns="http://www.w3.org/2000/svg"
 width="20"
 height="20"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="1.6"
 strokeLinecap="round"
 strokeLinejoin="round"
 className="sidebar-library-icon"
 aria-hidden="true"
 >
 <path d="m16 6 4 14" />
 <path d="M12 6v14" />
 <path d="M8 8v12" />
 <path d="M4 4v16" />
 </svg>
 <span>{t('historyButtonLabel')}</span>
 </button>
 <button 
 type="button"
 onClick={() => {
 setIsNotificationInboxOpen(false);
 setActiveView('jsonminifier');
 }}
 className={`sidebar-item ${activeSidebarItem === 'jsonminifier' ? 'active' : ''}`}
 >
 <span className="material-symbols-rounded text-xl sidebar-compress-icon">compress</span>
 <span>{t('jsonMinifierButtonLabel')}</span>
 </button>
 {!isMobileViewport && (
 <button
 type="button"
 data-notification-trigger="true"
 onClick={() => setIsNotificationInboxOpen((prev) => !prev)}
 className={`sidebar-item relative ${activeSidebarItem === 'notifications' ? 'active' : ''}`}
 >
 <span className="material-symbols-rounded text-xl">notifications</span>
 <span>Notifications</span>
 {notifications.unreadCount > 0 && (
 <span className="notification-count-badge absolute right-3">
 <span className="notification-count-number">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>
 </span>
 )}
 </button>
 )}

 </div>

 </div>

 <div className="flex flex-col gap-1 pt-3">
 {isAdmin && (
 <button 
 type="button"
 onClick={() => {
 setActiveView('admin');
 if (isMobileViewport) setIsMobileSidebarOpen(false);
 }}
 className={`sidebar-item ${activeSidebarItem === 'admin' ? 'active' : ''}`}
 >
 <span className="material-symbols-rounded text-xl">admin_panel_settings</span>
 <span>Admin Panel</span>
 </button>
 )}
 <button 
 type="button"
 onClick={() => {
 setIsNotificationInboxOpen(false);
 setIsApiKeyModalOpen(true);
 }}
 className={`sidebar-item ${activeSidebarItem === 'apikey' ? 'active' : ''}`}
 >
 <span className="material-symbols-rounded text-xl">key</span>
 <span>{t('setApiKeyButtonLabel')}</span>
 </button>
 {/* Sociabuzz Link */}
 <a 
 href="https://sociabuzz.com/sebelasproject/tribe" 
 target="_blank" 
 rel="noopener noreferrer" 
 className="sidebar-item"
 >
 <span className="material-symbols-rounded text-xl">coffee</span>
 <span>Dukung Kreator</span>
 </a>

 {/* Logout / User Info */}
 <div className="user-footer-container flex items-center justify-between gap-2 border-t border-gray-200/50 pt-3 pl-3 pr-0">
 <div className="user-info-wrapper flex items-center gap-2 overflow-hidden" title={currentUser?.username}>
 <div className="w-8 h-8 rounded-full flex shrink-0 items-center justify-center text-xs font-bold text-white bg-indigo-500">
 {currentUser?.username.charAt(0).toUpperCase()}
 </div>
 <span className="username-label profile-username truncate max-w-[80px] pr-1">{currentUser?.username}</span>
 </div>
 <button 
 type="button"
 onClick={logout} 
 className="logout-btn w-[38px] h-[38px] flex items-center justify-center rounded-lg hover:bg-red-500/15 text-red-500 transition-colors"
 title="Keluar"
 >
 <span className="material-symbols-rounded text-xl">logout</span>
 </button>
 </div>

 </div>
 </div>
 </aside>

 {/* Mobile Top Navigation */}
 <div className="md:hidden flex items-center justify-between w-full p-4 border-b border-gray-200 bg-white sticky top-0 z-40">
 <button 
 type="button"
 onClick={openSidebar}
 className="w-[38px] h-[38px] flex items-center justify-center rounded-lg hover:bg-gray-500/10 transition-colors"
 aria-label="Open menu"
 >
 <span className="material-symbols-outlined">menu</span>
 </button>
 <div className="flex items-center gap-1.5">
 <svg className="app-brand-icon w-6 h-6 fill-current" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
 <path d="M456.55,38.52H267.52c-4.19,0-8.07,2.2-10.21,5.8L137.03,246.21c-2.14,3.6-6.02,5.8-10.21,5.8H25.41
 c-9.22,0-14.93,10.05-10.21,17.97l113.23,190.04c2.14,3.6,6.02,5.8,10.21,5.8h189.04c9.22,0,14.93-10.05,10.21-17.97L232.1,270.3
 c-4.72-7.92,0.99-17.97,10.21-17.97h101.02c4.19,0,8.07-2.2,10.21-5.8L466.77,56.49C471.49,48.57,465.78,38.52,456.55,38.52z"/>
 <path d="M263.45,681.48h189.04c4.19,0,8.07-2.2,10.21-5.8l120.28-201.88c2.14-3.6,6.02-5.8,10.21-5.8h101.4
 c9.22,0,14.93-10.05,10.21-17.97L591.57,259.99c-2.14-3.6-6.02-5.8-10.21-5.8H392.33c-9.22,0-14.93,10.05-10.21,17.97L487.9,449.7
 c4.72,7.92-0.99,17.97-10.21,17.97H376.67c-4.19,0-8.07,2.2-10.21,5.8L253.23,663.51C248.51,671.43,254.22,681.48,263.45,681.48z"/>
 </svg>
 <span className="font-bold text-sm sora-brand title-brand">Sebellas</span>
 </div>
 <button
 type="button"
 data-notification-trigger="true"
 ref={notificationTriggerRef}
 onClick={() => setIsNotificationInboxOpen((prev) => !prev)}
 className="relative w-[38px] h-[38px] flex items-center justify-center rounded-lg hover:bg-gray-500/10 transition-colors"
 aria-label="Open notifications"
 >
 <span className="material-symbols-outlined">notifications</span>
 {notifications.unreadCount > 0 && (
 <span className="notification-count-badge absolute -top-0.5 -right-0.5">
 <span className="notification-count-number">{notifications.unreadCount > 99 ? '99+' : notifications.unreadCount}</span>
 </span>
 )}
 </button>
 </div>

 {/* Sidebar Backdrop Overlay on Mobile */}
 {isMobileViewport && isMobileSidebarOpen && (
 <div 
 onClick={closeSidebar}
 className="md:hidden fixed inset-0 overlay-darkness z-[999] transition-opacity"
 />
 )}

 <div className="editorial-main w-full mx-auto p-0 main-container mt-0">
 {activeView !== 'history' && activeView !== 'admin' && activeView !== 'jsonminifier' && (
 <>
 {/* Hero Header */}
 <div className="editorial-hero text-center mt-8 mb-8 px-4 host-grotesk-hero">
 <div className="editorial-hero-brand hidden sm:flex items-center justify-center gap-3.5 mb-4">
 <svg className="app-brand-icon w-11 h-11 fill-current" viewBox="0 0 720 720" xmlns="http://www.w3.org/2000/svg">
 <path d="M456.55,38.52H267.52c-4.19,0-8.07,2.2-10.21,5.8L137.03,246.21c-2.14,3.6-6.02,5.8-10.21,5.8H25.41
 c-9.22,0-14.93,10.05-10.21,17.97l113.23,190.04c2.14,3.6,6.02,5.8,10.21,5.8h189.04c9.22,0,14.93-10.05,10.21-17.97L232.1,270.3
 c-4.72-7.92,0.99-17.97,10.21-17.97h101.02c4.19,0,8.07-2.2,10.21-5.8L466.77,56.49C471.49,48.57,465.78,38.52,456.55,38.52z"/>
 <path d="M263.45,681.48h189.04c4.19,0,8.07-2.2,10.21-5.8l120.28-201.88c2.14-3.6,6.02-5.8,10.21-5.8h101.4
 c9.22,0,14.93-10.05,10.21-17.97L591.57,259.99c-2.14-3.6-6.02-5.8-10.21-5.8H392.33c-9.22,0-14.93,10.05-10.21,17.97L487.9,449.7
 c4.72,7.92-0.99,17.97-10.21,17.97H376.67c-4.19,0-8.07,2.2-10.21,5.8L253.23,663.51C248.51,671.43,254.22,681.48,263.45,681.48z"/>
 </svg>
 <span className="text-2xl md:text-3xl font-semibold tracking-tight sora-brand title-brand">
 Sebellas
 </span>
 </div>
 <h1 className="hero-heading text-[44px] font-[400] tracking-tight text-gray-900 ">
 <span className="hero-heading-line">Turn raw concept into</span>
 <span className="hero-heading-line">great prompt</span>
 </h1>
 <p className="hero-subheading mt-1 text-[19px] font-[400] text-gray-800 ">
 Your Advanced prompt generator for AI images and videos
 </p>
 </div>

 <div className="editorial-workspace flex flex-col gap-6 w-full max-w-3xl mx-auto mt-4 relative px-4 md:px-0">
 
 {/* Main Input Area - Floats directly, card container removed! */}
 <div className="editorial-input-block relative">
 {!hasAnyProviderInitialized && (
 <div
 className="absolute inset-0 z-10 cursor-pointer rounded-2xl"
 onClick={() => setIsApiKeyModalOpen(true)}
 role="button"
 aria-label={t('apiKeyStatusMissing')}
 />
 )}
 
 <InputArea
 isLoading={isLoading}
 isDraggingOverDropzone={isDraggingOver}
 settings={settings}
 uploadedImages={uploadedImages}
 handleImageFiles={handleImageFiles}
 handleDeleteImage={handleDeleteImage}
 imageFileInputRef={imageFileInputRef}
 clearUploadedImages={handleClearUploadedImagesCompletely}
 imageUploaderError={imageUploaderError}
 clearImageUploaderError={clearImageUploaderError}
 uploadedVideos={videoProcessor.uploadedVideos}
 videoUrlInput={videoProcessor.videoUrlInput}
 isLoadingFromUrl={videoProcessor.isLoadingFromUrl}
 videoUploaderError={videoProcessor.videoUploaderError}
 handleVideoFile={videoProcessor.handleVideoFile}
 handleLoadFromUrl={videoProcessor.handleLoadFromUrl}
 handleUrlInputClick={videoProcessor.handleUrlInputClick}
 setVideoUrlInput={videoProcessor.setVideoUrlInput}
 clearAllVideos={handleClearUploadedVideosCompletely}
 handleDeleteVideo={videoProcessor.handleDeleteVideo}
 videoFileInputRef={videoProcessor.fileInputRef}
 disabled={!hasAnyProviderInitialized || isLoading}
 />
 
 <div className="editorial-input-meta flex items-center justify-between pt-[4px] pb-[5px]">
 <button
 type="button"
 onClick={() => setIsConfigOpen(!isConfigOpen)}
 className="negative-prompt-toggle inline-flex items-center gap-1 hover:opacity-85 transition-opacity ml-0.5"
 style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 500, fontSize: '12px', lineHeight: 1 }}
 aria-expanded={isConfigOpen}
 >
 <span>Advanced settings</span>
 <svg
 className="inline-block w-4 h-4 transition-transform ease-linear duration-[180ms] flex-shrink-0"
 style={{ transform: isConfigOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 </button>

 {/* Clear Button — always rendered to prevent layout shift, just hidden when not needed */}
 {(() => {
 const hasContent =
 (settings.inputMode === 'text' && settings.conceptsInput.trim().length > 0) ||
 (settings.inputMode === 'image' && uploadedImages.length > 0) ||
 (settings.inputMode === 'video' && videoProcessor.uploadedVideos.length > 0);
 const clearCounterText =
 settings.inputMode === 'text'
 ? `Concepts: ${settings.conceptsInput.split(/[,;]/).map(c => c.trim()).filter(Boolean).length}`
 : settings.inputMode === 'image'
 ? `Images: ${uploadedImages.length}`
 : `Videos: ${videoProcessor.uploadedVideos.length}`;

 const onClick =
 settings.inputMode === 'text' ? () => settings.setConceptsInput('') :
 settings.inputMode === 'image' ? handleClearUploadedImagesCompletely :
 handleClearUploadedVideosCompletely;

 return (
 <div className={`flex items-center gap-2 ${hasContent ? 'opacity-100 pointer-events-auto' : 'invisible pointer-events-none'}`}>
 <span className="counter-text-spec">
 {clearCounterText}
 </span>
 <button
 onClick={onClick}
 disabled={isLoading}
 style={!isSelectedProviderInitialized && !isLoading ? { cursor: 'not-allowed' } : undefined}
 className="btn btn-destructive flex items-center gap-1 !py-1 !px-2.5 rounded-full border border-transparent transition-all duration-[560ms]"
 aria-label={t('clearTextConceptsAriaLabel')}
 title={t('clearButtonLabel')}
 >
 <span className="material-symbols-outlined !text-[16px]">delete_sweep</span>
 <span className="text-[12px] font-semibold">{t('clearButtonLabel')}</span>
 </button>
 </div>
 );
 })()}
 </div>

 {/* Collapsible SettingsForm */}
 <div className={`advanced-settings-panel ${isConfigOpen ? 'is-open' : 'pointer-events-none'}`}>
 <SettingsForm isLoading={isLoading} settings={settings} disabled={isLoading} folders={folders} onUpdateFolders={saveFolders} />
 </div>

 <div className="editorial-generate-row mt-[3px]">
        <GenerationControls
          isApiInitialized={isSelectedProviderInitialized}
          isLoading={isLoading}
          isDisabled={isRetryingAll || retryingIds.size > 0}
          selectedModel={settings.selectedModel}
          inputMode={settings.inputMode}
          onGenerate={handleGeneratePrompts}
        />
 </div>
 </div>

 {/* Error display */}
 {error && (
 <div role="alert" className="error-box flex items-center p-3 text-sm shadow-md rounded-xl">
 <span className="material-symbols-outlined mr-2" aria-hidden="true">error</span>
 <span className="flex-1">{error}</span>
 </div>
 )}

 {/* Results display flowing directly below */}
 {generatedPromptSets.length > 0 && (
 <div className="editorial-results-wrap mt-2">
 <ResultsDisplay
 generatedPromptSets={generatedPromptSets}
 totalPrompts={totalSuccessfullyGeneratedPrompts}
 onClearAll={handleClearAllResults}
 onRetryFailed={handleRetryFailedSet}
 onRetryAllFailed={handleRetryAllFailedSets}
 formatPromptsForExport={formatPromptsForExport}
 inputMode={settings.inputMode}
 isRetryingAll={isRetryingAll}
 retryingIds={retryingIds}
 />
 </div>
 )}
 </div>
 </>
 )}

 {activeView === 'history' && (
 <Suspense fallback={null}>
 <LazyHistoryModal
 onClose={() => setActiveView('generator')}
 history={history}
 folders={folders}
 onDelete={handleDeleteHistoryEntry}
 onClear={handleClearHistory}
 formatPromptsForExport={formatPromptsForExport}
 onUpdateHistory={(updated) => saveHistory(updated)}
 onUpdateFolders={(updated) => saveFolders(updated)}
 />
 </Suspense>
 )}

 {activeView === 'admin' && (
 <Suspense fallback={null}>
 <LazyAdminPanel
 isOpen={true}
 onClose={() => setActiveView('generator')}
 isSidebarOpen={isSidebarOpen}
 onSendNotification={handleSendNotification}
 onListSentNotifications={handleListSentNotifications}
 onUpdateSentNotification={handleUpdateSentNotification}
 onDeleteSentNotification={handleDeleteSentNotification}
 />
 </Suspense>
 )}

 {activeView === 'jsonminifier' && (
 <Suspense fallback={null}>
 <LazyJsonMinifierModal
 onClose={() => setActiveView('generator')}
 isSidebarOpen={isSidebarOpen}
 />
 </Suspense>
 )}
 </div>
 {activeView !== 'history' && activeView !== 'admin' && activeView !== 'jsonminifier' && (
 <footer className="w-full max-w-none text-center py-6 text-xs footer-text">
          &copy; 2026 Sebellas Studio. All rights reserved.
        </footer>
      )}
      {isApiKeyModalOpen && (
        <ApiKeyModal
          onClose={() => setIsApiKeyModalOpen(false)}
          onSave={handleSaveApiKeys}
          onCheck={handleCheckProviderApiKey}
          currentApiKeys={apiKeys}
          apiStatus={apiStatus}
          selectedModel={settings.selectedModel}
          isSidebarOpen={isSidebarOpen}
        />
      )}
      {(isNotificationInboxOpen || hasLoadedNotificationInbox) && (
        <Suspense fallback={null}>
          <LazyNotificationInbox
            isOpen={isNotificationInboxOpen}
            isMobileViewport={isMobileViewport}
            mobileAnchorTop={notificationTriggerRef.current?.getBoundingClientRect().bottom ?? null}
            mobileAnchorRight={notificationTriggerRef.current?.getBoundingClientRect().right ?? null}
            sidebarWidth={sidebarWidthForView}
            items={notifications.items}
            unreadCount={notifications.unreadCount}
            isLoading={notifications.isLoading}
            error={notifications.error}
            onClose={() => setIsNotificationInboxOpen(false)}
            onMarkRead={notifications.markRead}
            onMarkAllRead={notifications.markAllRead}
          />
        </Suspense>
      )}
    </>
  );
};

export default memo(App);



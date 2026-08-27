import React, { useState, useCallback, useEffect, useLayoutEffect, useRef, memo, lazy, Suspense } from 'react';

// Hooks
import { useLocalizationContext } from './contexts/LocalizationContext';
import { useSettings } from './hooks/useSettings';
import { useImageUploader } from './hooks/useImageUploader';
import { useVideoProcessor } from './hooks/useVideoProcessor';
import { readStoredProviderApiKeys, useGemini } from './hooks/useGemini';

// Auth
import { useAuth } from './contexts/AuthContext';

// Hooks & Contexts
import { LANGUAGES } from './locales';

// Components
import InputArea from './components/InputArea';
import SettingsForm from './components/SettingsForm';
import GenerationControls from './components/GenerationControls';
import ResultsDisplay from './components/ResultsDisplay';
import ApiKeyModal from './components/ApiKeyModal';
import { GenerationActivityProgress, ActivityLogItem } from './components/GenerationActivityProgress';

// Types & Libs
import { GeneratedPromptSet, HistoryEntry, GenerationSettings, NotificationKind, NotificationTarget, SentNotificationItem, Folder } from './types';
import * as PromptBuilder from './lib/prompts';
import { sendNotification, listSentNotifications, updateSentNotification, deleteSentNotification } from './lib/notifications';
import { useNotifications } from './hooks/useNotifications';
import { generateModelContent, shouldRotateApiKeyOnError, isTransientEmptyResponseError } from './lib/apiClient';
import { MODEL_PROVIDER_LABELS, getModelProvider, isModelSupportedForMode } from './constants';
import type { ModelProvider } from './constants';
import { generateUuid } from './lib/crypto';

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
 const { isProviderInitialized, apiKeys, apiStatus, handleSaveApiKeys, handleSaveProviderApiKey, handleRemoveDeadApiKey, handleCheckProviderApiKey, parseApiError } = useGemini(t);
 const selectedModelProvider = getModelProvider(settings.selectedModel);
 const isSelectedProviderInitialized = isProviderInitialized(selectedModelProvider);
 const hasAnyProviderInitialized = Object.values(apiStatus).some(Boolean);

 const [generatedPromptSets, setGeneratedPromptSets] = useState<GeneratedPromptSet[]>([]);
 const [isLoading, setIsLoading] = useState<boolean>(false);
 const [isRetryingAll, setIsRetryingAll] = useState<boolean>(false);
 const [retryingIds, setRetryingIds] = useState<Set<string | number>>(new Set());
 const [error, setError] = useState<string | null>(null);

 // Real-time Activity Logs & Concurrency Progress state
 const [activityLogs, setActivityLogs] = useState<ActivityLogItem[]>([]);
 const [totalJobsCount, setTotalJobsCount] = useState<number>(0);
 const [completedJobsCount, setCompletedJobsCount] = useState<number>(0);
 const [currentProcessingConcept, setCurrentProcessingConcept] = useState<string>('');
 const [activeWorkersCount, setActiveWorkersCount] = useState<number>(1);

 const addActivityLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', workerIndex?: number) => {
   const timeStr = new Date().toLocaleTimeString('id-ID', { hour12: false });
   setActivityLogs(prev => [
     ...prev.slice(-49),
     { id: generateUuid(), timestamp: timeStr, message, type, workerIndex }
   ]);
 }, []);

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
 const apiKeyIndexesRef = useRef<Record<ModelProvider, number>>({ google: 0, groq: 0, mistral: 0, openrouter: 0, github: 0 });
 const keyLastUsedTimeRef = useRef<Record<string, number>>({});
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
 sets: entry.sets.map((set: any) => ({ ...set, id: set.id || generateUuid() }))
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
    promptBuilder: () => { contents: any; config: any; },
    assignedKeyIndex?: number
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
      const startKeyIndex = assignedKeyIndex !== undefined
        ? (assignedKeyIndex % providerKeys.length)
        : (reserveNextApiKeyStartIndex(provider) ?? 0);
      if (startKeyIndex === null || startKeyIndex === undefined) throw new Error(`No ${provider} API key found. Please add your API key in Settings → API Keys.`);
      const isXml = settings.promptQualityOption === 'xml';

      // Cooldown per provider (ms) — ringan karena round-robin sudah memberikan jeda alami antar key
      const SAFE_KEY_COOLDOWN_MS: Record<string, number> = {
        google: 300,
        groq: 800,
        mistral: 600,
        openrouter: 600,
        github: 2000,
      };
      const keyCooldownInterval = SAFE_KEY_COOLDOWN_MS[provider] ?? 600;

      for (let attempt = 0; attempt < providerKeys.length; attempt += 1) {
        const keyIdx = (startKeyIndex + attempt) % providerKeys.length;
        const selectedApiKey = providerKeys[keyIdx];

        try {
          // Smart Independent Cooldown per-KEY:
          // - Setiap key punya timer mandiri → key berbeda di worker paralel = 0ms jeda (instant)
          // - Jika key yang SAMA baru saja dipakai → tunggu sisa cooldown saja
          // - Jika key sudah idle >= interval → langsung eksekusi (0ms delay)
          const lastUsed = keyLastUsedTimeRef.current[selectedApiKey] || 0;
          const elapsed = Date.now() - lastUsed;
          if (elapsed < keyCooldownInterval) {
            const waitTime = keyCooldownInterval - elapsed;
            await new Promise(resolve => window.setTimeout(resolve, waitTime));
          }
          keyLastUsedTimeRef.current[selectedApiKey] = Date.now();

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
          const errRaw = (requestError instanceof Error ? requestError.message : String(requestError)).toLowerCase();
          const errParsed = parseApiError(requestError);

          // Hanya hapus secara permanen jika key BENAR-BENAR invalid/dicabut.
          // JANGAN hapus jika hanya kena 429, model_not_found, atau error sementara.
          const isModelError = errRaw.includes('model_not_found') || errRaw.includes('does not exist');
          const isPermanentlyInvalid = !isModelError && (
            errRaw.includes('invalid_api_key') ||
            errRaw.includes('invalid api key') ||
            errRaw.includes('api key not valid') ||
            (errRaw.includes('unauthorized') && errRaw.includes('invalid'))
          );

          if (isPermanentlyInvalid) {
            const maskedKey = `${selectedApiKey.slice(0, 6)}...${selectedApiKey.slice(-4)}`;
            addActivityLog(`⚠️ [Auto-Remove] Key ${maskedKey} tidak valid/dicabut (${errParsed}) dan otomatis dihapus.`, 'warning');
            handleRemoveDeadApiKey(provider, selectedApiKey, errParsed);
          } else if (errRaw.includes('429') || errRaw.includes('rate limit') || errRaw.includes('resource exhausted')) {
            // Adaptive backoff: jeda 5 detik untuk key yang terkena 429 lalu rotasi ke key berikutnya
            const maskedKey = `${selectedApiKey.slice(0, 6)}...${selectedApiKey.slice(-4)}`;
            addActivityLog(`⏳ [Backoff 5s] Key ${maskedKey} limit sementara, rotasi ke key berikutnya...`, 'info');
            keyLastUsedTimeRef.current[selectedApiKey] = Date.now() + 5000;
          }

          const canTryAnotherKey = attempt < providerKeys.length - 1;
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

  // Guaranteed Vector Suffix Enforcement:
  // Memastikan 100% setiap prompt mode vektor selalu memiliki sufiks paten yang sesuai di bagian akhir,
  // bahkan jika model AI lupa atau memotong bagian sufiksnya.
  const isVectorMode = settings.styleOption === 'vector' || settings.inputMode === 'vector';
  if (isVectorMode) {
    const isWhiteBg = settings.vectorWhiteBg ?? true;
    const targetSuffix = PromptBuilder.getActiveVectorSuffix(settings.vectorArtStyle, isWhiteBg);
    const chosenStyle = (settings.vectorArtStyle || '').toLowerCase();

    // Gunakan tanda tangan unik spesifik dari masing-masing sufiks (bukan kata umum)
    let suffixSignature = 'flat illustration style';
    if (chosenStyle.includes('monoline')) suffixSignature = 'minimalist monoline vector art';
    else if (chosenStyle.includes('geometric silhouette')) suffixSignature = 'geometric silhouette vector art';
    else if (chosenStyle.includes('negative space')) suffixSignature = 'clever negative space cutout logo emblem';

    parsedPrompts = parsedPrompts.map(item => {
      if (typeof item !== 'string') return item;
      let text = item.trim();
      text = text.replace(/[,.]\s*$/, '').trim();

      if (!text.toLowerCase().includes(suffixSignature)) {
        // Hapus potongan parsial di ujung jika AI sempat menulis sebagian
        text = text.replace(/,?\s*(negative space vector art|geometric silhouette vector art|minimalist monoline vector art|flat illustration style).*$/i, '').trim();
        text = text.replace(/[,.]\s*$/, '').trim();
        return `${text}, ${targetSuffix}`;
      }
      return item;
    });
  }

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
 type GenerationTask = { placeholders: GeneratedPromptSet[], jobs: GenerationJob[], jobToPlaceholderMap?: number[], conceptNames?: string[] };

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
    const rawConcepts = settings.conceptsInput.split(/[\n,;]/).map(c => c.trim()).filter(Boolean);
    if (rawConcepts.length === 0) {
      setError(t('errorNoValidConceptsToProcess'));
      return { placeholders: [], jobs: [] };
    }

    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const numKeys = Math.max(1, providerKeys.length || settings.workerCount || 1);

    const totalRequested = Math.max(1, settings.numPrompts || 1);

    const placeholders: GeneratedPromptSet[] = [];
    const jobs: GenerationJob[] = [];
    const jobToPlaceholderMap: number[] = [];
    const conceptNames: string[] = [];
    let globalJobIdx = 0;

    // Round-Robin: 1 placeholder per concept, N jobs (1 prompt per API call)
    // Key bergantian: K1→K2→K3→K1→K2→... setiap key istirahat selagi key lain bekerja
    rawConcepts.forEach((concept) => {
      const placeholderIdx = placeholders.length;
      const placeholder: GeneratedPromptSet = {
        id: generateUuid(),
        originalConcept: concept,
        prompts: [],
        hasError: false,
        inputMode: 'text' as const,
      };
      placeholders.push(placeholder);

      for (let i = 0; i < totalRequested; i++) {
        const assignedKeyIdx = globalJobIdx % numKeys;
        jobToPlaceholderMap.push(placeholderIdx);
        conceptNames.push(concept);
        jobs.push(() =>
          processAndGenerate(
            placeholder,
            () => PromptBuilder.buildTextPrompt(concept, { ...settings, numPrompts: 1 }, isQuick),
            assignedKeyIdx
          )
        );
        globalJobIdx += 1;
      }
    });

    return { placeholders, jobs, jobToPlaceholderMap, conceptNames };
  }, [settings, processAndGenerate, apiKeys, t]);

  const generateForVectorMode = useCallback((isQuick: boolean) => {
    const rawConcepts = settings.conceptsInput.split(/[\n,;]/).map(c => c.trim()).filter(Boolean);
    if (rawConcepts.length === 0) {
      setError(t('errorNoValidConceptsToProcess'));
      return { placeholders: [], jobs: [] };
    }

    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const numKeys = Math.max(1, providerKeys.length || settings.workerCount || 1);

    const totalRequested = Math.max(1, settings.numPrompts || 1);

    const placeholders: GeneratedPromptSet[] = [];
    const jobs: GenerationJob[] = [];
    const jobToPlaceholderMap: number[] = [];
    const conceptNames: string[] = [];
    let globalJobIdx = 0;

    // Round-Robin: 1 placeholder per concept, N jobs (1 prompt per API call)
    rawConcepts.forEach((concept) => {
      const placeholderIdx = placeholders.length;
      const placeholder: GeneratedPromptSet = {
        id: generateUuid(),
        originalConcept: concept,
        prompts: [],
        hasError: false,
        inputMode: 'vector' as const,
      };
      placeholders.push(placeholder);

      for (let i = 0; i < totalRequested; i++) {
        const assignedKeyIdx = globalJobIdx % numKeys;
        jobToPlaceholderMap.push(placeholderIdx);
        conceptNames.push(concept);
        jobs.push(() =>
          processAndGenerate(
            placeholder,
            () => PromptBuilder.buildTextPrompt(concept, { ...settings, styleOption: 'vector', numPrompts: 1 }, isQuick),
            assignedKeyIdx
          )
        );
        globalJobIdx += 1;
      }
    });

    return { placeholders, jobs, jobToPlaceholderMap, conceptNames };
  }, [settings, processAndGenerate, apiKeys, t]);
  
  const generateForImageMode = useCallback((isQuick: boolean) => {
    if (uploadedImages.length === 0) {
      setError(t('errorNoImageUploaded'));
      return { placeholders: [], jobs: [] };
    }
    const placeholders = uploadedImages.map(image => ({
      id: generateUuid(),
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
      id: generateUuid(), originalConcept: video.name, prompts: [], hasError: false, inputMode: 'video' as const, sourceId: video.id, sourceFile: video.file,
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

    if (retryMode === 'vector') {
      return processAndGenerate(
        retryPlaceholder,
        () => PromptBuilder.buildTextPrompt(failedSet.originalConcept, { ...settings, styleOption: 'vector' }, false)
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
      case 'vector': generationTask = generateForVectorMode(isQuick); break;
      case 'image': generationTask = generateForImageMode(isQuick); break;
      case 'video': generationTask = await generateForVideoMode(isQuick); break;
    }
    
    if (!generationTask || generationTask.jobs.length === 0) {
      setIsLoading(false);
      return;
    }

    const finalSets: GeneratedPromptSet[] = [];
    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const isRoundRobin = !!generationTask.jobToPlaceholderMap;
    const numKeys = Math.max(1, providerKeys.length || 1);

    // Round-Robin: concurrency adaptif berdasarkan jumlah key
    // Per-key cooldown sudah handle rate limit, jadi bisa paralel lebih banyak
    let effectiveWorkerCount: number;
    if (isRoundRobin) {
      if (numKeys <= 2) effectiveWorkerCount = 1;       // 1-2 key: sequential
      else if (numKeys <= 5) effectiveWorkerCount = 2;   // 3-5 key: 2 paralel
      else effectiveWorkerCount = 3;                     // 6+ key: 3 paralel
    } else {
      effectiveWorkerCount = Math.max(1, Math.min(50, Math.max(settings.workerCount || 1, numKeys)));
    }
    const batchDelaySeconds = Math.max(0, Math.min(300, settings.batchDelaySeconds || 0));

    setActiveWorkersCount(effectiveWorkerCount);
    setTotalJobsCount(generationTask.jobs.length);
    setCompletedJobsCount(0);
    setActivityLogs([]);

    if (isRoundRobin) {
      addActivityLog(`🔄 Round-Robin: ${generationTask.jobs.length} prompt (1/call), ${effectiveWorkerCount} paralel, ${numKeys} key bergantian (${MODEL_PROVIDER_LABELS[provider]})`, 'info');
      // Tampilkan placeholder kosong di awal agar card langsung muncul
      setGeneratedPromptSets([...generationTask.placeholders]);
    } else {
      addActivityLog(`Memulai proses ${generationTask.jobs.length} tugas dengan ${effectiveWorkerCount} worker paralel aktif (${MODEL_PROVIDER_LABELS[provider]})...`, 'info');
    }

    let finishedCount = 0;
    for (let startIndex = 0; startIndex < generationTask.jobs.length; startIndex += effectiveWorkerCount) {
      const batch = generationTask.jobs.slice(startIndex, startIndex + effectiveWorkerCount);
      
      const batchResults = await Promise.all(batch.map(async (job, idx) => {
        // Staggered start: worker berikutnya mulai 800ms setelah sebelumnya
        // Cukup untuk spacing, tidak terlalu lama
        if (isRoundRobin && idx > 0) {
          await new Promise(resolve => window.setTimeout(resolve, idx * 800));
        }
        const absoluteJobIdx = startIndex + idx;
        const workerIndex = idx + 1;
        const conceptName = isRoundRobin
          ? (generationTask.conceptNames?.[absoluteJobIdx] || '')
          : (generationTask.placeholders[absoluteJobIdx]?.originalConcept || '');
        
        setCurrentProcessingConcept(conceptName);
        if (isRoundRobin) {
          const promptNum = finishedCount + idx + 1;
          addActivityLog(`🔑 Key #${(absoluteJobIdx % providerKeys.length) + 1} → Prompt #${promptNum} "${conceptName}"`, 'info', workerIndex);
        } else {
          addActivityLog(`Worker #${workerIndex}: Sedang memproses konsep "${conceptName}"...`, 'info', workerIndex);
        }

        const result = await job();
        finishedCount += 1;
        setCompletedJobsCount(finishedCount);

        if (result.hasError) {
          addActivityLog(`❌ Gagal prompt "${conceptName}"`, 'error', workerIndex);
        } else {
          addActivityLog(`✅ Prompt #${finishedCount} "${conceptName}" selesai`, 'success', workerIndex);
        }

        // Real-time update
        if (generationIdRef.current === currentGenerationId) {
          if (isRoundRobin && generationTask.jobToPlaceholderMap) {
            // Round-Robin: merge prompt ke placeholder yang sesuai
            const phIdx = generationTask.jobToPlaceholderMap[absoluteJobIdx];
            const targetPlaceholder = generationTask.placeholders[phIdx];
            if (!result.hasError && result.prompts.length > 0) {
              targetPlaceholder.prompts = [...targetPlaceholder.prompts, ...result.prompts];
            }
            if (result.hasError) {
              targetPlaceholder.hasError = true;
            }
            // Trigger re-render dengan object baru
            setGeneratedPromptSets(prev => prev.map((s, i) =>
              i === phIdx ? { ...targetPlaceholder } : s
            ));
          } else {
            // Legacy mode (image/video): tambah set baru
            setGeneratedPromptSets(prev => [...prev, result]);
          }
        }
        return result;
      }));
      
      if (!isRoundRobin) finalSets.push(...batchResults);

      if (generationIdRef.current !== currentGenerationId) return;

      const hasMoreBatches = startIndex + effectiveWorkerCount < generationTask.jobs.length;
      if (hasMoreBatches && batchDelaySeconds > 0) {
        addActivityLog(`Menunggu jeda batch ${batchDelaySeconds} detik...`, 'info');
        await waitForBatchDelay(batchDelaySeconds);
        if (generationIdRef.current !== currentGenerationId) return;
      }
    }
    
    if (generationIdRef.current !== currentGenerationId) return;

    // Finalisasi: gunakan placeholders untuk round-robin, finalSets untuk legacy
    const completedSets = isRoundRobin ? generationTask.placeholders : finalSets;
    
    if (completedSets.some(s => s.hasError)) {
      setError(t('errorSomePromptsFailed'));
      addActivityLog(`Selesai dengan beberapa error.`, 'warning');
    } else {
      const totalPrompts = completedSets.flatMap(s => s.prompts).length;
      addActivityLog(`🎉 Semua selesai! Total ${totalPrompts} prompt siap.`, 'success');
    }

    setIsLoading(false);

    if (completedSets.some(s => !s.hasError && s.prompts.length > 0)) {
      const currentSettings: GenerationSettings = {
        ...settings,
        conceptsInput: (settings.inputMode === 'text' || settings.inputMode === 'vector') ? settings.conceptsInput : '',
        imageNames: settings.inputMode === 'image' ? uploadedImages.map(img => img.name) : [],
        videoNames: settings.inputMode === 'video' ? videoProcessor.uploadedVideos.map(v => v.name) : [],
      };
      saveHistory([{ id: Date.now(), timestamp: Date.now(), settings: currentSettings, sets: completedSets, folderId: settings.targetFolderId || null }, ...history]);
    }
  }, [settings, uploadedImages, videoProcessor.uploadedVideos, saveHistory, history, t, isProviderInitialized, generateForTextMode, generateForVectorMode, generateForImageMode, generateForVideoMode, isLoading, isRetryingAll, retryingIds, addActivityLog, apiKeys]);
 
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
  setActivityLogs([]);
  setTotalJobsCount(0);
  setCompletedJobsCount(0);
  setCurrentProcessingConcept('');
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
  setActivityLogs([]);
  setTotalJobsCount(0);
  setCompletedJobsCount(0);
  setCurrentProcessingConcept('');
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
      return { success: true, message: `Notifikasi dihapus (${result.deletedCount}).` };
    },
    [currentUser, isAdmin, getSessionToken]
  );

  return (
    <div className="min-h-screen bg-[#0d0d10] text-gray-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Clean Top Navigation Bar */}
      <header className="w-full border-b border-white/[0.08] bg-[#141416]/90 backdrop-blur-md sticky top-0 z-30 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          {/* Logo & Branding */}
          <div 
            onClick={() => setActiveView('generator')}
            className="flex items-center gap-2.5 cursor-pointer hover:opacity-90 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <span className="material-symbols-outlined text-xl">polyline</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-white tracking-tight">Sebellas</span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                Vector Studio
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsApiKeyModalOpen(true)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                isSelectedProviderInitialized
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20 ring-1 ring-amber-500/30 animate-pulse'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {isSelectedProviderInitialized ? 'check_circle' : 'key'}
              </span>
              <span>
                {isSelectedProviderInitialized
                  ? `${MODEL_PROVIDER_LABELS[selectedModelProvider]} Connected`
                  : `Set ${MODEL_PROVIDER_LABELS[selectedModelProvider]} Key`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView(activeView === 'history' ? 'generator' : 'history')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.05] hover:bg-white/[0.1] text-gray-300 border border-white/[0.08] transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-sm">history</span>
              <span>Riwayat ({history.length})</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="w-full max-w-3xl mx-auto px-4 py-8 flex-1 flex flex-col gap-6">
        {activeView === 'generator' && (
          <>
            {/* Minimal Header */}
            <div className="text-center mb-1">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1.5">
                Vector Prompt Generator
              </h1>
              <p className="text-sm text-gray-400">
                Brainstorming ide & kembangkan prompt ilustrasi vektor 2D berkualitas tinggi
              </p>
            </div>

            {/* Simple Brainstorming Card */}
            <InputArea
              isLoading={isLoading}
              disabled={isLoading}
              settings={settings}
              onGenerate={() => {
                if (!isSelectedProviderInitialized) {
                  setIsApiKeyModalOpen(true);
                  return;
                }
                handleGeneratePrompts(false);
              }}
            />

            {/* Real-time Activity Logs & Concurrency Progress Bar */}
            {(isLoading || activityLogs.length > 0) && (
              <GenerationActivityProgress
                isLoading={isLoading}
                totalJobs={totalJobsCount}
                completedJobs={completedJobsCount}
                activeWorkers={activeWorkersCount}
                currentConcept={currentProcessingConcept}
                logs={activityLogs}
                onClearLogs={() => setActivityLogs([])}
              />
            )}

            {/* Error Alert */}
            {error && (
              <div role="alert" className="p-3.5 text-sm bg-red-500/10 border border-red-500/30 text-red-300 rounded-xl flex items-center gap-2.5">
                <span className="material-symbols-outlined text-base">error</span>
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* Results Display */}
            {generatedPromptSets.length > 0 && (
              <div className="mt-2">
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
      </main>

      {/* Minimal Clean Footer */}
      <footer className="w-full text-center py-6 text-xs text-gray-500 border-t border-white/[0.05]">
        &copy; 2026 Sebellas Studio. All rights reserved.
      </footer>

      {/* API Key Modal */}
      {isApiKeyModalOpen && (
        <ApiKeyModal
          onClose={() => setIsApiKeyModalOpen(false)}
          onSave={handleSaveApiKeys}
          onCheck={handleCheckProviderApiKey}
          currentApiKeys={apiKeys}
          apiStatus={apiStatus}
          selectedModel={settings.selectedModel}
          isSidebarOpen={false}
          onModelChange={settings.setSelectedModel}
        />
      )}
    </div>
  );
};

export default memo(App);

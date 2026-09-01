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

  const runModelCall = useCallback(async (
    promptBuilder: () => { contents: any; config: any; },
    assignedKeyIndex?: number
  ): Promise<string> => {
    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    if (!isProviderInitialized(provider) || providerKeys.length === 0) {
      throw new Error(`No ${MODEL_PROVIDER_LABELS[provider]} API key found. Please add your API key in Settings → API Keys.`);
    }
    if (!isModelSupportedForMode(settings.selectedModel, settings.inputMode)) {
      throw new Error(`${settings.selectedModel} does not support ${settings.inputMode} mode.`);
    }

    const { contents, config } = promptBuilder();
    let responseText = '';
    let lastGenerationError: unknown = null;
    const startKeyIndex = assignedKeyIndex !== undefined
      ? (assignedKeyIndex % providerKeys.length)
      : (reserveNextApiKeyStartIndex(provider) ?? 0);

    for (let attempt = 0; attempt < providerKeys.length; attempt += 1) {
      const keyIdx = (startKeyIndex + attempt) % providerKeys.length;
      const selectedApiKey = providerKeys[keyIdx];

      let innerRetries = 3;
      let delayMs = 3000;

      while (innerRetries > 0) {
        try {
          responseText = await generateModelContent({
            model: settings.selectedModel,
            contents,
            config,
            apiKey: selectedApiKey,
            isXmlQuality: settings.promptQualityOption === 'xml',
          });
          lastGenerationError = null;
          break; // success
        } catch (requestError: any) {
          lastGenerationError = requestError;
          const errMsg = (requestError?.message || String(requestError)).toLowerCase();
          
          if (errMsg.includes('429') || errMsg.includes('too many requests') || errMsg.includes('quota')) {
            console.warn(`Rate limited (429). Retrying in ${delayMs}ms... (${innerRetries} retries left for this key)`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 2; // exponential backoff
            innerRetries--;
          } else {
            // Not a rate limit error, break inner loop to try next key immediately
            break;
          }
        }
      }

      // If we got a response or we ran out of keys, break the outer loop
      if (!lastGenerationError) {
        break;
      }
      
      const canTryAnotherKey = attempt < providerKeys.length - 1;
      if (!canTryAnotherKey) {
        throw lastGenerationError;
      }
      console.warn(`Retrying ${provider} with next API key after error:`, lastGenerationError);
    }

    if (lastGenerationError) throw lastGenerationError;
    if (!responseText) throw new Error(t('errorApiResponseNoValidText'));
    return responseText;
  }, [settings, apiKeys, isProviderInitialized, reserveNextApiKeyStartIndex, t]);

  const processAndGenerate = useCallback(async (
    placeholder: GeneratedPromptSet,
    promptBuilder: () => { contents: any; config: any; },
    assignedKeyIndex?: number
  ): Promise<GeneratedPromptSet> => {
    try {
      const responseText = await runModelCall(promptBuilder, assignedKeyIndex);

      // Parse JSON array / responses with robust markdown & JSON sanitization
      let parsedPrompts: string[] = [];
      let sanitizedText = responseText.trim();
      // Strip markdown code fences (```json ... ``` or ``` ...)
      sanitizedText = sanitizedText.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();

      try {
        const parsed = JSON.parse(sanitizedText);
        
        const chosenLayoutPreset = settings.vectorPreset ?? '';
        const isMultiItemOutput = typeof chosenLayoutPreset === 'string' && chosenLayoutPreset.trim() !== '' && chosenLayoutPreset !== 'Single Image';

        const mapPromptItem = (p: any): string => {
          if (typeof p === 'string') return p;
          if (Array.isArray(p)) return p.filter(v => typeof v === 'string').join(' ');
          if (typeof p === 'object' && p !== null) {
            if (isMultiItemOutput) {
              // Assemble: layout_prefix + sorted item_N values
              const prefix = typeof p['layout_prefix'] === 'string' ? p['layout_prefix'].trim() : '';
              const itemKeys = Object.keys(p).filter(k => k.startsWith('item_')).sort((a, b) => {
                const numA = parseInt(a.replace('item_', ''), 10);
                const numB = parseInt(b.replace('item_', ''), 10);
                return numA - numB;
              });
              const itemTexts = itemKeys.map(k => (p[k] as string || '').trim()).filter(Boolean);
              if (itemTexts.length > 0) {
                return prefix ? `${prefix}${itemTexts.join(' ')}` : itemTexts.join(' ');
              }
            }
            // Fallback: join all string values
            return Object.values(p).filter(v => typeof v === 'string').join(' ');
          }
          return String(p);
        };

        if (Array.isArray(parsed)) {
          parsedPrompts = parsed.map(mapPromptItem);
        } else if (parsed && typeof parsed === 'object') {
          const firstArr = Object.values(parsed).find(v => Array.isArray(v));
          if (firstArr) {
            parsedPrompts = (firstArr as any[]).map(mapPromptItem);
          } else {
            parsedPrompts = [mapPromptItem(parsed)];
          }
        } else {
          parsedPrompts = [sanitizedText];
        }
      } catch {
        // Regex extract all quoted strings inside JSON if JSON.parse failed
        const extractedStrings: string[] = [];
        const regex = /"((?:[^"\\]|\\.)+)"/g;
        let match;
        while ((match = regex.exec(sanitizedText)) !== null) {
          const val = match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
          // Filter out JSON keys like "prompts", "theme", "concept"
          if (val && !/^(prompts|theme|concept|ideas|response|output)$/i.test(val) && val.length > 15) {
            extractedStrings.push(val);
          }
        }

        if (extractedStrings.length > 0) {
          parsedPrompts = extractedStrings;
        } else {
          parsedPrompts = sanitizedText.split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0 && !/^[[\]{},"']+$/.test(l));
        }
      }

      // Guaranteed Vector Suffix Enforcement:
      // Pastikan 100% setiap prompt selalu memiliki deskripsi tema yang valid + sufiks paten style yang lengkap tanpa duplikasi kata jersey/sufiks.
      const isVectorStyle = settings.inputMode === 'vector' || settings.styleOption === 'vector';
      const hasRefImages = (settings.vectorReferenceImages || []).length > 0;
      
      if (isVectorStyle) {
        // ALWAYS enforce suffix paten for vector mode (text-only AND image reference)
        const isWhiteBg = settings.vectorWhiteBg ?? true;
        const targetSuffix = PromptBuilder.getActiveVectorSuffix(settings.vectorArtStyle || 'Flat illustration', isWhiteBg, placeholder.originalConcept);

        parsedPrompts = parsedPrompts
          .map(item => {
            if (!item || typeof item !== 'string') return '';
            let text = item.trim();

            // 1. Clean JSON brackets, leading numbers/bullets, trailing punctuation
            text = text.replace(/^[\[{\s"'`]+|[\]}\s"'`]+$/g, '').trim();
            text = text.replace(/^\d+[\s.)\-:]+/, '').trim();
            text = text.replace(/^[-*•]\s+/, '').trim();

            // 2. Remove ANY partial or full suffix that the AI might have started writing
            text = text.replace(/,?\s*professional\s+(sports|basketball|soccer|football|esports|cycling|motocross|volleyball|badminton|rugby|running|car wrap|athletic).*$/i, '').trim();
            text = text.replace(/,?\s*(dual split 50:50|one vertical half displays|the other vertical half is|isolated on solid|commercial sportswear|commercial automotive|clean-cut hard-edge|flat illustration style|minimalist monoline vector art|geometric silhouette vector art|negative space vector art|pure 100% flat 2d vector|razor-sharp hard-edge).*$/i, '').trim();
            text = text.replace(/[,.]\s*$/, '').trim();

            // 2.5 Collapse all line breaks and duplicate spaces into a single continuous line
            text = text.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();

            // 3. Strip redundant sport/jersey intro words if the AI included them at the start
            text = text.replace(/^(A sleek|A modern|A dynamic|A high-octane|An aerodynamic|A bold|An energetic|A vibrant)?\s*(basketball|soccer|football|futsal|esports|cycling|motocross|volleyball|badminton|rugby|running)?\s*(jersey|shirt|kit|tank top)\s*(design|featuring|showcasing|with)?\s*/i, '').trim();
            if (text.length > 0) {
              text = text.charAt(0).toUpperCase() + text.slice(1);
            }

            // 4. If text became too short or empty, provide high quality motif fallback
            if (text.length < 5) {
              const rawMotif = placeholder.originalConcept
                .replace(/(basketball|soccer|football|futsal|esports|cycling|motocross|volleyball|badminton|rugby|running|jersey|shirt|kit|tank top)/gi, '')
                .replace(/\s{2,}/g, ' ')
                .trim() || 'Dynamic fluid wave panels';
              text = `Dynamic aerodynamic ${rawMotif} with high-contrast geometric velocity styling`;
            }

            // 5. Append targetSuffix cleanly ONCE
            return `${text}, ${targetSuffix}`;
          })
          .filter(p => p.length > 0);
      }

      return {
        ...placeholder,
        prompts: parsedPrompts.slice(0, settings.numPrompts),
        hasError: false,
      };
    } catch (err: any) {
      const providerLabel = MODEL_PROVIDER_LABELS[getModelProvider(settings.selectedModel)];
      const errorMessageWithProvider = `[${providerLabel}] ${parseApiError(err)}`;
      logError(errorMessageWithProvider, settings.selectedModel, String(err), settings.styleOption);
      return {
        ...placeholder,
        prompts: [t('errorFailedToGeneratePromptsApiError', { displayName: placeholder.originalConcept, errorMessage: errorMessageWithProvider })],
        hasError: true,
      };
    }
  }, [settings, runModelCall, parseApiError, logError, t]);

  const processDualPhaseMultiItem = useCallback(async (
    placeholder: GeneratedPromptSet,
    layoutMeta: { layoutPrefix: string; slotCount: number },
    assignedKeyIndex?: number,
    countForThisJob: number = 1
  ): Promise<GeneratedPromptSet> => {
    try {
      const { layoutPrefix, slotCount } = layoutMeta;
      const half = Math.ceil(slotCount / 2);
      const chosenArtStyle = settings.vectorArtStyle || 'Flat illustration';
      const numPrompts = countForThisJob;
      const entropySeed = Math.random().toString(36).substring(2, 9);
      
      const parseItems = (raw: string): string[][] => {
        let text = raw.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1').trim();
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch (e) {
          console.warn("Failed to parse dual phase JSON", e);
        }

        const extractFromObj = (p: any): string[] => {
          if (typeof p !== 'object' || !p) return [];
          const itemKeys = Object.keys(p).filter(k => k.startsWith('item_')).sort((a, b) => {
            const numA = parseInt(a.replace('item_', ''), 10);
            const numB = parseInt(b.replace('item_', ''), 10);
            return numA - numB;
          });
          return itemKeys.map(k => {
            let v = String(p[k] || '').trim();
            v = v.replace(/^\d+[\s.)\-:]+/, '').trim(); // strip LLM's numbering
            v = v.replace(/^[-*•]\s+/, '').trim(); // strip bullets
            return v;
          }).filter(Boolean);
        };

        let results: string[][] = [];
        if (Array.isArray(parsed)) {
          results = parsed.map(extractFromObj);
        } else if (parsed && typeof parsed === 'object') {
          const firstArr = Object.values(parsed).find(v => Array.isArray(v));
          if (firstArr) {
            results = (firstArr as any[]).map(extractFromObj);
          } else {
            results = [extractFromObj(parsed)];
          }
        } else {
          // Regex fallback
          const regex = /"item_\d+"\s*:\s*"((?:[^"\\]|\\.)+)"/g;
          const extracted = [];
          let match;
          while ((match = regex.exec(text)) !== null) {
              let v = match[1].replace(/\\"/g, '"').replace(/\\n/g, ' ').trim();
              v = v.replace(/^\d+[\s.)\-:]+/, '').trim();
              v = v.replace(/^[-*•]\s+/, '').trim();
              if (v) extracted.push(v);
          }
          if (extracted.length > 0) results = [extracted];
        }

        while (results.length < numPrompts) {
          results.push([]);
        }
        return results;
      };

      // Generate the full system instruction that controls the actual visual style logic
      const isWhiteBg = settings.vectorWhiteBg ?? true;
      const systemInstruction = PromptBuilder.buildVectorTextPrompt(
        settings.negativePrompt,
        numPrompts,
        chosenArtStyle,
        settings.vectorPreset || 'Single Image',
        settings.vectorPose,
        settings.vectorAttributes,
        isWhiteBg,
        placeholder.originalConcept
      );

      // PHASE 1
      const phase1Text = await runModelCall(
        () => PromptBuilder.buildMultiItemPhase1Prompt(placeholder.originalConcept, slotCount, half, chosenArtStyle, numPrompts, entropySeed, systemInstruction),
        assignedKeyIndex
      );
      const phase1Items = parseItems(phase1Text);
      
      // Build context for phase 2 (first 5 words of each item)
      const phase1Context = phase1Items.map(itemsArr => {
        if (itemsArr.length === 0) return "no items";
        return itemsArr.map(v => v.split(' ').slice(0, 5).join(' ')).join(' | ');
      });

      // PHASE 2
      const provider = getModelProvider(settings.selectedModel);
      const providerKeys = (apiKeys[provider] ?? []);
      const nextKeyIndex = assignedKeyIndex !== undefined && providerKeys.length > 1
        ? (assignedKeyIndex + 1) % providerKeys.length
        : assignedKeyIndex;

      const phase2Text = await runModelCall(
        () => PromptBuilder.buildMultiItemPhase2Prompt(placeholder.originalConcept, slotCount, half, chosenArtStyle, numPrompts, entropySeed, phase1Context, systemInstruction),
        nextKeyIndex
      );
      const phase2Items = parseItems(phase2Text);

      // MERGE & APPLY SUFFIX
      const targetSuffix = PromptBuilder.getActiveVectorSuffix(chosenArtStyle, isWhiteBg, placeholder.originalConcept);

      const mergedPrompts = [];
      for (let i = 0; i < numPrompts; i++) {
        const p1 = phase1Items[i] || [];
        const p2 = phase2Items[i] || [];
        const combined = [...p1, ...p2];
        
        // STRICT VALIDATION
        if (combined.length < slotCount) {
          console.warn(`Dropped broken/incomplete multi-item prompt. Expected ${slotCount} items, got ${combined.length}.`);
          continue;
        }

        // Cleanup and re-number explicitly per item
        let text = combined.slice(0, slotCount).map((v, idx) => {
          let itemText = v.trim();
          itemText = itemText.replace(/^[\[{\s"'`]+|[\]}\s"'`]+$/g, '').trim();
          itemText = itemText.replace(/,?\s*professional\s+(sports|basketball|soccer|football|esports|cycling|motocross|volleyball|badminton|rugby|running|car wrap|athletic).*$/i, '').trim();
          itemText = itemText.replace(/,?\s*(dual split 50:50|one vertical half displays|the other vertical half is|isolated on solid|commercial sportswear|commercial automotive|clean-cut hard-edge|flat illustration style|minimalist monoline vector art|geometric silhouette vector art|negative space vector art|pure 100% flat 2d vector|razor-sharp hard-edge).*$/i, '').trim();
          itemText = itemText.replace(/[,.]\s*$/, '').trim();
          itemText = itemText.replace(/[\r\n]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
          itemText = itemText.replace(/^(A sleek|A modern|A dynamic|A high-octane|An aerodynamic|A bold|An energetic|A vibrant)?\s*(basketball|soccer|football|futsal|esports|cycling|motocross|volleyball|badminton|rugby|running)?\s*(jersey|shirt|kit|tank top)\s*(design|featuring|showcasing|with)?\s*/i, '').trim();
          return `${idx + 1}) ${itemText}`;
        }).join(' ');
        
        if (text.length > 0) {
          text = text.charAt(0).toUpperCase() + text.slice(1);
        }

        if (text.length > 120) {
          mergedPrompts.push(`${layoutPrefix}${text}, ${targetSuffix}`);
        }
      }

      return {
        ...placeholder,
        prompts: mergedPrompts.slice(0, numPrompts),
        hasError: false,
      };

    } catch (err: any) {
      const providerLabel = MODEL_PROVIDER_LABELS[getModelProvider(settings.selectedModel)];
      const errorMessageWithProvider = `[${providerLabel} Dual-Phase] ${parseApiError(err)}`;
      logError(errorMessageWithProvider, settings.selectedModel, String(err), settings.styleOption);
      return {
        ...placeholder,
        prompts: [t('errorFailedToGeneratePromptsApiError', { displayName: placeholder.originalConcept, errorMessage: errorMessageWithProvider })],
        hasError: true,
      };
    }
  }, [settings, runModelCall, apiKeys, parseApiError, logError, t]);

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
    const rawConcepts = settings.conceptsInput.split(/[\n,;]/).map(c => c.trim()).filter(Boolean);
    if (rawConcepts.length === 0) {
      setError(t('errorNoValidConceptsToProcess'));
      return { placeholders: [], jobs: [] };
    }

    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const numKeys = Math.max(1, providerKeys.length || settings.workerCount || 1);
    const totalRequested = Math.max(1, settings.numPrompts || 1);

    const placeholders = rawConcepts.map(concept => ({
      id: generateUuid(),
      originalConcept: concept,
      prompts: [],
      hasError: false,
      inputMode: 'text' as const,
    }));

    const jobs: GenerationJob[] = [];
    let globalKeyIdx = 0;

    rawConcepts.forEach((concept, cIdx) => {
      const placeholder = placeholders[cIdx];
      const chunksCount = Math.min(totalRequested, numKeys);
      const baseChunkSize = Math.floor(totalRequested / chunksCount);
      const remainder = totalRequested % chunksCount;

      const THEMATIC_PILLARS = [
        'Focus on dynamic action postures, ergonomic professional tools, and specialized artisan craft interactions',
        'Focus on atmospheric micro-moments, cozy storytelling narratives, and secondary sub-entities or species',
        'Focus on minimalist modern equipment, geometric planar compositions, and high-value commercial microstock scenes',
        'Focus on stylized isometric flatlays, unique iconic angles, and innovative non-cliché visual metaphors',
        'Focus on precision technical workflows, specialized machinery, and intricate functional props',
      ];

      for (let i = 0; i < chunksCount; i++) {
        const countForThisJob = baseChunkSize + (i < remainder ? 1 : 0);
        if (countForThisJob <= 0) continue;
        const assignedKey = globalKeyIdx % numKeys;
        const angle = THEMATIC_PILLARS[i % THEMATIC_PILLARS.length];

        jobs.push(() =>
          processAndGenerate(
            placeholder,
            () => PromptBuilder.buildTextPrompt(concept, { ...settings, numPrompts: countForThisJob, thematicAngle: angle }, isQuick),
            assignedKey
          )
        );
        globalKeyIdx += 1;
      }
    });

    return { placeholders, jobs };
  }, [settings, processAndGenerate, apiKeys, t]);

  const generateForVectorMode = useCallback((isQuick: boolean) => {
    const refImages = settings.vectorReferenceImages || [];
    const hasImages = refImages.length > 0;
    let rawConcepts = settings.conceptsInput.split(/[\n,;]/).map(c => c.trim()).filter(Boolean);

    if (rawConcepts.length === 0 && !hasImages) {
      setError(t('errorNoValidConceptsToProcess'));
      return { placeholders: [], jobs: [] };
    }

    const provider = getModelProvider(settings.selectedModel);
    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const numKeys = Math.max(1, providerKeys.length || settings.workerCount || 1);
    const totalRequested = Math.max(1, settings.numPrompts || 1);

    const THEMATIC_PILLARS = [
      'Focus on dynamic action postures, ergonomic professional tools, and specialized artisan craft interactions',
      'Focus on atmospheric micro-moments, cozy storytelling narratives, and secondary sub-entities or species',
      'Focus on minimalist modern equipment, geometric planar compositions, and high-value commercial microstock scenes',
      'Focus on stylized isometric flatlays, unique iconic angles, and innovative non-cliché visual metaphors',
      'Focus on precision technical workflows, specialized machinery, and intricate functional props',
    ];

    const placeholders: any[] = [];
    const jobs: GenerationJob[] = [];
    let globalKeyIdx = 0;

    if (hasImages) {
      // Multi-image mode: distribute total prompts evenly across images
      const imgCount = refImages.length;
      const basePerImage = Math.floor(totalRequested / imgCount);
      const extraImages = totalRequested % imgCount;

      refImages.forEach((imgDataUrl, imgIdx) => {
        const promptsForThisImage = basePerImage + (imgIdx < extraImages ? 1 : 0);
        if (promptsForThisImage <= 0) return;

        const placeholder = {
          id: generateUuid(),
          originalConcept: settings.vectorInstruction?.trim() || `Referensi #${imgIdx + 1}`,
          prompts: [],
          hasError: false,
          inputMode: 'vector' as const,
          thumbnailUrl: imgDataUrl,
        };
        placeholders.push(placeholder);

        const match = imgDataUrl.match(/^data:([^;]+);base64,(.+)$/);
        const mimeType = match ? match[1] : 'image/png';
        const data = match ? match[2] : imgDataUrl;

        // Split this image's prompts across available API keys
        const chunksCount = Math.min(promptsForThisImage, numKeys);
        const baseChunkSize = Math.floor(promptsForThisImage / chunksCount);
        const chunkRemainder = promptsForThisImage % chunksCount;

        for (let i = 0; i < chunksCount; i++) {
          const countForThisJob = baseChunkSize + (i < chunkRemainder ? 1 : 0);
          if (countForThisJob <= 0) continue;
          const assignedKey = globalKeyIdx % numKeys;

          jobs.push(() =>
            processAndGenerate(
              placeholder,
              () => PromptBuilder.buildImagePrompt({ data, mimeType }, { ...settings, styleOption: 'vector', numPrompts: countForThisJob, conceptsInput: settings.vectorInstruction || '', vectorAttributes: settings.vectorInstruction }, isQuick),
              assignedKey
            )
          );
          globalKeyIdx += 1;
        }
      });
    } else {
      // Text-only mode (no images)
      rawConcepts.forEach((concept, cIdx) => {
        const placeholder = {
          id: generateUuid(),
          originalConcept: concept,
          prompts: [],
          hasError: false,
          inputMode: 'vector' as const,
        };
        placeholders.push(placeholder);

        const chunksCount = Math.min(totalRequested, numKeys);
        const baseChunkSize = Math.floor(totalRequested / chunksCount);
        const remainder = totalRequested % chunksCount;

        const layoutMeta = PromptBuilder.getMultiItemLayoutMeta(settings.vectorPreset || '');
        const isMultiItem = layoutMeta !== null;

        for (let i = 0; i < chunksCount; i++) {
          const countForThisJob = baseChunkSize + (i < remainder ? 1 : 0);
          if (countForThisJob <= 0) continue;
          const assignedKey = globalKeyIdx % numKeys;
          const angle = THEMATIC_PILLARS[i % THEMATIC_PILLARS.length];

          if (isMultiItem && layoutMeta) {
            jobs.push(() =>
              processDualPhaseMultiItem(
                { ...placeholder, prompts: [] }, // pass fresh placeholder
                layoutMeta,
                assignedKey,
                countForThisJob
              )
            );
          } else {
            jobs.push(() =>
              processAndGenerate(
                placeholder,
                () => PromptBuilder.buildTextPrompt(concept, { ...settings, styleOption: 'vector', numPrompts: countForThisJob, thematicAngle: angle, vectorAttributes: settings.vectorInstruction }, isQuick),
                assignedKey
              )
            );
          }
          globalKeyIdx += 1;
        }
      });
    }

    return { placeholders, jobs };
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
    const provider = getModelProvider(settings.selectedModel);
    if (!isProviderInitialized(provider)) {
      const providerLabel = MODEL_PROVIDER_LABELS[provider];
      setError(`Please add your ${providerLabel} API key before generating.`);
      return;
    }
    if (!isModelSupportedForMode(settings.selectedModel, settings.inputMode)) {
      setError(`${settings.selectedModel} does not support ${settings.inputMode} mode.`);
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

    const providerKeys = (apiKeys[provider] ?? []).filter((k): k is string => typeof k === 'string' && k.trim().length > 0);
    const workerCount = Math.max(1, Math.min(50, Math.max(settings.workerCount || 1, providerKeys.length || 1)));
    const batchDelaySeconds = Math.max(0, Math.min(300, settings.batchDelaySeconds || 0));

    setGeneratedPromptSets(generationTask.placeholders.map(p => ({ ...p })));
    setActiveWorkersCount(workerCount);
    setTotalJobsCount(generationTask.jobs.length);
    setCompletedJobsCount(0);
    setActivityLogs([]);
    addActivityLog(`Memulai proses ${generationTask.jobs.length} tugas di ${workerCount} worker paralel (${MODEL_PROVIDER_LABELS[provider]})...`, 'info');

    let finishedCount = 0;
    for (let startIndex = 0; startIndex < generationTask.jobs.length; startIndex += workerCount) {
      const batch = generationTask.jobs.slice(startIndex, startIndex + workerCount);

      await Promise.all(batch.map(async (job, idx) => {
        const workerIndex = (startIndex + idx) % workerCount + 1;
        const conceptName = generationTask!.placeholders[0]?.originalConcept || '';
        setCurrentProcessingConcept(conceptName);
        addActivityLog(`Worker #${workerIndex}: Sedang memproses "${conceptName}"...`, 'info', workerIndex);

        const result = await job();
        finishedCount += 1;
        setCompletedJobsCount(finishedCount);

        if (result.hasError) {
          addActivityLog(`Worker #${workerIndex}: Gagal memproses "${conceptName}"`, 'error', workerIndex);
        } else {
          addActivityLog(`Worker #${workerIndex}: Berhasil membuat ${result.prompts.length} prompt untuk "${conceptName}"`, 'success', workerIndex);
        }

        if (generationIdRef.current === currentGenerationId) {
          setGeneratedPromptSets(prev => prev.map(card => {
            if (card.id === result.id) {
              return {
                ...card,
                prompts: [...card.prompts, ...result.prompts],
                hasError: card.hasError || result.hasError,
              };
            }
            return card;
          }));
        }
        return result;
      }));

      if (generationIdRef.current !== currentGenerationId) return;

      const hasMoreBatches = startIndex + workerCount < generationTask.jobs.length;
      if (hasMoreBatches && batchDelaySeconds > 0) {
        addActivityLog(`Menunggu jeda batch ${batchDelaySeconds} detik...`, 'info');
        await waitForBatchDelay(batchDelaySeconds);
        if (generationIdRef.current !== currentGenerationId) return;
      }
    }

    if (generationIdRef.current !== currentGenerationId) return;

    addActivityLog(`Semua proses berhasil diselesaikan!`, 'success');
    setIsLoading(false);

    setGeneratedPromptSets(currentSets => {
      if (currentSets.some(s => !s.hasError && s.prompts.length > 0)) {
        const currentSettings: GenerationSettings = {
          ...settings,
          conceptsInput: (settings.inputMode === 'text' || settings.inputMode === 'vector') ? settings.conceptsInput : '',
          imageNames: settings.inputMode === 'image' ? uploadedImages.map(img => img.name) : [],
          videoNames: settings.inputMode === 'video' ? videoProcessor.uploadedVideos.map(v => v.name) : [],
        };
        saveHistory([{ id: Date.now(), timestamp: Date.now(), settings: currentSettings, sets: currentSets, folderId: settings.targetFolderId || null }, ...history]);
      }
      return currentSets;
    });
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

import { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_API_KEY_CHECK_MODEL, GROQ_API_KEY_CHECK_MODEL, MISTRAL_API_KEY_CHECK_MODEL, OPENROUTER_API_KEY_CHECK_MODEL, getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';
import { checkApiKeyOnline } from '../lib/apiClient';

export type ProviderApiKeys = Record<ModelProvider, string[]>;
export type ProviderApiStatus = Record<ModelProvider, boolean>;

const emptyApiKeys: ProviderApiKeys = {
  google: [],
  groq: [],
  mistral: [],
  openrouter: [],
  github: [],
};

const emptyApiStatus: ProviderApiStatus = {
  google: true,
  groq: true,
  mistral: true,
  openrouter: true,
  github: true,
};

const providerStorageKeys: Record<ModelProvider, string> = {
  google: 'gemini_api_keys',
  groq: 'groq_api_keys',
  mistral: 'mistral_api_keys',
  openrouter: 'openrouter_api_keys',
  github: 'github_api_keys',
};

const legacyProviderStorageKeys: Record<ModelProvider, string> = {
  google: 'gemini_api_key',
  groq: 'groq_api_key',
  mistral: 'mistral_api_key',
  openrouter: 'openrouter_api_key',
  github: 'github_api_key',
};

export const normalizeApiKeyList = (value: string | string[] | null | undefined): string[] => {
 const rawKeys = Array.isArray(value)
 ? value
 : String(value ?? '').split(/\r?\n|,/);
 return Array.from(new Set(rawKeys.map(key => key.trim()).filter(Boolean)));
};

const getApiErrorText = (error: unknown): string => {
 if (error instanceof Error) return error.message.toLowerCase();
 if (typeof error === 'string') return error.toLowerCase();
 if (typeof error === 'object' && error !== null && 'message' in error) {
 return String((error as any).message).toLowerCase();
 }
 return '';
};

const isApiLimitError = (error: unknown): boolean => {
 const message = getApiErrorText(error);
 return (
 message.includes('rate limit') ||
 message.includes('429') ||
 message.includes('quota') ||
 message.includes('resource exhausted') ||
 message.includes('limit exceeded')
 );
};

export type ApiKeyCheckResult = {
 success: boolean;
 message?: string;
 reason?: 'valid' | 'limited' | 'invalid';
};

const readProviderKeysFromStorage = (provider: ModelProvider): string[] => {
 if (typeof localStorage === 'undefined') return [];

 const storedList = localStorage.getItem(providerStorageKeys[provider]);
 if (storedList) {
 try {
 const parsed = JSON.parse(storedList);
 return normalizeApiKeyList(Array.isArray(parsed) ? parsed : storedList);
 } catch {
 return normalizeApiKeyList(storedList);
 }
 }

 return normalizeApiKeyList(localStorage.getItem(legacyProviderStorageKeys[provider]));
};

export const readStoredProviderApiKeys = (): ProviderApiKeys => ({
  google: readProviderKeysFromStorage('google'),
  groq: readProviderKeysFromStorage('groq'),
  mistral: readProviderKeysFromStorage('mistral'),
  openrouter: readProviderKeysFromStorage('openrouter'),
  github: readProviderKeysFromStorage('github'),
});

const writeProviderKeysToStorage = (provider: ModelProvider, keys: string[]) => {
  if (typeof localStorage === 'undefined') return;

  if (keys.length > 0) {
    localStorage.setItem(providerStorageKeys[provider], JSON.stringify(keys));
  } else {
    localStorage.removeItem(providerStorageKeys[provider]);
  }
  localStorage.removeItem(legacyProviderStorageKeys[provider]);
};

export const useGemini = (t: (key: any, params?: any) => string) => {
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [apiKeys, setApiKeys] = useState<ProviderApiKeys>(emptyApiKeys);
  const [apiStatus, setApiStatus] = useState<ProviderApiStatus>(emptyApiStatus);
  const apiKeyInput = apiKeys.google[0] ?? '';
  const isApiInitialized = apiStatus.google || apiStatus.groq || apiStatus.mistral || apiStatus.openrouter || apiStatus.github;

 const parseApiError = useCallback((error: unknown): string => {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('[object progressevent]')) {
                return "Koneksi gagal atau terblokir kebijakan keamanan browser (CORS). Endpoint provider ini tidak mengizinkan pemanggilan langsung dari browser. Sangat disarankan menggunakan provider resmi yang mendukung browser langsung seperti Google Gemini (Gemini 2.5 Flash), Groq (Llama 3.1), Mistral, atau OpenRouter.";
            }
            if (
                message.includes('api key not valid') ||
                message.includes('invalid api key') ||
                message.includes('invalid_api_key') ||
                message.includes('unauthorized') ||
                message.includes('401') ||
                (message.includes('400') && (message.includes('api key') || message.includes('permission denied')))
            ) {
                return t('errorApiKeyInvalid');
            }
            if (
                message.includes('rate limit') ||
                message.includes('429') ||
                message.includes('quota') ||
                message.includes('resource exhausted') ||
                message.includes('limit exceeded')
            ) {
                return t('errorRateLimitExceeded');
            }
            if (message.includes('model_not_found') || message.includes('does not exist')) {
                return "Model tidak ditemukan atau API Key tidak sesuai dengan provider yang dipilih. Pastikan Anda memilih model dari provider yang sesuai dengan API Key Anda (misal: model Gemini jika punya API Key Google, model Mistral jika punya API Key Mistral, atau model Groq jika punya API Key Groq).";
            }
            if (message.includes('candidate was blocked due to safety') || message.includes('content policy')) {
                return t('errorContentPolicyViolation');
            }
            
            if (message.includes('<!doctype html') || message.includes('<html')) {
                const titleMatch = error.message.match(/<title>(.*?)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                    return `API Error: ${titleMatch[1].trim()}`;
                }
                return "API Service Error: The provider's web server returned an HTML error page (e.g., 502 Bad Gateway or 520 Unknown Error). The service might be temporarily down.";
            }

            return error.message;
        }
        if (typeof error === 'object' && error !== null) {
            if (error instanceof ProgressEvent || error.toString() === '[object ProgressEvent]') {
                return t('errorNetworkOrCors');
            }
            if ('message' in error) {
                return String((error as any).message);
            }
        }
        if (typeof error === 'string') return error;

 return t('unknownErrorOccurred');
 }, [t]);

 const initializeGoogleApi = useCallback((keys: string[] | string): boolean => {
 const normalizedKeys = normalizeApiKeyList(keys);
 if (normalizedKeys.length > 0) {
 try {
 const genAi = new GoogleGenAI({ apiKey: normalizedKeys[0] });
 setAi(genAi);
 setApiStatus(status => ({ ...status, google: true }));
 return true;
 } catch (error) {
 console.error("Failed to initialize GoogleGenAI:", error);
 setAi(null);
 setApiStatus(status => ({ ...status, google: false }));
 return false;
 }
 }
 setAi(null);
 setApiStatus(status => ({ ...status, google: false }));
 return false;
 }, []);

 const initializeGroqApi = useCallback((keys: string[] | string): boolean => {
 const isValid = normalizeApiKeyList(keys).length > 0;
 setApiStatus(status => ({ ...status, groq: isValid }));
 return isValid;
 }, []);

 const initializeMistralApi = useCallback((keys: string[] | string): boolean => {
 const isValid = normalizeApiKeyList(keys).length > 0;
 setApiStatus(status => ({ ...status, mistral: isValid }));
 return isValid;
 }, []);

  const initializeOpenRouterApi = useCallback((keys: string[] | string): boolean => {
    const isValid = normalizeApiKeyList(keys).length > 0;
    setApiStatus(status => ({ ...status, openrouter: isValid }));
    return isValid;
  }, []);

  const initializeGitHubApi = useCallback((keys: string[] | string): boolean => {
    const isValid = normalizeApiKeyList(keys).length > 0;
    setApiStatus(status => ({ ...status, github: isValid }));
    return isValid;
  }, []);

  const initializeApi = useCallback((key: string): boolean => {
    return initializeGoogleApi(key);
  }, [initializeGoogleApi]);
  
  const handleSaveApiKey = useCallback((key: string, isSilent: boolean = false) => {
    const normalizedKeys = normalizeApiKeyList(key);
    setApiKeys(keys => ({ ...keys, google: normalizedKeys }));
    initializeGoogleApi(normalizedKeys);
    writeProviderKeysToStorage('google', normalizedKeys);
  }, [initializeGoogleApi]);

  const handleSaveApiKeys = useCallback((keys: ProviderApiKeys) => {
    const normalizedKeys: ProviderApiKeys = {
      google: normalizeApiKeyList(keys.google),
      groq: normalizeApiKeyList(keys.groq),
      mistral: normalizeApiKeyList(keys.mistral),
      openrouter: normalizeApiKeyList(keys.openrouter ?? []),
      github: normalizeApiKeyList(keys.github ?? []),
    };

    setApiKeys(normalizedKeys);
    initializeGoogleApi(normalizedKeys.google);
    initializeGroqApi(normalizedKeys.groq);
    initializeMistralApi(normalizedKeys.mistral);
    initializeOpenRouterApi(normalizedKeys.openrouter);
    initializeGitHubApi(normalizedKeys.github);
    writeProviderKeysToStorage('google', normalizedKeys.google);
    writeProviderKeysToStorage('groq', normalizedKeys.groq);
    writeProviderKeysToStorage('mistral', normalizedKeys.mistral);
    writeProviderKeysToStorage('openrouter', normalizedKeys.openrouter);
    writeProviderKeysToStorage('github', normalizedKeys.github);
  }, [initializeGoogleApi, initializeGroqApi, initializeMistralApi, initializeOpenRouterApi, initializeGitHubApi]);

  const handleSaveProviderApiKey = useCallback((provider: ModelProvider, key: string | string[], isSilent: boolean = false) => {
    const normalizedKeys = normalizeApiKeyList(key);
    setApiKeys(keys => ({ ...keys, [provider]: normalizedKeys }));
    if (provider === 'google') {
      initializeGoogleApi(normalizedKeys);
    } else if (provider === 'groq') {
      initializeGroqApi(normalizedKeys);
    } else if (provider === 'openrouter') {
      initializeOpenRouterApi(normalizedKeys);
    } else if (provider === 'github') {
      initializeGitHubApi(normalizedKeys);
    } else {
      initializeMistralApi(normalizedKeys);
    }
    writeProviderKeysToStorage(provider, normalizedKeys);
  }, [initializeGoogleApi, initializeGroqApi, initializeMistralApi, initializeOpenRouterApi, initializeGitHubApi]);

  const handleCheckProviderApiKey = useCallback(async (provider: ModelProvider, key: string, _checkModel?: ApiModel): Promise<ApiKeyCheckResult> => {
    if (!key) return { success: false, message: t('errorApiKeyInvalid') };
    const res = await checkApiKeyOnline(provider, key);
    return {
      success: res.success,
      reason: res.reason,
      message: res.message,
    };
  }, [t]);

  const handleCheckApiKey = useCallback(async (key: string): Promise<ApiKeyCheckResult> => {
    return handleCheckProviderApiKey('google', key);
  }, [handleCheckProviderApiKey]);

    const handleRemoveDeadApiKey = useCallback((provider: ModelProvider, deadKey: string, reason?: string) => {
        const trimmed = deadKey.trim();
        if (!trimmed) return;

        setApiKeys(prev => {
            const currentList = prev[provider] ?? [];
            const updatedList = currentList.filter(k => k.trim() !== trimmed);
            
            writeProviderKeysToStorage(provider, updatedList);
            
            if (provider === 'google') {
                initializeGoogleApi(updatedList);
            } else if (provider === 'groq') {
                initializeGroqApi(updatedList);
            } else if (provider === 'mistral') {
                initializeMistralApi(updatedList);
            } else if (provider === 'openrouter') {
                initializeOpenRouterApi(updatedList);
            } else if (provider === 'github') {
                initializeGitHubApi(updatedList);
            }

            console.warn(`[Auto-Remove Dead API Key] Removed ${provider} key "${trimmed.slice(0, 6)}...${trimmed.slice(-4)}" (Reason: ${reason || 'Dead/Invalid'})`);
            return {
                ...prev,
                [provider]: updatedList,
            };
        });
    }, [initializeGoogleApi, initializeGroqApi, initializeMistralApi, initializeOpenRouterApi, initializeGitHubApi]);

    const isProviderInitialized = useCallback((_provider: ModelProvider): boolean => {
        return true;
    }, []);

    return {
        ai,
        isApiInitialized,
        isProviderInitialized,
        apiKeyInput,
        apiKeys,
        apiStatus,
        initializeApi,
        handleSaveApiKey,
        handleSaveApiKeys,
        handleSaveProviderApiKey,
        handleRemoveDeadApiKey,
        handleCheckApiKey,
        handleCheckProviderApiKey,
        parseApiError,
    };
};

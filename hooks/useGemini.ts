import { useState, useCallback } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_API_KEY_CHECK_MODEL, GROQ_API_KEY_CHECK_MODEL, MISTRAL_API_KEY_CHECK_MODEL, OPENROUTER_API_KEY_CHECK_MODEL, getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';

export type ProviderApiKeys = Record<ModelProvider, string[]>;
export type ProviderApiStatus = Record<ModelProvider, boolean>;

const emptyApiKeys: ProviderApiKeys = {
 google: [],
 groq: [],
 mistral: [],
 openrouter: [],
};

const emptyApiStatus: ProviderApiStatus = {
 google: false,
 groq: false,
 mistral: false,
 openrouter: false,
};

const providerStorageKeys: Record<ModelProvider, string> = {
 google: 'gemini_api_keys',
 groq: 'groq_api_keys',
 mistral: 'mistral_api_keys',
 openrouter: 'openrouter_api_keys',
};

const legacyProviderStorageKeys: Record<ModelProvider, string> = {
 google: 'gemini_api_key',
 groq: 'groq_api_key',
 mistral: 'mistral_api_key',
 openrouter: 'openrouter_api_key',
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
 const isApiInitialized = apiStatus.google || apiStatus.groq || apiStatus.mistral || apiStatus.openrouter;

 const parseApiError = useCallback((error: unknown): string => {
        if (error instanceof Error) {
            const message = error.message.toLowerCase();
            if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('[object progressevent]')) {
                return t('errorNetworkOrCors');
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
 };

 setApiKeys(normalizedKeys);
 initializeGoogleApi(normalizedKeys.google);
 initializeGroqApi(normalizedKeys.groq);
 initializeMistralApi(normalizedKeys.mistral);
 initializeOpenRouterApi(normalizedKeys.openrouter);
 writeProviderKeysToStorage('google', normalizedKeys.google);
 writeProviderKeysToStorage('groq', normalizedKeys.groq);
 writeProviderKeysToStorage('mistral', normalizedKeys.mistral);
 writeProviderKeysToStorage('openrouter', normalizedKeys.openrouter);
 }, [initializeGoogleApi, initializeGroqApi, initializeMistralApi, initializeOpenRouterApi]);

 const handleSaveProviderApiKey = useCallback((provider: ModelProvider, key: string | string[], isSilent: boolean = false) => {
 const normalizedKeys = normalizeApiKeyList(key);
 setApiKeys(keys => ({ ...keys, [provider]: normalizedKeys }));
 if (provider === 'google') {
 initializeGoogleApi(normalizedKeys);
 } else if (provider === 'groq') {
 initializeGroqApi(normalizedKeys);
 } else if (provider === 'openrouter') {
 initializeOpenRouterApi(normalizedKeys);
 } else {
 initializeMistralApi(normalizedKeys);
 }
 writeProviderKeysToStorage(provider, normalizedKeys);
 }, [initializeGoogleApi, initializeGroqApi, initializeMistralApi, initializeOpenRouterApi]);

 const handleCheckApiKey = useCallback(async (key: string): Promise<ApiKeyCheckResult> => {
 if (!key) return { success: false, message: t('errorApiKeyInvalid') };
 try {
 const tempAi = new GoogleGenAI({ apiKey: key.trim() });
 await tempAi.models.generateContent({
 model: GOOGLE_API_KEY_CHECK_MODEL,
 contents: 'test',
 config: { thinkingConfig: { thinkingBudget: 0 } }
 });
 return { success: true, reason: 'valid' };
 } catch (error) {
 console.error("API Key check failed:", error);
 return {
 success: false,
 message: parseApiError(error),
 reason: isApiLimitError(error) ? 'limited' : 'invalid',
 };
 }
 }, [t, parseApiError]);

 const handleCheckProviderApiKey = useCallback(async (provider: ModelProvider, key: string, checkModel?: ApiModel): Promise<ApiKeyCheckResult> => {
 if (!key) return { success: false, message: t('errorApiKeyInvalid') };
 if (provider === 'google') return handleCheckApiKey(key);

 const providerCheckModel = provider === 'groq' && checkModel && getModelProvider(checkModel) === 'groq'
 ? checkModel
 : provider === 'mistral' && checkModel && getModelProvider(checkModel) === 'mistral'
 ? checkModel
 : provider === 'openrouter' && checkModel && getModelProvider(checkModel) === 'openrouter'
 ? checkModel
 : provider === 'groq'
 ? GROQ_API_KEY_CHECK_MODEL
 : provider === 'openrouter'
 ? OPENROUTER_API_KEY_CHECK_MODEL
 : MISTRAL_API_KEY_CHECK_MODEL;
 const endpoint = provider === 'groq'
 ? 'https://api.groq.com/openai/v1/chat/completions'
 : provider === 'openrouter'
 ? 'https://openrouter.ai/api/v1/chat/completions'
 : 'https://api.mistral.ai/v1/chat/completions';
 const providerLabel = provider === 'groq' ? 'Groq' : provider === 'openrouter' ? 'OpenRouter' : 'Mistral';
 const extraHeaders: Record<string, string> = provider === 'openrouter'
 ? { 'HTTP-Referer': 'https://sebelaspromptgen.app', 'X-Title': 'SebelasPromptGen' }
 : {};

 try {
 const response = await fetch(endpoint, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${key.trim()}`,
 'Content-Type': 'application/json',
 ...extraHeaders,
 },
 body: JSON.stringify({
 model: providerCheckModel,
 messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
 max_tokens: 512,
 temperature: 0,
 }),
 });

 if (!response.ok) {
 const errorText = await response.text();
 throw new Error(`${response.status} ${errorText || `${providerLabel} API request failed with status ${response.status}`}`);
 }

 const payload = await response.json();
 const responseText = payload?.choices?.[0]?.message?.content;
 if (typeof responseText !== 'string' || responseText.trim().length === 0) {
 throw new Error(`${providerLabel} API check did not return valid text.`);
 }

 return { success: true, reason: 'valid' };
 } catch (error) {
 console.error(`${providerLabel} API Key check failed:`, error);
 return {
 success: false,
 message: parseApiError(error),
 reason: isApiLimitError(error) ? 'limited' : 'invalid',
            };
        }
    }, [handleCheckApiKey, parseApiError, t]);

    const isProviderInitialized = useCallback((provider: ModelProvider): boolean => {
        return apiStatus[provider];
    }, [apiStatus]);

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
        handleCheckApiKey,
        handleCheckProviderApiKey,
        parseApiError,
    };
};

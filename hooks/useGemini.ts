import { useState, useCallback } from 'react';
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
  google: false,
  groq: false,
  mistral: false,
  openrouter: false,
  github: false,
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
  try {
    localStorage.setItem(providerStorageKeys[provider], JSON.stringify(keys));
  } catch (error) {
    console.error(`Failed to save ${provider} API keys to localStorage:`, error);
  }
};

export const useGemini = (t: (key: string, params?: Record<string, string | number>) => string) => {
  const [ai, setAi] = useState<any>(null);
  const [apiKeys, setApiKeys] = useState<ProviderApiKeys>(() => readStoredProviderApiKeys());
  const [apiStatus, setApiStatus] = useState<ProviderApiStatus>(() => {
    const keys = readStoredProviderApiKeys();
    return {
      google: keys.google.length > 0,
      groq: keys.groq.length > 0,
      mistral: keys.mistral.length > 0,
      openrouter: keys.openrouter.length > 0,
      github: keys.github.length > 0,
    };
  });

  const parseApiError = useCallback((error: unknown): string => {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    return t('unknownErrorOccurred');
  }, [t]);

  const handleSaveApiKeys = useCallback((keys: ProviderApiKeys) => {
    const normalizedKeys: ProviderApiKeys = {
      google: normalizeApiKeyList(keys.google),
      groq: normalizeApiKeyList(keys.groq),
      mistral: normalizeApiKeyList(keys.mistral),
      openrouter: normalizeApiKeyList(keys.openrouter ?? []),
      github: normalizeApiKeyList(keys.github ?? []),
    };

    setApiKeys(normalizedKeys);
    setApiStatus({
      google: normalizedKeys.google.length > 0,
      groq: normalizedKeys.groq.length > 0,
      mistral: normalizedKeys.mistral.length > 0,
      openrouter: normalizedKeys.openrouter.length > 0,
      github: normalizedKeys.github.length > 0,
    });

    writeProviderKeysToStorage('google', normalizedKeys.google);
    writeProviderKeysToStorage('groq', normalizedKeys.groq);
    writeProviderKeysToStorage('mistral', normalizedKeys.mistral);
    writeProviderKeysToStorage('openrouter', normalizedKeys.openrouter);
    writeProviderKeysToStorage('github', normalizedKeys.github);
  }, []);

  const handleSaveProviderApiKey = useCallback((provider: ModelProvider, key: string | string[], _isSilent: boolean = false) => {
    const normalizedKeys = normalizeApiKeyList(key);
    setApiKeys(keys => ({ ...keys, [provider]: normalizedKeys }));
    setApiStatus(status => ({ ...status, [provider]: normalizedKeys.length > 0 }));
    writeProviderKeysToStorage(provider, normalizedKeys);
  }, []);

  const handleSaveApiKey = useCallback((key: string, isSilent: boolean = false) => {
    handleSaveProviderApiKey('google', key, isSilent);
  }, [handleSaveProviderApiKey]);

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

  const handleRemoveDeadApiKey = useCallback((provider: ModelProvider, deadKey: string) => {
    const trimmed = deadKey.trim();
    if (!trimmed) return;

    setApiKeys(prev => {
      const currentList = prev[provider] ?? [];
      const updatedList = currentList.filter(k => k.trim() !== trimmed);
      writeProviderKeysToStorage(provider, updatedList);
      setApiStatus(status => ({ ...status, [provider]: updatedList.length > 0 }));
      return {
        ...prev,
        [provider]: updatedList,
      };
    });
  }, []);

  const isProviderInitialized = useCallback((provider: ModelProvider): boolean => {
    return apiStatus[provider];
  }, [apiStatus]);

  const isApiInitialized = Object.values(apiStatus).some(Boolean);

  return {
    ai,
    isApiInitialized,
    apiKeys,
    apiStatus,
    initializeApi: () => false,
    handleSaveApiKey,
    handleSaveApiKeys,
    handleSaveProviderApiKey,
    handleCheckApiKey,
    handleCheckProviderApiKey,
    handleRemoveDeadApiKey,
    isProviderInitialized,
    parseApiError,
  };
};

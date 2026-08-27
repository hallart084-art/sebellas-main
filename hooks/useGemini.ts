import { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_API_KEY_CHECK_MODEL } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';
import { resolveDefaultGoogleApiKey } from '../lib/apiClient';

export type ProviderApiKeys = Record<ModelProvider, string[]>;
export type ProviderApiStatus = Record<ModelProvider, boolean>;

const emptyApiKeys: ProviderApiKeys = {
  google: [],
};

const emptyApiStatus: ProviderApiStatus = {
  google: false,
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

export const readStoredProviderApiKeys = (): ProviderApiKeys => {
  let keys: string[] = [];
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('gemini_api_keys') || localStorage.getItem('gemini_api_key');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        keys = normalizeApiKeyList(Array.isArray(parsed) ? parsed : stored);
      } catch {
        keys = normalizeApiKeyList(stored);
      }
    }
  }

  const defaultEnvKey = resolveDefaultGoogleApiKey();
  if (defaultEnvKey && !keys.includes(defaultEnvKey)) {
    keys = [defaultEnvKey, ...keys];
  }

  return {
    google: keys,
  };
};

const writeProviderKeysToStorage = (keys: string[]) => {
  if (typeof localStorage === 'undefined') return;
  if (keys.length > 0) {
    localStorage.setItem('gemini_api_keys', JSON.stringify(keys));
  } else {
    localStorage.removeItem('gemini_api_keys');
  }
  localStorage.removeItem('gemini_api_key');
};

export const useGemini = (t: (key: any, params?: any) => string) => {
  const [ai, setAi] = useState<GoogleGenAI | null>(null);
  const [apiKeys, setApiKeys] = useState<ProviderApiKeys>(readStoredProviderApiKeys);
  const [apiStatus, setApiStatus] = useState<ProviderApiStatus>(() => ({
    google: Boolean(apiKeys.google.length > 0 || resolveDefaultGoogleApiKey()),
  }));

  const apiKeyInput = apiKeys.google[0] ?? resolveDefaultGoogleApiKey();
  const isApiInitialized = apiStatus.google || Boolean(resolveDefaultGoogleApiKey());

  const parseApiError = useCallback((error: unknown): string => {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('[object progressevent]')) {
        return "Koneksi ke Google AI Studio gagal. Periksa koneksi internet Anda.";
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
      return error.message;
    }
    if (typeof error === 'string') return error;
    return t('unknownErrorOccurred');
  }, [t]);

  const initializeGoogleApi = useCallback((keys: string[] | string): boolean => {
    const normalizedKeys = normalizeApiKeyList(keys);
    const effectiveKey = normalizedKeys[0] || resolveDefaultGoogleApiKey();
    if (effectiveKey) {
      try {
        const genAi = new GoogleGenAI({ apiKey: effectiveKey });
        setAi(genAi);
        setApiStatus({ google: true });
        return true;
      } catch (error) {
        console.error("Failed to initialize GoogleGenAI:", error);
      }
    }
    setAi(null);
    setApiStatus({ google: Boolean(resolveDefaultGoogleApiKey()) });
    return Boolean(resolveDefaultGoogleApiKey());
  }, []);

  const initializeApi = useCallback((key: string): boolean => {
    return initializeGoogleApi(key);
  }, [initializeGoogleApi]);

  const handleSaveApiKey = useCallback((key: string) => {
    const normalizedKeys = normalizeApiKeyList(key);
    setApiKeys({ google: normalizedKeys });
    initializeGoogleApi(normalizedKeys);
    writeProviderKeysToStorage(normalizedKeys);
  }, [initializeGoogleApi]);

  const handleSaveApiKeys = useCallback((keys: ProviderApiKeys) => {
    const normalized = normalizeApiKeyList(keys.google);
    setApiKeys({ google: normalized });
    initializeGoogleApi(normalized);
    writeProviderKeysToStorage(normalized);
  }, [initializeGoogleApi]);

  const handleSaveProviderApiKey = useCallback((_provider: ModelProvider, key: string | string[]) => {
    handleSaveApiKey(Array.isArray(key) ? key.join('\n') : key);
  }, [handleSaveApiKey]);

  const handleCheckApiKey = useCallback(async (key: string): Promise<ApiKeyCheckResult> => {
    const trimmed = (key && key.trim()) || resolveDefaultGoogleApiKey();
    if (!trimmed) return { success: false, message: t('errorApiKeyInvalid') };
    const isBearer = trimmed.startsWith('AQ.') || trimmed.startsWith('ya29.');

    if (isBearer) {
      try {
        const restRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${trimmed}`,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }],
          }),
        });

        if (restRes.ok) {
          return { success: true, reason: 'valid' };
        }

        const errText = await restRes.text();
        throw new Error(`${restRes.status} ${errText}`);
      } catch (err) {
        console.error("Bearer token check failed:", err);
        return {
          success: false,
          message: parseApiError(err),
          reason: isApiLimitError(err) ? 'limited' : 'invalid',
        };
      }
    }

    try {
      const tempAi = new GoogleGenAI({ apiKey: trimmed });
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

  const handleCheckProviderApiKey = useCallback(async (_provider: ModelProvider, key: string, _checkModel?: ApiModel): Promise<ApiKeyCheckResult> => {
    return handleCheckApiKey(key);
  }, [handleCheckApiKey]);

  const handleRemoveDeadApiKey = useCallback((_provider: ModelProvider, deadKey: string, _reason?: string) => {
    const trimmed = deadKey.trim();
    if (!trimmed) return;

    setApiKeys(prev => {
      const updatedList = (prev.google ?? []).filter(k => k.trim() !== trimmed);
      writeProviderKeysToStorage(updatedList);
      initializeGoogleApi(updatedList);
      return { google: updatedList };
    });
  }, [initializeGoogleApi]);

  const isProviderInitialized = useCallback((_provider: ModelProvider): boolean => {
    return apiStatus.google || Boolean(resolveDefaultGoogleApiKey());
  }, [apiStatus]);

  useEffect(() => {
    const initialKeys = readStoredProviderApiKeys();
    setApiKeys(initialKeys);
    initializeGoogleApi(initialKeys.google);
  }, [initializeGoogleApi]);

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

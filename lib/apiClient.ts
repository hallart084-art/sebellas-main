import { GoogleGenAI } from '@google/genai';
import type { ApiModel } from '../constants';

export type GeneratePromptRequest = {
  model: ApiModel;
  contents: any;
  config: any;
  apiKey?: string;
  isXmlQuality?: boolean;
};

export class ApiRequestError extends Error {
  status?: number;
  responseText?: string;

  constructor(message: string, status?: number, responseText?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.responseText = responseText;
  }
}

export class EmptyResponseError extends Error {
  constructor(providerLabel: string = 'Google AI Studio') {
    super(`${providerLabel} API response did not yield valid text.`);
    this.name = 'EmptyResponseError';
  }
}

export class TruncatedResponseError extends EmptyResponseError {
  constructor(providerLabel: string = "Google AI Studio") {
    super(providerLabel);
    this.message = `${providerLabel} response was truncated (output token limit reached).`;
    this.name = 'TruncatedResponseError';
  }
}

/** Patterns in error messages that indicate the API returned no usable content. */
const EMPTY_RESPONSE_PATTERNS = [
  'did not yield valid text',
  'did not include valid text',
  'no text parts',
  'empty response',
  'response was empty',
  'no candidates',
  'content has no parts',
  'content is not available',
];

export const isTransientEmptyResponseError = (error: unknown): boolean => {
  if (error instanceof EmptyResponseError) return true;
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return EMPTY_RESPONSE_PATTERNS.some(p => msg.includes(p));
  }
  return false;
};

const getErrorText = (error: unknown): string => {
  if (error instanceof ApiRequestError) {
    return `${error.status ?? ''} ${error.message} ${error.responseText ?? ''}`.toLowerCase();
  }
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'string') return error.toLowerCase();
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as any).message).toLowerCase();
  }
  return '';
};

export const shouldRotateApiKeyOnError = (error: unknown): boolean => {
  const text = getErrorText(error);
  return (
    text.includes('402') ||
    text.includes('more credits') ||
    text.includes('can only afford') ||
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('quota') ||
    text.includes('resource exhausted') ||
    text.includes('limit exceeded') ||
    text.includes('api key not valid') ||
    text.includes('invalid api key') ||
    text.includes('invalid_api_key') ||
    text.includes('unauthorized') ||
    text.includes('401') ||
    (text.includes('400') && (text.includes('api key') || text.includes('permission denied')))
  );
};

export const resolveDefaultGoogleApiKey = (): string => {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('gemini_api_keys') || localStorage.getItem('gemini_api_key');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]) {
            return String(parsed[0]).trim();
          }
        } catch {
          if (stored.trim()) return stored.trim();
        }
      }
    }
  } catch (e) {
    // ignore localStorage errors
  }

  try {
    if (typeof process !== 'undefined' && process.env) {
      if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
      if (process.env.API_KEY) return process.env.API_KEY.trim();
    }
  } catch (e) {
    // ignore process.env errors
  }

  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
      const metaEnv = (import.meta as any).env;
      if (metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY.trim();
      if (metaEnv.GEMINI_API_KEY) return metaEnv.GEMINI_API_KEY.trim();
    }
  } catch (e) {
    // ignore
  }

  return '';
};

const generateWithGoogle = async ({ model, contents, config, apiKey }: GeneratePromptRequest): Promise<string> => {
  const effectiveKey = (apiKey && apiKey.trim()) || resolveDefaultGoogleApiKey();
  if (!effectiveKey) {
    throw new Error('Google AI Studio API key is missing. Please provide your Google AI Studio API key.');
  }

  const key = effectiveKey.trim();
  const isBearerToken = key.startsWith('AQ.') || key.startsWith('ya29.');
  const effectiveMaxTokens = config?.maxOutputTokens || 8192;

  if (isBearerToken) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const requestBody: Record<string, any> = {
      contents: typeof contents === 'string'
        ? [{ role: 'user', parts: [{ text: contents }] }]
        : Array.isArray(contents?.parts)
        ? [{ role: 'user', parts: contents.parts }]
        : [{ role: 'user', parts: [{ text: String(contents) }] }],
      generationConfig: {
        maxOutputTokens: effectiveMaxTokens,
        temperature: config?.temperature ?? 1.0,
        topP: 0.95,
        responseMimeType: 'application/json',
      },
    };

    if (config?.systemInstruction) {
      requestBody.systemInstruction = { parts: [{ text: config.systemInstruction }] };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiRequestError(
        errorText || `Google AI Studio request failed with status ${response.status}`,
        response.status,
        errorText
      );
    }

    const payload = await response.json();
    const candidate = payload?.candidates?.[0];
    const textPart = candidate?.content?.parts?.[0]?.text;
    if (typeof textPart === 'string' && textPart.trim()) {
      return textPart.trim();
    }
    throw new EmptyResponseError('Google AI Studio');
  }

  const freshAi = new GoogleGenAI({ apiKey: key });
  const finalConfig = { 
     ...config, 
     maxOutputTokens: effectiveMaxTokens,
     temperature: config?.temperature ?? 1.0,
     topP: 0.95,
     responseMimeType: 'application/json' 
   };
  const response = await freshAi.models.generateContent({ model, contents, config: finalConfig });

  const finishReason = response?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') {
    throw new TruncatedResponseError('Google AI Studio');
  }

  let text: string | undefined;
  try {
    text = response.text;
  } catch (e) {
    console.warn('[Google AI Studio] response.text getter threw:', e);
    throw new EmptyResponseError('Google AI Studio');
  }

  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    throw new EmptyResponseError('Google AI Studio');
  }
  return trimmed;
};

/**
 * Hapus pembungkus markdown code fence (```json ... ```) dari respons AI jika ada.
 */
const stripCodeFence = (text: string): string => {
  let s = text.trim();
  if (s.startsWith('```')) {
    const nl = s.indexOf('\n');
    s = nl !== -1 ? s.substring(nl + 1) : s.substring(3);
  }
  if (s.endsWith('```')) {
    s = s.substring(0, s.length - 3);
  }
  return s.trim();
};

export const generateModelContent = async (request: GeneratePromptRequest): Promise<string> => {
  const result = await generateWithGoogle(request);
  const trimmedResult = (result || '').trim();
  if (!trimmedResult) {
    throw new EmptyResponseError('Google AI Studio');
  }

  const stripped = stripCodeFence(trimmedResult);
  if (!stripped) {
    throw new EmptyResponseError('Google AI Studio');
  }

  return stripped;
};

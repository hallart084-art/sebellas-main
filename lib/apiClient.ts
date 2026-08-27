import { getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';

export type GeneratePromptRequest = {
  model: ApiModel;
  contents: any;
  config: any;
  apiKey: string;
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
  constructor(providerLabel: string) {
    super(`${providerLabel} API response did not yield valid text.`);
    this.name = 'EmptyResponseError';
  }
}

export const ENDPOINTS: Record<ModelProvider, string> = {
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  github: 'https://models.inference.ai.azure.com/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

export const CHECK_MODELS: Record<ModelProvider, string> = {
  google: 'gemini-2.5-flash',
  groq: 'qwen/qwen3.6-27b',
  mistral: 'mistral-small-latest',
  github: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
};

/**
 * Hapus tag <think> dan markdown code fence (```json ... ```) dari respons AI.
 */
export const stripCodeFence = (text: string): string => {
  let s = (text || '').trim();
  // Strip <think>...</think> reasoning tags
  s = s.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (s.startsWith('```')) {
    const nl = s.indexOf('\n');
    s = nl !== -1 ? s.substring(nl + 1) : s.substring(3);
  }
  if (s.endsWith('```')) {
    s = s.substring(0, s.length - 3);
  }
  return s.trim();
};

const toChatCompletionUserContent = (contents: any): string | Array<Record<string, any>> => {
  if (typeof contents === 'string') return contents;

  if (Array.isArray(contents)) {
    const parts: Array<Record<string, any>> = [];
    for (const item of contents) {
      if (typeof item === 'string') {
        parts.push({ type: 'text', text: item });
      } else if (item && typeof item === 'object') {
        if (item.text) {
          parts.push({ type: 'text', text: String(item.text) });
        } else if (item.inlineData?.data && item.inlineData?.mimeType) {
          parts.push({
            type: 'image_url',
            image_url: {
              url: `data:${item.inlineData.mimeType};base64,${item.inlineData.data}`,
            },
          });
        }
      }
    }
    if (parts.length > 0) return parts;
  }

  if (contents && typeof contents === 'object') {
    if (contents.parts && Array.isArray(contents.parts)) {
      return toChatCompletionUserContent(contents.parts);
    }
    if (contents.text) return String(contents.text);
    return JSON.stringify(contents);
  }

  return String(contents || '');
};

/**
 * Universal call matching 'mata data' architecture
 */
export const generateModelContent = async (request: GeneratePromptRequest): Promise<string> => {
  const provider: ModelProvider = getModelProvider(request.model);
  const apiKey = (request.apiKey || '').trim();

  if (!apiKey) {
    throw new Error(`No ${provider} API key found. Please configure your key in Settings.`);
  }

  const endpoint = ENDPOINTS[provider] || ENDPOINTS.google;
  const userContent = toChatCompletionUserContent(request.contents);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  };

  if (provider === 'github') {
    headers['api-key'] = apiKey;
  } else if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://sebelaspromptgen.app';
    headers['X-Title'] = 'SebelasPromptGen';
  }

  const systemInstruction = request.config?.systemInstruction
    ? `${request.config.systemInstruction}\nYou MUST output valid JSON format.`
    : 'You MUST output valid JSON format.';

  const messages: Array<{ role: string; content: any }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }
  messages.push({ role: 'user', content: userContent });

  // Map model name if needed
  let modelName = request.model;
  if (provider === 'google' && modelName.startsWith('google/')) {
    modelName = modelName.replace('google/', '') as ApiModel;
  }

  const body: Record<string, any> = {
    model: modelName,
    messages,
    temperature: request.config?.temperature ?? 0.7,
    max_tokens: request.config?.maxOutputTokens || 8192,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiRequestError(
      errText || `${provider} API request failed with status ${res.status}`,
      res.status,
      errText
    );
  }

  const resData = await res.json();
  let rawContent = '';

  if (resData.choices && resData.choices[0] && resData.choices[0].message) {
    rawContent = resData.choices[0].message.content || '';
  } else if (resData.candidates && resData.candidates[0] && resData.candidates[0].content) {
    rawContent = resData.candidates[0].content.parts?.[0]?.text || '';
  } else {
    throw new EmptyResponseError(provider);
  }

  const cleaned = stripCodeFence(rawContent);
  if (!cleaned) {
    throw new EmptyResponseError(provider);
  }

  return cleaned;
};

/**
 * Universal check API Key function matching 'mata data'
 */
export async function checkApiKeyOnline(provider: ModelProvider, key: string): Promise<{
  success: boolean;
  status: 'active' | 'rate_limited' | 'invalid' | 'error';
  reason: 'valid' | 'limited' | 'invalid';
  message: string;
  latency: number;
}> {
  const tStart = Date.now();
  const trimmed = (key || '').trim();
  const maskedKey = trimmed.length > 8 ? `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}` : trimmed;

  if (!trimmed) {
    return { success: false, status: 'invalid', reason: 'invalid', message: 'API key is empty', latency: 0 };
  }

  try {
    const endpoint = ENDPOINTS[provider] || ENDPOINTS.google;
    const testModel = CHECK_MODELS[provider] || 'gemini-2.5-flash';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${trimmed}`,
    };

    if (provider === 'github') {
      headers['api-key'] = trimmed;
    } else if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://sebelaspromptgen.app';
      headers['X-Title'] = 'SebelasPromptGen';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: testModel,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
    });

    const latency = Date.now() - tStart;

    if (res.ok) {
      return { key: maskedKey, status: 'active', reason: 'valid', success: true, message: `Active (${latency}ms)`, latency } as any;
    } else if (res.status === 429) {
      return { key: maskedKey, status: 'rate_limited', reason: 'limited', success: false, message: 'Rate Limited (429)', latency } as any;
    } else if (res.status === 401 || res.status === 403) {
      return { key: maskedKey, status: 'invalid', reason: 'invalid', success: false, message: `Invalid Key (${res.status})`, latency } as any;
    } else {
      return { key: maskedKey, status: 'error', reason: 'invalid', success: false, message: `HTTP ${res.status}`, latency } as any;
    }
  } catch (err: any) {
    const latency = Date.now() - tStart;
    return { key: maskedKey, status: 'error', reason: 'invalid', success: false, message: (err?.message || 'Network error').slice(0, 60), latency } as any;
  }
}

export const isTransientEmptyResponseError = (error: unknown): boolean => {
  if (error instanceof EmptyResponseError) return true;
  return false;
};

export const shouldRotateApiKeyOnError = (error: unknown): boolean => {
  const text = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    text.includes('429') ||
    text.includes('rate limit') ||
    text.includes('resource exhausted') ||
    text.includes('limit exceeded') ||
    text.includes('401') ||
    text.includes('403') ||
    text.includes('unauthorized') ||
    text.includes('invalid')
  );
};

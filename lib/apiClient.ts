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
  constructor(providerLabel: string = 'API') {
    super(`${providerLabel} API response did not yield valid text.`);
    this.name = 'EmptyResponseError';
  }
}

export const ENDPOINTS: Record<ModelProvider, string> = {
  google: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  github: 'https://models.inference.ai.azure.com/chat/completions',
  mistral: 'https://api.mistral.ai/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
};

export const CHECK_MODELS: Record<ModelProvider, string> = {
  google: 'gemini-2.5-flash',
  groq: 'llama-3.2-11b-vision-preview',
  github: 'gpt-4o-mini',
  mistral: 'mistral-small-latest',
  openai: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
};

/**
 * Pembersih respons teks persis seperti fungsi parseMetadata di mata data app
 */
export const stripCodeFence = (rawText: string): string => {
  let cleaned = (rawText || '').trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
  if (cleaned.startsWith('```')) cleaned = cleaned.substring(3);
  if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
  return cleaned.trim();
};

const toChatCompletionUserContent = (contents: any): any => {
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
 * Cara kerja API call Vision & Text sama persis seperti fungsi callVisionAPI di server.js (mata data)
 */
export const generateModelContent = async (request: GeneratePromptRequest): Promise<string> => {
  const provider: ModelProvider = getModelProvider(request.model);
  const currentKey = (request.apiKey || '').trim();

  if (!currentKey) {
    throw new Error(`API key untuk provider ${provider} belum diatur. Silakan masukkan key di menu Set API Key.`);
  }

  let endpoint = ENDPOINTS[provider] || ENDPOINTS.google;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${currentKey}`,
  };

  if (provider === 'github') {
    headers['api-key'] = currentKey;
  } else if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://sebelaspromptgen.app';
    headers['X-Title'] = 'SebelasPromptGen';
  }

  const promptContent = toChatCompletionUserContent(request.contents);
  const systemInstruction = request.config?.systemInstruction || 'You are an expert AI prompt creator. Output valid JSON formatted array of prompts: ["prompt 1", "prompt 2", ...]';

  const messages: Array<{ role: string; content: any }> = [];
  if (systemInstruction) {
    messages.push({ role: 'system', content: systemInstruction });
  }

  if (Array.isArray(promptContent)) {
    messages.push({ role: 'user', content: promptContent });
  } else {
    messages.push({ role: 'user', content: String(promptContent) });
  }

  const body = {
    model: request.model,
    temperature: request.config?.temperature ?? 0.7,
    messages: messages,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ApiRequestError(`API error ${res.status}: ${errText.slice(0, 200)}`, res.status, errText);
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
 * Pengecekan API Key sama persis seperti checkApiKey di server.js (mata data)
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
    let endpoint = ENDPOINTS[provider] || ENDPOINTS.google;
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
    return { key: maskedKey, status: 'error', reason: 'invalid', success: false, message: (err?.message || 'Network error').slice(0, 50), latency } as any;
  }
}

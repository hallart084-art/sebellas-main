import { GoogleGenAI } from '@google/genai';
import { getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';

type GeneratePromptRequest = {
 model: ApiModel;
 contents: any;
 config: any;
 apiKey: string;
 isXmlQuality?: boolean;
};

const groqEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
const mistralEndpoint = 'https://api.mistral.ai/v1/chat/completions';
const openrouterEndpoint = 'https://openrouter.ai/api/v1/chat/completions';
const githubEndpoint = 'https://models.inference.ai.azure.com/chat/completions';

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

export class TruncatedResponseError extends EmptyResponseError {
 constructor(providerLabel: string = "API") {
 super(providerLabel);
 this.message = `${providerLabel} response was truncated (output token limit reached). Retrying...`;
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

const toChatCompletionUserContent = (contents: any): string | Array<Record<string, any>> => {
 if (typeof contents === 'string') return contents;

 const parts = contents?.parts;
 if (!Array.isArray(parts)) return String(contents ?? '');

 const chatParts: Array<Record<string, any>> = parts.flatMap((part: any): Array<Record<string, any>> => {
 if (part?.text) {
 return [{ type: 'text', text: part.text }];
 }

 const inlineData = part?.inlineData;
 if (inlineData?.data && inlineData?.mimeType) {
 return [{
 type: 'image_url',
 image_url: {
 url: `data:${inlineData.mimeType};base64,${inlineData.data}`,
 },
 }];
 }

 return [];
 });

 if (chatParts.length === 1 && chatParts[0].type === 'text') {
 return chatParts[0].text;
 }

 return chatParts;
};

const generateWithGoogle = async ({ model, contents, config, apiKey }: GeneratePromptRequest): Promise<string> => {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Google API key is missing. Please configure your API key in Settings.');
  }
  const key = apiKey.trim();
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
        errorText || `Google API request failed with status ${response.status}`,
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
    throw new EmptyResponseError('Gemini');
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
    throw new TruncatedResponseError('Gemini');
  }

  let text: string | undefined;
  try {
   text = response.text;
  } catch (e) {
   console.warn('[Gemini] response.text getter threw:', e);
   throw new EmptyResponseError('Gemini');
  }

  const trimmed = (text ?? '').trim();
  if (!trimmed) {
   throw new EmptyResponseError('Gemini');
  }
  return trimmed;
};

const getChatCompletionText = (payload: any, providerLabel: string): string => {
 const choice = payload?.choices?.[0];
 const responseContent = choice?.message?.content;
 
 const finishReason = choice?.finish_reason;
 if (finishReason === 'length') {
   throw new TruncatedResponseError(providerLabel);
 }

 if (typeof responseContent === 'string') {
 return responseContent.trim();
 }

 if (Array.isArray(responseContent)) {
 const text = responseContent
 .map((part: any) => typeof part?.text === 'string' ? part.text : '')
 .join('')
 .trim();
 if (text) return text;
 }

 throw new EmptyResponseError(providerLabel);
};

const generateWithChatCompletion = async (
 { model, contents, config, apiKey }: GeneratePromptRequest,
 endpoint: string,
 providerLabel: string,
 extraHeaders?: Record<string, string>,
 maxTokens: number = 8192
): Promise<string> => {
 if (!apiKey || typeof apiKey !== 'string') {
 throw new Error(`${providerLabel} API key is missing. Please configure your API key in Settings.`);
 }
 const messages = [
 ...(config?.systemInstruction ? [{ role: 'system', content: config.systemInstruction }] : []),
 { role: 'user', content: toChatCompletionUserContent(contents) },
 ];

 const response = await fetch(endpoint, {
 method: 'POST',
 headers: {
 'Authorization': `Bearer ${apiKey.trim()}`,
 'Content-Type': 'application/json',
 ...extraHeaders,
 },
 body: JSON.stringify({
 model,
 messages,
 temperature: config?.temperature ?? 1.0,
 top_p: 0.95,
 max_tokens: config?.maxOutputTokens || maxTokens,
 }),
 });

 if (!response.ok) {
 const errorText = await response.text();
 throw new ApiRequestError(
 errorText || `${providerLabel} API request failed with status ${response.status}`,
 response.status,
 errorText
 );
 }

 const payload = await response.json();
 return getChatCompletionText(payload, providerLabel);
};

const isOpenRouterTokenBudgetError = (errorText: string): boolean => {
 const lower = errorText.toLowerCase();
 return (
 lower.includes('can only afford') ||
 lower.includes('more credits') ||
 lower.includes('fewer max_tokens')
 ) && lower.includes('402');
};

/**
 * Parses "can only afford N" from an OpenRouter 402 error message.
 * Returns N * 0.95 (safety margin) so we stay just under the limit.
 * Falls back to `fallback` if the number cannot be parsed.
 */
const parseAffordableTokens = (errorText: string, fallback: number): number => {
 const match = errorText.match(/can only afford\s+(\d+)/i);
 if (match) {
 const affordable = parseInt(match[1], 10);
 if (!isNaN(affordable) && affordable > 64) {
 return Math.floor(affordable * 0.95); // 5% safety margin
 }
 }
 return fallback;
};

const generateWithOpenRouter = async (
 request: GeneratePromptRequest
): Promise<string> => {
 const openrouterHeaders = {
 'HTTP-Referer': 'https://sebelaspromptgen.app',
 'X-Title': 'SebelasPromptGen',
 };

 const getErrorText = (error: unknown): string => {
 if (error instanceof ApiRequestError) return error.responseText ?? error.message;
 if (error instanceof Error) return error.message;
 return String(error);
 };

 let maxTokens = 8192;
 const MAX_ATTEMPTS = 5;

 for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
 try {
 return await generateWithChatCompletion(
 request,
 openrouterEndpoint,
 'OpenRouter',
 openrouterHeaders,
 maxTokens
 );
 } catch (err) {
 const errorText = getErrorText(err);

 // If it's not a token-budget error, rethrow immediately — no point retrying
 if (!isOpenRouterTokenBudgetError(errorText)) throw err;

 // Parse how many tokens the user can afford from the error message
 const parsed = parseAffordableTokens(errorText, 0);
 const next = parsed > 0
 ? Math.floor(parsed * 0.85) // 15% safety margin to account for prompt overhead
 : Math.floor(maxTokens * 0.5); // fallback: halve current value

 console.info(`[OpenRouter] Budget error at ${maxTokens} tokens → attempt ${attempt + 1} with ${next} tokens`);

 if (next < 64 || attempt === MAX_ATTEMPTS) {
 // Truly out of credits — rethrow final error with clear message
 throw new ApiRequestError(
 `OpenRouter: insufficient credits. Your account can only afford ~${parsed} output tokens. ` +
 `Please top up your credits at https://openrouter.ai/settings/credits`,
 402,
 errorText
 );
 }

 maxTokens = next;
 }
 }

 // Should never reach here, but TypeScript requires a return
 throw new ApiRequestError('OpenRouter: max retry attempts exceeded', 402);
};



const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/** Jittered backoff: base * 2^(attempt-1) + random 0–500ms */
const jitteredBackoff = (attempt: number): number =>
  1000 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 500);

const MAX_EMPTY_RESPONSE_RETRIES = 4;

/**
 * Hapus pembungkus markdown code fence (```json ... ```) dari respons AI.
 * Provider seperti Groq, Mistral, dan OpenRouter tidak mendukung responseMimeType
 * sehingga sering mengembalikan JSON yang dibungkus code fence.
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
  const provider: ModelProvider = getModelProvider(request.model);
  
  const maxTokens = 8192;

  const callProvider = async (): Promise<string> => {
    if (provider === 'groq') {
      try {
        return await generateWithChatCompletion(request, groqEndpoint, 'Groq', undefined, maxTokens);
      } catch (err: any) {
        const errMsg = String(err?.responseText || err?.message || '').toLowerCase();
        if (errMsg.includes('model_not_found') || errMsg.includes('does not exist')) {
          console.warn(`[Groq] Model ${request.model} not found, falling back to llama-3.1-8b-instant`);
          return await generateWithChatCompletion({ ...request, model: 'llama-3.1-8b-instant' }, groqEndpoint, 'Groq', undefined, maxTokens);
        }
        throw err;
      }
    }
    if (provider === 'github') return generateWithChatCompletion(request, githubEndpoint, 'GitHub', undefined, maxTokens);
    if (provider === 'mistral') return generateWithChatCompletion(request, mistralEndpoint, 'Mistral', undefined, maxTokens);
    if (provider === 'openrouter') return generateWithOpenRouter(request);
    return generateWithGoogle(request);
  };

  // Retry loop for transient empty-response errors (all providers)
  for (let attempt = 1; attempt <= MAX_EMPTY_RESPONSE_RETRIES; attempt++) {
    try {
      const result = await callProvider();
      
      const trimmedResult = (result || '').trim();
      if (!trimmedResult) {
        throw new EmptyResponseError(provider);
      }

      // Strip code fence — provider seperti Groq/Mistral/OpenRouter sering membungkus
      // JSON dengan ```json...``` karena tidak mendukung responseMimeType.
      const stripped = stripCodeFence(trimmedResult);
      if (!stripped) {
        throw new EmptyResponseError(provider);
      }

      // Kembalikan versi yang sudah di-strip agar caller menerima teks bersih.
      // Tidak ada pengecekan struktural di sini — caller (App.tsx) memiliki
      // fallback parser bertingkat yang bisa menangani berbagai format output.
      return stripped;
    } catch (err) {
      if (isTransientEmptyResponseError(err) && attempt < MAX_EMPTY_RESPONSE_RETRIES) {
        const backoffMs = jitteredBackoff(attempt); // ~1s, ~2s, ~4s
        console.warn(
          `[${provider}] Empty/invalid response on attempt ${attempt}/${MAX_EMPTY_RESPONSE_RETRIES}. ` +
          `Retrying in ${backoffMs}ms...`,
          err instanceof Error ? err.message : err
        );
        await delay(backoffMs);
        continue;
      }
      // Non-retryable error, or max retries exhausted — rethrow
      throw err;
    }
  }

  // Should never reach here, but TypeScript requires a return
  throw new EmptyResponseError(provider);
};

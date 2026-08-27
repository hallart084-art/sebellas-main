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

export const stripCodeFence = (text: string): string => {
  let s = (text || '').trim();
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

/**
 * SISTEM API SEMENTARA DINONAKTIFKAN (KOSONG TANPA CALL API)
 */
export const generateModelContent = async (_request: GeneratePromptRequest): Promise<string> => {
  throw new Error('Sistem API saat ini sedang dinonaktifkan.');
};

export async function checkApiKeyOnline(_provider: ModelProvider, _key: string): Promise<{
  success: boolean;
  status: 'active' | 'rate_limited' | 'invalid' | 'error';
  reason: 'valid' | 'limited' | 'invalid';
  message: string;
  latency: number;
}> {
  return {
    success: false,
    status: 'invalid',
    reason: 'invalid',
    message: 'API dinonaktifkan sementara',
    latency: 0,
  };
}

export const isTransientEmptyResponseError = (_error: unknown): boolean => false;
export const shouldRotateApiKeyOnError = (_error: unknown): boolean => false;

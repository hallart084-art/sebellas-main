import type { InputMode } from './types';

export type ModelProvider = 'google' | 'groq' | 'mistral' | 'github' | 'openrouter';

export const MODEL_PROVIDERS: readonly ModelProvider[] = ['google', 'groq', 'mistral', 'github', 'openrouter'];

export const MODEL_PROVIDER_LABELS: Record<ModelProvider, string> = {
 google: 'Gemini',
 groq: 'Groq',
 mistral: 'Mistral',
 github: 'GitHub',
 openrouter: 'OpenRouter',
};

export const GOOGLE_API_KEY_CHECK_MODEL = 'gemini-2.5-flash';
export const GROQ_API_KEY_CHECK_MODEL = 'llama-3.1-8b-instant';
export const MISTRAL_API_KEY_CHECK_MODEL = 'mistral-small-latest';
export const GITHUB_API_KEY_CHECK_MODEL = 'gpt-4o-mini';
export const OPENROUTER_API_KEY_CHECK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export type ModelDefinition = {
  id: string;
  provider: ModelProvider;
  displayName: string;
  supportedModes: readonly InputMode[];
  supportsQuickGenerate?: boolean;
};

export const AI_MODELS = [
  // --- Google (Gemini) ---
  { id: 'gemini-flash-latest', provider: 'google', displayName: 'Gemini Flash Latest', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-flash-lite-latest', provider: 'google', displayName: 'Gemini Flash Lite Latest', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-pro-latest', provider: 'google', displayName: 'Gemini Pro Latest', supportedModes: ['text', 'image', 'video'] },
  { id: 'gemini-2.5-flash', provider: 'google', displayName: 'Gemini 2.5 Flash', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-flash-lite', provider: 'google', displayName: 'Gemini 2.5 Flash Lite', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-pro', provider: 'google', displayName: 'Gemini 2.5 Pro', supportedModes: ['text', 'image', 'video'] },
  { id: 'gemini-3-flash-preview', provider: 'google', displayName: 'Gemini 3 Flash Preview', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-flash-lite', provider: 'google', displayName: 'Gemini 3.1 Flash Lite', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-pro-preview', provider: 'google', displayName: 'Gemini 3.1 Pro Preview', supportedModes: ['text', 'image', 'video'] },
  { id: 'gemini-3.5-flash', provider: 'google', displayName: 'Gemini 3.5 Flash', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-robotics-er-1.6-preview', provider: 'google', displayName: 'Gemini Robotics ER 1.6 Preview', supportedModes: ['text', 'image', 'video'] },

  // --- Groq ---
  { id: 'groq/compound', provider: 'groq', displayName: 'Compound', supportedModes: ['text'] },
  { id: 'groq/compound-mini', provider: 'groq', displayName: 'Compound Mini', supportedModes: ['text'] },
  { id: 'openai/gpt-oss-120b', provider: 'groq', displayName: 'GPT OSS 120B', supportedModes: ['text'] },
  { id: 'openai/gpt-oss-20b', provider: 'groq', displayName: 'GPT OSS 20B', supportedModes: ['text'] },
  { id: 'llama-3.1-8b-instant', provider: 'groq', displayName: 'Llama 3.1 8B', supportedModes: ['text'] },
  { id: 'llama-3.3-70b-versatile', provider: 'groq', displayName: 'Llama 3.3 70B', supportedModes: ['text'] },
  { id: 'openai/gpt-oss-safeguard-20b', provider: 'groq', displayName: 'Safety GPT OSS 20B', supportedModes: ['text'] },
  { id: 'qwen/qwen3.6-27b', provider: 'groq', displayName: 'Qwen 3.6 27B', supportedModes: ['text', 'image'] },

  // --- OpenRouter ---
  { id: 'google/gemini-flash-latest', provider: 'openrouter', displayName: 'Gemini Flash Latest', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-pro-latest', provider: 'openrouter', displayName: 'Gemini Pro Latest', supportedModes: ['text', 'image', 'video'] },
  { id: 'google/gemini-2.5-pro', provider: 'openrouter', displayName: 'Gemini 2.5 Pro', supportedModes: ['text', 'image', 'video'] },
  { id: 'google/gemini-2.5-flash', provider: 'openrouter', displayName: 'Gemini 2.5 Flash', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', displayName: 'Gemini 2.5 Flash Lite', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3-flash-preview', provider: 'openrouter', displayName: 'Gemini 3 Flash Preview', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-flash-lite-preview', provider: 'openrouter', displayName: 'Gemini 3.1 Flash Lite Preview', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-flash-lite', provider: 'openrouter', displayName: 'Gemini 3.1 Flash Lite', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-pro-preview', provider: 'openrouter', displayName: 'Gemini 3.1 Pro Preview', supportedModes: ['text', 'image', 'video'] },
  { id: 'google/gemini-3.5-flash', provider: 'openrouter', displayName: 'Gemini 3.5 Flash', supportedModes: ['text', 'image', 'video'], supportsQuickGenerate: true },

  // --- Mistral ---
  { id: 'magistral-medium-2509', provider: 'mistral', displayName: 'Magistral Medium 2509', supportedModes: ['text', 'image'] },
  { id: 'magistral-small-2509', provider: 'mistral', displayName: 'Magistral Small 2509', supportedModes: ['text', 'image'] },
  { id: 'ministral-14b-2512', provider: 'mistral', displayName: 'Ministral 14B', supportedModes: ['text', 'image'] },
  { id: 'ministral-3b-2512', provider: 'mistral', displayName: 'Ministral 3B', supportedModes: ['text', 'image'] },
  { id: 'ministral-8b-2512', provider: 'mistral', displayName: 'Ministral 8B', supportedModes: ['text', 'image'] },
  { id: 'mistral-large-2512', provider: 'mistral', displayName: 'Mistral Large 2512', supportedModes: ['text', 'image'] },
  { id: 'mistral-large-latest', provider: 'mistral', displayName: 'Mistral Large Latest', supportedModes: ['text', 'image'] },
  { id: 'mistral-medium-2505', provider: 'mistral', displayName: 'Mistral Medium 2505', supportedModes: ['text', 'image'] },
  { id: 'mistral-medium-2508', provider: 'mistral', displayName: 'Mistral Medium 2508', supportedModes: ['text', 'image'] },
  { id: 'mistral-medium-2604', provider: 'mistral', displayName: 'Mistral Medium 2604', supportedModes: ['text', 'image'] },
  { id: 'mistral-medium-latest', provider: 'mistral', displayName: 'Mistral Medium Latest', supportedModes: ['text', 'image'] },
  { id: 'mistral-small-2506', provider: 'mistral', displayName: 'Mistral Small 2506', supportedModes: ['text', 'image'] },
  { id: 'mistral-small-2603', provider: 'mistral', displayName: 'Mistral Small 2603', supportedModes: ['text', 'image'] },
  { id: 'mistral-small-latest', provider: 'mistral', displayName: 'Mistral Small Latest', supportedModes: ['text', 'image'] },
  // --- GitHub Models ---
  { id: 'gpt-4o-mini', provider: 'github', displayName: 'GPT-4o Mini', supportedModes: ['text', 'image', 'vector'] },
  { id: 'gpt-4o', provider: 'github', displayName: 'GPT-4o', supportedModes: ['text', 'image', 'vector'] },
  { id: 'meta-llama-3.1-405b-instruct', provider: 'github', displayName: 'Llama 3.1 405B', supportedModes: ['text', 'vector'] },
  { id: 'meta-llama-3.1-70b-instruct', provider: 'github', displayName: 'Llama 3.1 70B', supportedModes: ['text', 'vector'] },
  { id: 'meta-llama-3.1-8b-instruct', provider: 'github', displayName: 'Llama 3.1 8B', supportedModes: ['text', 'vector'] },
  { id: 'mistral-large', provider: 'github', displayName: 'Mistral Large (GitHub)', supportedModes: ['text', 'vector'] },
  { id: 'mistral-small', provider: 'github', displayName: 'Mistral Small (GitHub)', supportedModes: ['text', 'vector'] },
] as const satisfies readonly ModelDefinition[];

export type ApiModel = typeof AI_MODELS[number]['id'];

export const DEFAULT_MODEL: ApiModel = 'gemini-3.1-flash-lite';

export const getModelDefinition = (id: ApiModel | string): ModelDefinition => {
  const model = AI_MODELS.find(m => m.id === id);
  return model || AI_MODELS[0];
};

export const getModelProvider = (model: ApiModel): ModelProvider => getModelDefinition(model).provider;

export const getModelDisplayName = (model: ApiModel): string => getModelDefinition(model).displayName;

export const isModelSupportedForMode = (model: ApiModel, mode: InputMode): boolean =>
  (getModelDefinition(model).supportedModes as readonly InputMode[]).includes(mode);

export const getModelsForInputMode = (mode: InputMode): readonly ApiModel[] =>
  AI_MODELS.filter(model => (model.supportedModes as readonly InputMode[]).includes(mode)).map(m => m.id as ApiModel);

export const VECTOR_ART_STYLES = [
  'Flat illustration',
  'Monoline geometric vector',
  'Geometric silhouette',
  'Negative space cutout',
] as const;

export type VectorArtStyle = typeof VECTOR_ART_STYLES[number];
export const DEFAULT_VECTOR_ART_STYLE: VectorArtStyle = 'Flat illustration';
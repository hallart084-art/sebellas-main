import type { InputMode } from './types';

export type ModelProvider = 'google' | 'groq' | 'github' | 'mistral' | 'openai' | 'openrouter';

export const MODEL_PROVIDERS: readonly ModelProvider[] = ['google', 'groq', 'github', 'mistral', 'openai', 'openrouter'];

export const MODEL_PROVIDER_LABELS: Record<ModelProvider, string> = {
  google: 'Gemini API',
  groq: 'Groq API',
  github: 'GitHub Models API',
  mistral: 'Mistral API',
  openai: 'OpenAI API',
  openrouter: 'OpenRouter API',
};

export const GOOGLE_API_KEY_CHECK_MODEL = 'gemini-2.5-flash';
export const GROQ_API_KEY_CHECK_MODEL = 'qwen/qwen3.6-27b';
export const GITHUB_API_KEY_CHECK_MODEL = 'gpt-4o-mini';
export const MISTRAL_API_KEY_CHECK_MODEL = 'mistral-small-latest';
export const OPENAI_API_KEY_CHECK_MODEL = 'gpt-4o-mini';
export const OPENROUTER_API_KEY_CHECK_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

export type ModelDefinition = {
  id: string;
  provider: ModelProvider;
  displayName: string;
  supportedModes: readonly InputMode[];
  supportsQuickGenerate?: boolean;
};

export const AI_MODELS = [
  // --- Gemini API ---
  { id: 'gemini-2.5-flash', provider: 'google', displayName: 'gemini-2.5-flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-1.5-flash', provider: 'google', displayName: 'gemini-1.5-flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.0-flash', provider: 'google', displayName: 'gemini-2.0-flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-flash-lite', provider: 'google', displayName: 'gemini-3.1-flash-lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },

  // --- Groq API ---
  { id: 'llama-3.2-11b-vision-preview', provider: 'groq', displayName: 'llama-3.2-11b-vision-preview', supportedModes: ['text', 'image', 'vector'] },
  { id: 'llama-3.2-90b-vision-preview', provider: 'groq', displayName: 'llama-3.2-90b-vision-preview', supportedModes: ['text', 'image', 'vector'] },
  { id: 'qwen/qwen3.6-27b', provider: 'groq', displayName: 'qwen/qwen3.6-27b', supportedModes: ['text', 'vector'] },
  { id: 'qwen/qwen3.8-27b', provider: 'groq', displayName: 'qwen/qwen3.8-27b', supportedModes: ['text', 'vector'] },
  { id: 'groq/compound-mini', provider: 'groq', displayName: 'groq/compound-mini', supportedModes: ['text', 'vector'] },
  { id: 'groq/compound', provider: 'groq', displayName: 'groq/compound', supportedModes: ['text', 'vector'] },
  { id: 'openai/gpt-oss-120b', provider: 'groq', displayName: 'openai/gpt-oss-120b', supportedModes: ['text', 'vector'] },
  { id: 'openai/gpt-oss-20b', provider: 'groq', displayName: 'openai/gpt-oss-20b', supportedModes: ['text', 'vector'] },

  // --- GitHub Models API ---
  { id: 'gpt-4o', provider: 'github', displayName: 'gpt-4o (GitHub)', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },
  { id: 'gpt-4o-mini', provider: 'github', displayName: 'gpt-4o-mini (GitHub)', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },
  { id: 'meta-llama-3.3-70b-instruct', provider: 'github', displayName: 'meta-llama-3.3-70b-instruct', supportedModes: ['text', 'vector'] },
  { id: 'mistral-large-2411', provider: 'github', displayName: 'mistral-large-2411', supportedModes: ['text', 'vector'] },
  { id: 'phi-4', provider: 'github', displayName: 'phi-4', supportedModes: ['text', 'vector'] },

  // --- Mistral API ---
  { id: 'pixtral-12b-2409', provider: 'mistral', displayName: 'pixtral-12b-2409', supportedModes: ['text', 'image', 'vector'] },
  { id: 'pixtral-large-latest', provider: 'mistral', displayName: 'pixtral-large-latest', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-small-latest', provider: 'mistral', displayName: 'mistral-small-latest', supportedModes: ['text', 'vector'] },

  // --- OpenAI API ---
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'gpt-4o-mini', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },
  { id: 'gpt-4o', provider: 'openai', displayName: 'gpt-4o', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },

  // --- OpenRouter API ---
  { id: 'meta-llama/llama-3.2-11b-vision-instruct:free', provider: 'openrouter', displayName: 'meta-llama/llama-3.2-11b-vision-instruct:free', supportedModes: ['text', 'image', 'vector'] },
  { id: 'google/gemini-2.0-flash-exp:free', provider: 'openrouter', displayName: 'google/gemini-2.0-flash-exp:free', supportedModes: ['text', 'image', 'vector'] },
  { id: 'qwen/qwen-2.5-vl-72b-instruct:free', provider: 'openrouter', displayName: 'qwen/qwen-2.5-vl-72b-instruct:free', supportedModes: ['text', 'image', 'vector'] },
  { id: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'openrouter', displayName: 'meta-llama/llama-3.3-70b-instruct:free', supportedModes: ['text', 'vector'] },
] as const satisfies readonly ModelDefinition[];

export type ApiModel = typeof AI_MODELS[number]['id'];

export const DEFAULT_MODEL: ApiModel = 'gemini-2.5-flash';

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
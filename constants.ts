import type { InputMode } from './types';

export type ModelProvider = 'google' | 'groq' | 'mistral' | 'openrouter' | 'github' | 'openai';

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
export const MISTRAL_API_KEY_CHECK_MODEL = 'mistral-small-latest';
export const GITHUB_API_KEY_CHECK_MODEL = 'gpt-4o-mini';
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
  // --- Google (Gemini) ---
  { id: 'gemini-flash-latest', provider: 'google', displayName: 'Gemini Flash Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-flash-lite-latest', provider: 'google', displayName: 'Gemini Flash Lite Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-pro-latest', provider: 'google', displayName: 'Gemini Pro Latest', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'gemini-2.5-flash', provider: 'google', displayName: 'Gemini 2.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-flash-lite', provider: 'google', displayName: 'Gemini 2.5 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-pro', provider: 'google', displayName: 'Gemini 2.5 Pro', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'gemini-3-flash-preview', provider: 'google', displayName: 'Gemini 3 Flash Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-flash-lite', provider: 'google', displayName: 'Gemini 3.1 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-pro-preview', provider: 'google', displayName: 'Gemini 3.1 Pro Preview', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'gemini-3.5-flash', provider: 'google', displayName: 'Gemini 3.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-robotics-er-1.6-preview', provider: 'google', displayName: 'Gemini Robotics ER 1.6 Preview', supportedModes: ['text', 'image', 'vector', 'video'] },

  // --- GitHub Models ---
  { id: 'gpt-4o-mini', provider: 'github', displayName: 'GPT-4o Mini (GitHub)', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },
  { id: 'gpt-4o', provider: 'github', displayName: 'GPT-4o (GitHub)', supportedModes: ['text', 'image', 'vector'], supportsQuickGenerate: true },
  { id: 'meta-llama-3.3-70b-instruct', provider: 'github', displayName: 'Llama 3.3 70B (GitHub)', supportedModes: ['text', 'vector'] },
  { id: 'meta-llama-3.1-8b-instruct', provider: 'github', displayName: 'Llama 3.1 8B (GitHub)', supportedModes: ['text', 'vector'] },
  { id: 'mistral-large-2411', provider: 'github', displayName: 'Mistral Large (GitHub)', supportedModes: ['text', 'vector'] },
  { id: 'phi-4', provider: 'github', displayName: 'Phi-4 (GitHub)', supportedModes: ['text', 'vector'] },

  // --- Groq ---
  { id: 'llama-3.2-11b-vision-preview', provider: 'groq', displayName: 'llama-3.2-11b-vision-preview', supportedModes: ['text', 'image', 'vector'] },
  { id: 'llama-3.2-90b-vision-preview', provider: 'groq', displayName: 'llama-3.2-90b-vision-preview', supportedModes: ['text', 'image', 'vector'] },
  { id: 'qwen/qwen3.6-27b', provider: 'groq', displayName: 'Qwen 3.6 27B', supportedModes: ['text', 'vector'] },
  { id: 'qwen/qwen3.8-27b', provider: 'groq', displayName: 'Qwen 3.8 27B', supportedModes: ['text', 'vector'] },
  { id: 'groq/compound-mini', provider: 'groq', displayName: 'Groq Compound Mini', supportedModes: ['text', 'vector'] },
  { id: 'groq/compound', provider: 'groq', displayName: 'Groq Compound', supportedModes: ['text', 'vector'] },
  { id: 'openai/gpt-oss-120b', provider: 'groq', displayName: 'GPT OSS 120B', supportedModes: ['text', 'vector'] },
  { id: 'openai/gpt-oss-20b', provider: 'groq', displayName: 'GPT OSS 20B', supportedModes: ['text', 'vector'] },

  // --- OpenAI API ---
  { id: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', supportedModes: ['text', 'image', 'vector'] },
  { id: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', supportedModes: ['text', 'image', 'vector'] },

  // --- OpenRouter ---
  { id: 'google/gemini-flash-latest', provider: 'openrouter', displayName: 'Gemini Flash Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-pro-latest', provider: 'openrouter', displayName: 'Gemini Pro Latest', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'google/gemini-2.5-pro', provider: 'openrouter', displayName: 'Gemini 2.5 Pro', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'google/gemini-2.5-flash', provider: 'openrouter', displayName: 'Gemini 2.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-2.5-flash-lite', provider: 'openrouter', displayName: 'Gemini 2.5 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3-flash-preview', provider: 'openrouter', displayName: 'Gemini 3 Flash Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-flash-lite-preview', provider: 'openrouter', displayName: 'Gemini 3.1 Flash Lite Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-flash-lite', provider: 'openrouter', displayName: 'Gemini 3.1 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'google/gemini-3.1-pro-preview', provider: 'openrouter', displayName: 'Gemini 3.1 Pro Preview', supportedModes: ['text', 'image', 'vector', 'video'] },
  { id: 'google/gemini-3.5-flash', provider: 'openrouter', displayName: 'Gemini 3.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },

  // --- Mistral ---
  { id: 'magistral-medium-2509', provider: 'mistral', displayName: 'Magistral Medium 2509', supportedModes: ['text', 'image', 'vector'] },
  { id: 'magistral-small-2509', provider: 'mistral', displayName: 'Magistral Small 2509', supportedModes: ['text', 'image', 'vector'] },
  { id: 'ministral-14b-2512', provider: 'mistral', displayName: 'Ministral 14B', supportedModes: ['text', 'image', 'vector'] },
  { id: 'ministral-3b-2512', provider: 'mistral', displayName: 'Ministral 3B', supportedModes: ['text', 'image', 'vector'] },
  { id: 'ministral-8b-2512', provider: 'mistral', displayName: 'Ministral 8B', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-large-2512', provider: 'mistral', displayName: 'Mistral Large 2512', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-large-latest', provider: 'mistral', displayName: 'Mistral Large Latest', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-medium-2505', provider: 'mistral', displayName: 'Mistral Medium 2505', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-medium-2508', provider: 'mistral', displayName: 'Mistral Medium 2508', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-medium-2604', provider: 'mistral', displayName: 'Mistral Medium 2604', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-medium-latest', provider: 'mistral', displayName: 'Mistral Medium Latest', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-small-2506', provider: 'mistral', displayName: 'Mistral Small 2506', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-small-2603', provider: 'mistral', displayName: 'Mistral Small 2603', supportedModes: ['text', 'image', 'vector'] },
  { id: 'mistral-small-latest', provider: 'mistral', displayName: 'Mistral Small Latest', supportedModes: ['text', 'image', 'vector'] },
  { id: 'open-mistral-nemo', provider: 'mistral', displayName: 'Open Mistral Nemo', supportedModes: ['text', 'vector'] },
  { id: 'pixtral-12b-2409', provider: 'mistral', displayName: 'Pixtral 12B', supportedModes: ['text', 'image', 'vector'] },
  { id: 'pixtral-large-2411', provider: 'mistral', displayName: 'Pixtral Large 2411', supportedModes: ['text', 'image', 'vector'] },
  { id: 'pixtral-large-latest', provider: 'mistral', displayName: 'Pixtral Large Latest', supportedModes: ['text', 'image', 'vector'] },
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
  'Flat object illustration',
  'Monoline geometric vector',
  'Geometric silhouette',
  'Negative space cutout',
  'Abstract pictogram logo',
  'Seamless vector pattern',
  'Car wrap livery',
] as const;

export const DEFAULT_VECTOR_ART_STYLE = VECTOR_ART_STYLES[0];
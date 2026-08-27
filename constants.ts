import type { InputMode } from './types';

export type ModelProvider = 'google';

export const MODEL_PROVIDERS: readonly ModelProvider[] = ['google'];

export const MODEL_PROVIDER_LABELS: Record<ModelProvider, string> = {
  google: 'Google AI Studio (Gemini)',
};

export const GOOGLE_API_KEY_CHECK_MODEL = 'gemini-2.5-flash';

export type ModelDefinition = {
  id: string;
  provider: ModelProvider;
  displayName: string;
  supportedModes: readonly InputMode[];
  supportsQuickGenerate?: boolean;
};

export const AI_MODELS = [
  // --- Google AI Studio (Gemini Models) ---
  { id: 'gemini-2.5-flash', provider: 'google', displayName: 'Gemini 2.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-flash-lite', provider: 'google', displayName: 'Gemini 2.5 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-2.5-pro', provider: 'google', displayName: 'Gemini 2.5 Pro', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3-flash-preview', provider: 'google', displayName: 'Gemini 3 Flash Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-flash-lite', provider: 'google', displayName: 'Gemini 3.1 Flash Lite', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.1-pro-preview', provider: 'google', displayName: 'Gemini 3.1 Pro Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-3.5-flash', provider: 'google', displayName: 'Gemini 3.5 Flash', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-flash-latest', provider: 'google', displayName: 'Gemini Flash Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-flash-lite-latest', provider: 'google', displayName: 'Gemini Flash Lite Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-pro-latest', provider: 'google', displayName: 'Gemini Pro Latest', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
  { id: 'gemini-robotics-er-1.6-preview', provider: 'google', displayName: 'Gemini Robotics ER 1.6 Preview', supportedModes: ['text', 'image', 'vector', 'video'], supportsQuickGenerate: true },
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

export const DEFAULT_VECTOR_ART_STYLE = VECTOR_ART_STYLES[0];
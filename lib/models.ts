import { ApiModel, getModelDefinition } from '../constants';
import { ThinkingLevel } from '@google/genai';

/**
 * Checks whether a given Gemini model supports the Quick Generate feature.
 */
export const isQuickGenerateSupported = (model: ApiModel): boolean => {
  return getModelDefinition(model).supportsQuickGenerate ?? false;
};

/**
 * Applies the appropriate thinkingConfig (thinkingBudget or thinkingLevel) for Quick Generate.
 * This function cleanly modifies the provided generative configuration object.
 */
export const applyQuickGenerateConfig = (config: any, model: ApiModel, isQuick: boolean = false): void => {
  const modelName = model.split('/').pop() || model;
  const isGemini = model.includes('gemini') || modelName.includes('gemini');
  if (!isGemini) return;

  // Prompt generation = creative formatting task, bukan reasoning berat
  // thinkingBudget 0 = response instan tanpa delay thinking internal
  if (modelName.startsWith('gemini-3') || modelName.endsWith('-latest')) {
    config.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
  } else {
    config.thinkingConfig = { thinkingBudget: 0 };
  }
};

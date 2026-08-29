import React, { useState, useEffect, useCallback } from 'react';
import { StyleOption, PromptQualityOptionType, ModelId, InputMode, GenerationSettings } from '../types';
import { DEFAULT_MODEL, isModelSupportedForMode, DEFAULT_VECTOR_ART_STYLE, VECTOR_ART_STYLES } from '../constants';

type ModeSpecificSettings = {
  negativePrompt: string;
  numPrompts: number;
  workerCount: number;
  batchDelaySeconds: number;
  styleOption: StyleOption;
  promptQualityOption: PromptQualityOptionType;
  selectedModel: ModelId;
  customTemplate: string;
  targetFolderId: string | null;
  // Vector brainstorming specific
  vectorArtStyle?: string;
  vectorPreset?: string;
  vectorPose?: string;
  vectorAttributes?: string;
  vectorInstruction?: string;
  vectorReferenceImage?: string;
  vectorWhiteBg?: boolean;
};

const defaultTextSettings: ModeSpecificSettings & { conceptsInput: string } = {
  conceptsInput: '',
  negativePrompt: '',
  numPrompts: 10,
  workerCount: 4,
  batchDelaySeconds: 0,
  styleOption: 'photographic' as StyleOption,
  promptQualityOption: 'default' as PromptQualityOptionType,
  selectedModel: DEFAULT_MODEL,
  customTemplate: '',
  targetFolderId: null,
};

const defaultVectorSettings: ModeSpecificSettings & { conceptsInput: string } = {
  conceptsInput: '',
  negativePrompt: '',
  numPrompts: 5,
  workerCount: 4,
  batchDelaySeconds: 0,
  styleOption: 'vector' as StyleOption,
  promptQualityOption: 'default' as PromptQualityOptionType,
  selectedModel: DEFAULT_MODEL,
  customTemplate: '',
  targetFolderId: null,
  vectorArtStyle: 'Flat illustration',
  vectorPreset: 'Single Image',
  vectorPose: '',
  vectorAttributes: '',
  vectorInstruction: '',
  vectorReferenceImage: '',
  vectorWhiteBg: true,
};

const defaultImageSettings: ModeSpecificSettings = {
  negativePrompt: '',
  numPrompts: 10,
  workerCount: 4,
  batchDelaySeconds: 0,
  styleOption: 'photographic' as StyleOption,
  promptQualityOption: 'default' as PromptQualityOptionType,
  selectedModel: DEFAULT_MODEL,
  customTemplate: '',
  targetFolderId: null,
};

const defaultVideoSettings: ModeSpecificSettings = {
  negativePrompt: '',
  numPrompts: 5,
  workerCount: 2,
  batchDelaySeconds: 0,
  styleOption: 'footage' as StyleOption,
  promptQualityOption: 'default' as PromptQualityOptionType,
  selectedModel: DEFAULT_MODEL,
  customTemplate: '',
  targetFolderId: null,
};

const defaultAllSettings = {
  text: defaultTextSettings,
  image: defaultImageSettings,
  vector: defaultVectorSettings,
  video: defaultVideoSettings,
};

type AllSettings = typeof defaultAllSettings;
type SelectionTouchedState = Record<InputMode, {
  style: boolean;
  model: boolean;
  quality: boolean;
}>;

const defaultSelectionTouchedState: SelectionTouchedState = {
  text: { style: false, model: false, quality: false },
  image: { style: false, model: false, quality: false },
  vector: { style: false, model: false, quality: false },
  video: { style: false, model: false, quality: false },
};

const deriveSelectionTouchedState = (settings: AllSettings): SelectionTouchedState => ({
  text: {
    style: settings.text?.styleOption !== defaultAllSettings.text.styleOption,
    model: settings.text?.selectedModel !== defaultAllSettings.text.selectedModel,
    quality: settings.text?.promptQualityOption !== defaultAllSettings.text.promptQualityOption,
  },
  image: {
    style: settings.image?.styleOption !== defaultAllSettings.image.styleOption,
    model: settings.image?.selectedModel !== defaultAllSettings.image.selectedModel,
    quality: settings.image?.promptQualityOption !== defaultAllSettings.image.promptQualityOption,
  },
  vector: {
    style: settings.vector?.styleOption !== defaultAllSettings.vector.styleOption,
    model: settings.vector?.selectedModel !== defaultAllSettings.vector.selectedModel,
    quality: settings.vector?.promptQualityOption !== defaultAllSettings.vector.promptQualityOption,
  },
  video: {
    style: settings.video?.styleOption !== defaultAllSettings.video.styleOption,
    model: settings.video?.selectedModel !== defaultAllSettings.video.selectedModel,
    quality: settings.video?.promptQualityOption !== defaultAllSettings.video.promptQualityOption,
  },
});

export const useSettings = () => {
  const [inputMode, setInputMode] = useState<InputMode>(() => {
    try {
      if (typeof window === 'undefined') return 'vector';
      const item = window.localStorage.getItem('inputMode');
      const parsed = item ? JSON.parse(item) : 'vector';
      if (parsed === 'text' || parsed === 'image' || parsed === 'vector' || parsed === 'video') {
        return parsed;
      }
      return 'vector';
    } catch (error) {
      return 'vector';
    }
  });

  const [allSettings, setAllSettings] = useState<AllSettings>(() => {
    try {
      if (typeof window === 'undefined') return defaultAllSettings;
      const item = window.localStorage.getItem('allSettings');
      if (!item) return defaultAllSettings;
      const parsed = JSON.parse(item);
      const loadedVector = { ...defaultVectorSettings, ...(parsed?.vector || {}) };
      if (!VECTOR_ART_STYLES.includes(loadedVector.vectorArtStyle as any)) {
        loadedVector.vectorArtStyle = DEFAULT_VECTOR_ART_STYLE;
      }
      loadedVector.vectorReferenceImage = '';
      return {
        text: { ...defaultTextSettings, ...(parsed?.text || {}) },
        image: { ...defaultImageSettings, ...(parsed?.image || {}) },
        vector: loadedVector,
        video: { ...defaultVideoSettings, ...(parsed?.video || {}) },
      };
    } catch (error) {
      console.error(error);
      return defaultAllSettings;
    }
  });

  const [selectionTouchedState, setSelectionTouchedState] = useState<SelectionTouchedState>(() => {
    try {
      if (typeof window === 'undefined') return defaultSelectionTouchedState;
      const item = window.localStorage.getItem('selectionTouchedState');
      if (!item) return deriveSelectionTouchedState(allSettings);
      const parsed = JSON.parse(item);
      return {
        text: { ...defaultSelectionTouchedState.text, ...(parsed?.text || {}) },
        image: { ...defaultSelectionTouchedState.image, ...(parsed?.image || {}) },
        vector: { ...defaultSelectionTouchedState.vector, ...(parsed?.vector || {}) },
        video: { ...defaultSelectionTouchedState.video, ...(parsed?.video || {}) },
      };
    } catch (error) {
      console.error(error);
      return deriveSelectionTouchedState(allSettings);
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('selectionTouchedState', JSON.stringify(selectionTouchedState));
      }
    } catch (error) {
      console.error(error);
    }
  }, [selectionTouchedState]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('inputMode', JSON.stringify(inputMode));
      }
    } catch (error) {
      console.error(error);
    }
  }, [inputMode]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const settingsToSave = {
          ...allSettings,
          text: {
            ...allSettings.text,
            conceptsInput: ''
          },
          vector: {
            ...allSettings.vector,
            conceptsInput: '',
            vectorReferenceImage: ''
          }
        };
        window.localStorage.setItem('allSettings', JSON.stringify(settingsToSave));
      }
    } catch (error) {
      console.error('Failed to save settings to localStorage (quota or error):', error);
    }
  }, [allSettings]);

  useEffect(() => {
    const textStyle = allSettings.text?.styleOption;
    const videoStyle = allSettings.video?.styleOption;
    const selectedModel = allSettings[inputMode]?.selectedModel;

    if (inputMode === 'text' && textStyle === 'sameAsReference') {
      setAllSettings(s => ({ ...s, text: { ...s.text, styleOption: 'photographic' } }));
    }
    if (inputMode === 'vector' && allSettings.vector?.styleOption !== 'vector') {
      setAllSettings(s => ({ ...s, vector: { ...s.vector, styleOption: 'vector' } }));
    }
    if (inputMode === 'video' && videoStyle !== 'footage') {
      setAllSettings(s => ({ ...s, video: { ...s.video, styleOption: 'footage' } }));
    }
    if (selectedModel && !isModelSupportedForMode(selectedModel, inputMode)) {
      setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], selectedModel: DEFAULT_MODEL } }));
    }
  }, [inputMode, allSettings.text?.styleOption, allSettings.vector?.styleOption, allSettings.video?.styleOption, allSettings.text?.selectedModel, allSettings.image?.selectedModel, allSettings.vector?.selectedModel, allSettings.video?.selectedModel]);

  const setConceptsInput = useCallback((value: string) => {
    setAllSettings(s => ({
      ...s,
      text: { ...s.text, conceptsInput: value },
      vector: { ...(s.vector || defaultVectorSettings), conceptsInput: value },
    }));
  }, []);

  const setNegativePrompt = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], negativePrompt: value } }));
  }, [inputMode]);

  const setNumPrompts = useCallback((value: number) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], numPrompts: value } }));
  }, [inputMode]);

  const setWorkerCount = useCallback((value: number) => {
    const normalizedValue = Math.max(1, Math.min(50, Math.floor(value) || 1));
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], workerCount: normalizedValue } }));
  }, [inputMode]);

  const setBatchDelaySeconds = useCallback((value: number) => {
    const normalizedValue = Math.max(0, Math.min(300, Math.floor(value) || 0));
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], batchDelaySeconds: normalizedValue } }));
  }, [inputMode]);

  const setStyleOption = useCallback((value: StyleOption) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], styleOption: value } }));
    setSelectionTouchedState(s => ({ ...s, [inputMode]: { ...s[inputMode], style: true } }));
  }, [inputMode]);

  const setPromptQualityOption = useCallback((value: PromptQualityOptionType) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], promptQualityOption: value } }));
    setSelectionTouchedState(s => ({ ...s, [inputMode]: { ...s[inputMode], quality: true } }));
  }, [inputMode]);

  const setSelectedModel = useCallback((value: ModelId) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], selectedModel: value } }));
    setSelectionTouchedState(s => ({ ...s, [inputMode]: { ...s[inputMode], model: true } }));
  }, [inputMode]);

  const setCustomTemplate = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], customTemplate: value } }));
  }, [inputMode]);

  const setTargetFolderId = useCallback((value: string | null) => {
    setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], targetFolderId: value } }));
  }, [inputMode]);

  // Vector Specific Setters
  const setVectorArtStyle = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorArtStyle: value } }));
  }, []);

  const setVectorPreset = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorPreset: value } }));
  }, []);

  const setVectorPose = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorPose: value } }));
  }, []);

  const setVectorInstruction = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorInstruction: value, vectorAttributes: value } }));
  }, []);

  const setVectorReferenceImage = useCallback((value: string) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorReferenceImage: value } }));
  }, []);

  const setVectorWhiteBg = useCallback((value: boolean) => {
    setAllSettings(s => ({ ...s, vector: { ...(s.vector || defaultVectorSettings), vectorWhiteBg: value } }));
  }, []);

  const handleNumPromptsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumPrompts(Math.max(1, parseInt(e.target.value, 10) || 1));
  };

  const handleWorkerCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWorkerCount(parseInt(e.target.value, 10));
  };

  const handleBatchDelaySecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBatchDelaySeconds(parseInt(e.target.value, 10));
  };

  const currentModeSettings = allSettings[inputMode] || defaultAllSettings[inputMode] || defaultAllSettings.text;

  return {
    inputMode, setInputMode,
    conceptsInput: (currentModeSettings as any).conceptsInput ?? allSettings.text.conceptsInput, setConceptsInput,
    negativePrompt: currentModeSettings.negativePrompt, setNegativePrompt,
    numPrompts: currentModeSettings.numPrompts, setNumPrompts, handleNumPromptsChange,
    workerCount: currentModeSettings.workerCount, setWorkerCount, handleWorkerCountChange,
    batchDelaySeconds: currentModeSettings.batchDelaySeconds, setBatchDelaySeconds, handleBatchDelaySecondsChange,
    styleOption: currentModeSettings.styleOption, setStyleOption,
    promptQualityOption: currentModeSettings.promptQualityOption, setPromptQualityOption,
    selectedModel: currentModeSettings.selectedModel, setSelectedModel,
    customTemplate: currentModeSettings.customTemplate, setCustomTemplate,
    targetFolderId: currentModeSettings.targetFolderId, setTargetFolderId,
    hasUserSelectedStyleOption: selectionTouchedState[inputMode]?.style ?? false,
    hasUserSelectedModel: selectionTouchedState[inputMode]?.model ?? false,
    hasUserSelectedPromptQuality: selectionTouchedState[inputMode]?.quality ?? false,
    // Vector Brainstorming properties
    vectorArtStyle: allSettings.vector?.vectorArtStyle || 'Mascot Line Art',
    setVectorArtStyle,
    vectorPreset: allSettings.vector?.vectorPreset || 'Single Image',
    setVectorPreset,
    vectorPose: allSettings.vector?.vectorPose || '',
    setVectorPose,
    vectorAttributes: allSettings.vector?.vectorAttributes || '',
    setVectorAttributes,
    vectorInstruction: allSettings.vector?.vectorInstruction || allSettings.vector?.vectorAttributes || '',
    setVectorInstruction,
    vectorReferenceImage: allSettings.vector?.vectorReferenceImage || '',
    setVectorReferenceImage,
    vectorWhiteBg: allSettings.vector?.vectorWhiteBg ?? true,
    setVectorWhiteBg,
  };
};

export type UseSettingsReturn = ReturnType<typeof useSettings>;

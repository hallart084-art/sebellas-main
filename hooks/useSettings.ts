
import React, { useState, useEffect, useCallback } from 'react';
import { StyleOption, PromptQualityOptionType, ModelId, InputMode, GenerationSettings } from '../types';
import { DEFAULT_MODEL, isModelSupportedForMode } from '../constants';

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

const defaultVectorSettings: ModeSpecificSettings & {
  conceptsInput: string;
  vectorArtStyle: string;
  vectorPreset: string;
  vectorPose: string;
  vectorAttributes: string;
  vectorWhiteBg: boolean;
} = {
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
  vectorWhiteBg: true,
};

const defaultAllSettings = {
 text: defaultTextSettings,
 image: defaultImageSettings,
 video: defaultVideoSettings,
 vector: defaultVectorSettings,
};

type AllSettings = typeof defaultAllSettings;
type SelectionTouchedState = Record<InputMode, {
 style: boolean;
 model: boolean;
 quality: boolean;
}>;

const migrateLegacySettings = <T extends Record<string, any>>(settings: T): T => {
 const cleaned = { ...settings };
 delete cleaned.footageOutputFormat;
 if ((cleaned as any).promptQualityOption && !['default', 'xml'].includes((cleaned as any).promptQualityOption)) {
 (cleaned as any).promptQualityOption = 'default';
 }
 return cleaned;
};

const defaultSelectionTouchedState: SelectionTouchedState = {
 text: { style: false, model: false, quality: false },
 image: { style: false, model: false, quality: false },
 video: { style: false, model: false, quality: false },
};

const deriveSelectionTouchedState = (settings: AllSettings): SelectionTouchedState => ({
 text: {
 style: settings.text.styleOption !== defaultAllSettings.text.styleOption,
 model: settings.text.selectedModel !== defaultAllSettings.text.selectedModel,
 quality: settings.text.promptQualityOption !== defaultAllSettings.text.promptQualityOption,
 },
 image: {
 style: settings.image.styleOption !== defaultAllSettings.image.styleOption,
 model: settings.image.selectedModel !== defaultAllSettings.image.selectedModel,
 quality: settings.image.promptQualityOption !== defaultAllSettings.image.promptQualityOption,
 },
 video: {
 style: settings.video.styleOption !== defaultAllSettings.video.styleOption,
 model: settings.video.selectedModel !== defaultAllSettings.video.selectedModel,
 quality: settings.video.promptQualityOption !== defaultAllSettings.video.promptQualityOption,
 },
});

export const useSettings = () => {
 const [inputMode, setInputMode] = useState<InputMode>(() => {
 try {
 if (typeof window === 'undefined') return 'text';
 const item = window.localStorage.getItem('inputMode');
 const parsed = item ? JSON.parse(item) : 'text';
 if (parsed === 'text' || parsed === 'image' || parsed === 'video') {
 return parsed;
 }
 return 'text';
 } catch (error) {
 return 'text';
 }
 });

 const [allSettings, setAllSettings] = useState<AllSettings>(() => {
 try {
 if (typeof window === 'undefined') return defaultAllSettings;
 const item = window.localStorage.getItem('allSettings');
 if (!item) return defaultAllSettings;
 const parsed = JSON.parse(item);
 
 const textSettings = migrateLegacySettings(parsed && parsed.text ? { ...defaultAllSettings.text, ...parsed.text } : defaultAllSettings.text);
 const imageSettings = migrateLegacySettings(parsed && parsed.image ? { ...defaultAllSettings.image, ...parsed.image } : defaultAllSettings.image);
 const videoSettings = migrateLegacySettings(parsed && parsed.video ? { ...defaultAllSettings.video, ...parsed.video } : defaultAllSettings.video);

 return {
 text: { 
 ...textSettings,
 conceptsInput: '', // FORCE CLEAR on initialization
 },
 image: imageSettings,
 video: videoSettings,
 };
 } catch (error) {
 return defaultAllSettings;
 }
 });
 const [selectionTouchedState, setSelectionTouchedState] = useState<SelectionTouchedState>(() => {
 try {
 if (typeof window === 'undefined') return defaultSelectionTouchedState;
 const item = window.localStorage.getItem('allSettings');
 if (!item) return defaultSelectionTouchedState;
 const parsed = JSON.parse(item);

 const textSettings = parsed && parsed.text ? { ...defaultAllSettings.text, ...parsed.text } : defaultAllSettings.text;
 const imageSettings = parsed && parsed.image ? { ...defaultAllSettings.image, ...parsed.image } : defaultAllSettings.image;
 const videoSettings = parsed && parsed.video ? { ...defaultAllSettings.video, ...parsed.video } : defaultAllSettings.video;

 return deriveSelectionTouchedState({
 text: textSettings,
 image: imageSettings,
 video: videoSettings,
 });
 } catch (error) {
 return defaultSelectionTouchedState;
 }
 });

 useEffect(() => {
 try {
 if (typeof window !== 'undefined') {
 window.localStorage.setItem('inputMode', JSON.stringify(inputMode));
 }
 } catch (error) { console.error(error); }
 }, [inputMode]);

 useEffect(() => {
 try {
 if (typeof window !== 'undefined') {
 // Prevent conceptsInput from being persisted to localStorage
 const settingsToSave = {
 ...allSettings,
 text: {
 ...allSettings.text,
 conceptsInput: ''
 }
 };
 window.localStorage.setItem('allSettings', JSON.stringify(settingsToSave));
 }
 } catch (error) { console.error(error); }
 }, [allSettings]);

 useEffect(() => {
 const textStyle = allSettings.text?.styleOption;
 const videoStyle = allSettings.video?.styleOption;
 const selectedModel = allSettings[inputMode]?.selectedModel;
 if (inputMode === 'text' && textStyle === 'sameAsReference') {
 setAllSettings(s => ({ ...s, text: { ...s.text, styleOption: 'photographic' } }));
 }
 if (inputMode === 'video' && videoStyle !== 'footage') {
 setAllSettings(s => ({ ...s, video: { ...s.video, styleOption: 'footage' } }));
        }
        if (selectedModel && !isModelSupportedForMode(selectedModel, inputMode)) {
            setAllSettings(s => ({ ...s, [inputMode]: { ...s[inputMode], selectedModel: DEFAULT_MODEL } }));
        }
    }, [inputMode, allSettings.text?.styleOption, allSettings.video?.styleOption, allSettings.text?.selectedModel, allSettings.image?.selectedModel, allSettings.video?.selectedModel]);

    const setConceptsInput = useCallback((value: string) => {
        setAllSettings(s => ({ ...s, text: { ...s.text, conceptsInput: value } }));
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

    const handleNumPromptsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNumPrompts(Math.max(1, parseInt(e.target.value, 10) || 1));
    };

    const handleWorkerCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setWorkerCount(parseInt(e.target.value, 10));
    };

    const handleBatchDelaySecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBatchDelaySeconds(parseInt(e.target.value, 10));
    };

    const setVectorArtStyle = useCallback((value: string) => {
        setAllSettings(s => ({ ...s, vector: { ...s.vector, vectorArtStyle: value } }));
    }, []);

    const setVectorPreset = useCallback((value: string) => {
        setAllSettings(s => ({ ...s, vector: { ...s.vector, vectorPreset: value } }));
    }, []);

    const setVectorPose = useCallback((value: string) => {
        setAllSettings(s => ({ ...s, vector: { ...s.vector, vectorPose: value } }));
    }, []);

    const setVectorAttributes = useCallback((value: string) => {
        setAllSettings(s => ({ ...s, vector: { ...s.vector, vectorAttributes: value } }));
    }, []);

    const setVectorWhiteBg = useCallback((value: boolean) => {
        setAllSettings(s => ({ ...s, vector: { ...s.vector, vectorWhiteBg: value } }));
    }, []);

    const currentModeSettings = allSettings[inputMode] || defaultAllSettings[inputMode] || defaultAllSettings.text;
    const vectorSettings = allSettings.vector || defaultAllSettings.vector;

    return {
        inputMode, setInputMode,
        conceptsInput: (inputMode === 'vector' ? vectorSettings.conceptsInput : allSettings.text.conceptsInput), setConceptsInput,
        negativePrompt: currentModeSettings.negativePrompt, setNegativePrompt,
        numPrompts: currentModeSettings.numPrompts, setNumPrompts,
        workerCount: currentModeSettings.workerCount, setWorkerCount,
        batchDelaySeconds: currentModeSettings.batchDelaySeconds, setBatchDelaySeconds,
        styleOption: currentModeSettings.styleOption, setStyleOption,
        promptQualityOption: currentModeSettings.promptQualityOption, setPromptQualityOption,
        selectedModel: currentModeSettings.selectedModel, setSelectedModel,
        customTemplate: currentModeSettings.customTemplate, setCustomTemplate,
        targetFolderId: currentModeSettings.targetFolderId, setTargetFolderId,
        vectorArtStyle: vectorSettings.vectorArtStyle, setVectorArtStyle,
        vectorPreset: vectorSettings.vectorPreset, setVectorPreset,
        vectorPose: vectorSettings.vectorPose, setVectorPose,
        vectorAttributes: vectorSettings.vectorAttributes, setVectorAttributes,
        vectorWhiteBg: vectorSettings.vectorWhiteBg, setVectorWhiteBg,
        hasUserSelectedStyleOption: selectionTouchedState[inputMode]?.style ?? false,
        hasUserSelectedModel: selectionTouchedState[inputMode]?.model ?? false,
        hasUserSelectedPromptQuality: selectionTouchedState[inputMode]?.quality ?? false,
        handleNumPromptsChange,
        handleWorkerCountChange,
        handleBatchDelaySecondsChange,
    };
};

export type UseSettingsReturn = ReturnType<typeof useSettings>;

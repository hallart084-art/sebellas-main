import React, { memo } from 'react';
import Spinner from './Spinner';
import { ModelId, InputMode } from '../types';
import { useLocalizationContext } from '../contexts/LocalizationContext';
import { isQuickGenerateSupported } from '../lib/models';

interface GenerationControlsProps {
 isApiInitialized: boolean;
 isLoading: boolean;
 selectedModel: ModelId;
 inputMode: InputMode;
 isDisabled?: boolean;
 onGenerate: (isQuick: boolean) => void;
}

const GenerationControls: React.FC<GenerationControlsProps> = ({ isApiInitialized, isLoading, isDisabled = false, selectedModel, inputMode, onGenerate }) => { const { t } = useLocalizationContext();
 const showQuickGenerate = isQuickGenerateSupported(selectedModel);
 const rawGenerateLabel = t('generatePromptsButton');
 const compactGenerateLabel = rawGenerateLabel.replace(/\bprompts?\b/gi, '').replace(/\s{2,}/g, ' ').trim() || rawGenerateLabel;

 return (
 <section className="editorial-generation-controls mt-0">
 <div className="flex flex-col items-center">
 <div className="generation-controls-row flex items-center gap-3 w-full">
 <button
 onClick={() => onGenerate(false)}
 disabled={isLoading || isDisabled}
 style={!isApiInitialized && !isLoading && !isDisabled ? { cursor: 'not-allowed' } : undefined}
 className="btn btn-primary generation-main-btn generation-compact-btn flex-1"
 aria-live="polite"
 >
 {isLoading ? (
 <span className="generation-btn-loading-content inline-flex items-center justify-center">
 <Spinner size="w-5 h-5" color="border-white" />
 <span className="generation-btn-loading-label ml-2">{t('processingButton')}</span>
 </span>
 ) : (
 <span className="generation-btn-content inline-flex items-center justify-center">
 <span className="material-symbols-outlined generation-btn-icon">auto_awesome</span>
 <span className="generation-btn-label">{compactGenerateLabel}</span>
 </span>
 )}
 </button>
 {showQuickGenerate && (
 <button
 onClick={() => onGenerate(true)}
 disabled={isLoading || isDisabled}
 style={!isApiInitialized && !isLoading && !isDisabled ? { cursor: 'not-allowed' } : undefined}
 className="btn btn-success generation-main-btn generation-compact-btn flex-1"
 aria-live="polite"
 >
 {isLoading ? (
 <span className="generation-btn-loading-content inline-flex items-center justify-center">
 <Spinner size="w-5 h-5" color="border-white" />
 <span className="generation-btn-loading-label ml-2">{t('processingButton')}</span>
 </span>
 ) : (
 <span className="generation-btn-content inline-flex items-center justify-center">
 <span className="material-symbols-outlined generation-btn-icon">bolt</span>
 <span className="generation-btn-label">{t('quickGenerateButton')}</span>
                                </span>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </section>
    );
};

export default memo(GenerationControls);

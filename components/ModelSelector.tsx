
import React, { useEffect, useMemo, useState, memo } from 'react';
import { createPortal } from 'react-dom';

import { ModelId } from '../types';
import { MODEL_PROVIDER_LABELS, MODEL_PROVIDERS, getModelDisplayName, getModelProvider, ModelProvider } from '../constants';

interface ModelSelectorProps {
 id?: string;
 currentModel: ModelId;
 availableModels: readonly ModelId[];
 onModelChange: (model: ModelId) => void;
 className?: string;
 disabled?: boolean;
 inline?: boolean;
 iconOnly?: boolean;
}

const ModelSelector: React.FC<ModelSelectorProps> = ({
 id,
 currentModel,
 availableModels,
 onModelChange,
 className,
 disabled = false,
 inline = false,
 iconOnly = false,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const [searchQuery, setSearchQuery] = useState('');

 const toPrettyLabel = (model: ModelId): string => getModelDisplayName(model);

 const filteredModels = useMemo(() => {
 const query = searchQuery.trim().toLowerCase();
 if (!query) return availableModels;
 return availableModels.filter(model => {
 const provider = getModelProvider(model);
 return `${provider} ${toPrettyLabel(model)} ${model}`.toLowerCase().includes(query);
 });
 }, [availableModels, searchQuery]);

 const groupedModels = useMemo(() => {
 return Object.fromEntries(
 MODEL_PROVIDERS.map(provider => [
 provider,
 filteredModels.filter(model => getModelProvider(model) === provider),
 ])
 ) as Record<ModelProvider, ModelId[]>;
 }, [filteredModels]);

 useEffect(() => {
 if (!isOpen) return;
 const handleEsc = (e: KeyboardEvent) => {
 if (e.key === 'Escape') setIsOpen(false);
 };
 document.addEventListener('keydown', handleEsc);
 return () => document.removeEventListener('keydown', handleEsc);
 }, [isOpen]);

 const handleModelSelect = (model: ModelId) => {
 onModelChange(model);
 setIsOpen(false);
 setSearchQuery('');
 };

 const getProviderLabel = (provider: ModelProvider): string => MODEL_PROVIDER_LABELS[provider];

 const renderProviderIcon = (provider: ModelProvider) => {
 if (provider === 'google') {
 return (
 <img
 className="model-picker-gemini-icon"
 src="https://commons.wikimedia.org/wiki/Special:FilePath/Google_Gemini_icon_2025.svg"
 alt="Gemini"
 />
 );
 }

 if (provider === 'groq') {
 return (
 <svg
 className="model-picker-groq-icon"
 xmlns="http://www.w3.org/2000/svg"
 width="600"
 height="600"
 fill="none"
 viewBox="0 0 600 600"
 aria-label="Groq"
 >
 <path
 fill="currentColor"
 fillRule="evenodd"
 d="M300.9 50c-96.3-.9-175 75-175.9 169.5s76.4 171.8 172.7 172.7h60.5v-64.1h-57.3a108 108 0 0 1-110.2-105.8c-.7-59 47.5-107.5 107.7-108.1h2.5A108 108 0 0 1 410 221.1v157.6c0 58.6-48.6 106.3-108 107a109 109 0 0 1-75.9-31.3L180 499.9A175 175 0 0 0 300.7 550h2.3c95.1-1.4 171.5-77 172-170.4V217.1C472.7 124.1 395.4 50 300.9 50"
 clipRule="evenodd"
 />
 </svg>
 );
 }

 if (provider === 'openrouter') {
 return (
 <svg
 className="model-picker-openrouter-icon"
 fill="currentColor"
 fillRule="evenodd"
 height={18}
 width={18}
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 >
 <title>OpenRouter</title>
 <path d="M18.654 3.87a5.087 5.087 0 110 10.174L23.7 19.09c.64.641.187 1.737-.72 1.737H8.48a8.479 8.479 0 010-16.958h10.175zM8.479 7.26a5.087 5.087 0 100 10.176 5.087 5.087 0 000-10.175z" />
 </svg>
 );
 }

 return (
 <svg
 className="model-picker-mistral-icon"
 xmlns="http://www.w3.org/2000/svg"
 viewBox="0 0 24 24"
 aria-label="Mistral"
 >
 <path d="M3 5h4v4h3v4h4V9h3V5h4v14h-4v-6h-3v4h-4v-4H7v6H3V5z" fill="currentColor" />
 </svg>
 );
 };

 const renderModelGroup = (provider: ModelProvider, models: ModelId[]) => {
 if (models.length === 0) return null;
 const providerLabel = getProviderLabel(provider);
 return (
 <>
 <div className="model-picker-group-label">{providerLabel}</div>
 <div className="model-picker-list">
 {models.map((model) => (
 <button
 key={model}
 type="button"
 className={`model-picker-item ${model === currentModel ? 'active' : ''}`}
 onClick={() => handleModelSelect(model)}
 >
 <span className="model-picker-item-left">
 {renderProviderIcon(provider)}
 <span className="model-picker-item-text">{toPrettyLabel(model)}</span>
 </span>
 {model === currentModel && <span className="model-picker-default-pill">Default</span>}
 </button>
 ))}
 </div>
 </>
 );
 };
 
 const triggerButtonClasses = inline 
 ? `footer-transient-btn footer-selector-pill flex items-center ${iconOnly ? 'justify-center px-0 gap-0 w-full' : 'justify-start gap-1.5 w-full'} text-[12px] text-gray-500 transition-colors font-medium`
 : `flat-input w-full text-sm flex items-center justify-between text-left`;

 const popupMenu = (
 <div
 className="model-picker-overlay"
 onMouseDown={(e) => {
 if (e.target === e.currentTarget) {
 setIsOpen(false);
 }
 }}
 role="presentation"
 >
 <div
 className="model-picker-card"
 role="dialog"
 aria-modal="true"
 aria-label="Model selector"
 onMouseDown={(e) => e.stopPropagation()}
 >
 <div className="model-picker-search-wrap">
 <span className="material-symbols-outlined">search</span>
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="model-picker-search"
 placeholder="Search models..."
 autoFocus
 />
 </div>

 <div className="model-picker-scroll-area">
 {MODEL_PROVIDERS.map(provider => (
 <React.Fragment key={provider}>
 {renderModelGroup(provider, groupedModels[provider])}
 </React.Fragment>
 ))}
 {filteredModels.length === 0 && (
 <div className="model-picker-empty">No models found</div>
 )}
 </div>
 </div>
 </div>
 );

 return (
 <div className={`relative ${inline ? 'inline-flex items-center' : 'w-full'} ${className || ''}`} style={inline ? { width: iconOnly ? '42px' : '166px', flexShrink: 0 } : undefined}>
 <button
 id={id}
 onClick={() => {
 const nextOpenState = !isOpen;
 setIsOpen(nextOpenState);
 if (nextOpenState) setSearchQuery('');
 }}
 className={triggerButtonClasses}
 aria-haspopup="dialog"
 aria-expanded={isOpen}
 aria-label={`Select model, current model ${currentModel}`}
 disabled={disabled}
 >
 <span className={`inline-flex items-center min-w-0 ${iconOnly ? 'justify-center' : 'gap-1 flex-1'}`}>
 {renderProviderIcon(getModelProvider(currentModel))}
 {!iconOnly && <span className="truncate">{toPrettyLabel(currentModel)}</span>}
 </span>
 {!iconOnly && (
 <svg 
 className="inline-block w-4 h-4 ml-0.5 transition-transform duration-[180ms] flex-shrink-0"
 style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 )}
 </button>
 {isOpen && typeof document !== 'undefined' && createPortal(popupMenu, document.body)}
    </div>
  );
};

export default memo(ModelSelector);



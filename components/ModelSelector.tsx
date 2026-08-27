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
      return `${toPrettyLabel(model)} ${model}`.toLowerCase().includes(query);
    });
  }, [availableModels, searchQuery]);

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

  const renderProviderIcon = (_provider?: ModelProvider) => {
    return (
      <img
        className="model-picker-gemini-icon"
        src="https://commons.wikimedia.org/wiki/Special:FilePath/Google_Gemini_icon_2025.svg"
        alt="Gemini"
      />
    );
  };

  const getModelBadge = (model: ModelId) => {
    if (model.includes('flash-lite')) return 'Lite';
    if (model.includes('flash')) return 'Flash';
    if (model.includes('pro')) return 'Pro';
    if (model.includes('preview')) return 'Preview';
    return null;
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
            placeholder="Search Google AI Studio models..."
            autoFocus
          />
        </div>

        <div className="model-picker-scroll-area">
          <div className="model-picker-group-label">Google AI Studio (Gemini)</div>
          <div className="model-picker-list">
            {filteredModels.map((model) => {
              const badge = getModelBadge(model);
              return (
                <button
                  key={model}
                  type="button"
                  className={`model-picker-item ${model === currentModel ? 'active' : ''}`}
                  onClick={() => handleModelSelect(model)}
                >
                  <span className="model-picker-item-left">
                    {renderProviderIcon()}
                    <span className="model-picker-item-text">{toPrettyLabel(model)}</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    {badge && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        badge === 'Flash' ? 'bg-amber-500/20 text-amber-300' :
                        badge === 'Pro' ? 'bg-indigo-500/20 text-indigo-300' :
                        badge === 'Lite' ? 'bg-emerald-500/20 text-emerald-300' :
                        'bg-blue-500/20 text-blue-300'
                      }`}>
                        {badge}
                      </span>
                    )}
                    {model === currentModel && <span className="model-picker-default-pill">Active</span>}
                  </div>
                </button>
              );
            })}
          </div>
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
        <span className={`inline-flex items-center min-w-0 ${iconOnly ? 'justify-center' : 'gap-1.5 flex-1'}`}>
          {renderProviderIcon()}
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



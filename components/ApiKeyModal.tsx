import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './Spinner';

import { useLocalizationContext } from '../contexts/LocalizationContext';
import { useDropdownPosition } from '../hooks/useDropdownPosition';
import { MODEL_PROVIDER_LABELS, getModelProvider } from '../constants';
import type { ApiModel, ModelProvider } from '../constants';
import { normalizeApiKeyList, type ApiKeyCheckResult, type ProviderApiKeys, type ProviderApiStatus } from '../hooks/useGemini';

const API_KEY_MODAL_CLOSE_ANIMATION_MS = 300;

interface ApiKeyModalProps {
  onClose: () => void;
  onSave: (keys: ProviderApiKeys) => void;
  onCheck: (provider: ModelProvider, key: string, checkModel?: ApiModel) => Promise<ApiKeyCheckResult>;
  currentApiKeys: ProviderApiKeys;
  apiStatus: ProviderApiStatus;
  selectedModel: ApiModel;
  isSidebarOpen: boolean;
  onModelChange?: (model: ApiModel) => void;
}

const DEFAULT_PROVIDER_MODELS: Record<ModelProvider, ApiModel> = {
  google: 'gemini-2.5-flash',
  groq: 'llama-3.2-11b-vision-preview',
  github: 'gpt-4o-mini',
  mistral: 'pixtral-12b-2409',
  openai: 'gpt-4o-mini',
  openrouter: 'meta-llama/llama-3.2-11b-vision-instruct:free',
};

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose, onSave, onCheck, currentApiKeys, apiStatus, selectedModel, isSidebarOpen, onModelChange }) => {
  
  const { t } = useLocalizationContext();
  const [localApiKeyText, setLocalApiKeyText] = useState<Record<ModelProvider, string>>({
    google: currentApiKeys.google.join('\n'),
    groq: currentApiKeys.groq.join('\n'),
    github: currentApiKeys.github?.join('\n') ?? '',
    mistral: currentApiKeys.mistral.join('\n'),
    openai: currentApiKeys.openai?.join('\n') ?? '',
    openrouter: currentApiKeys.openrouter?.join('\n') ?? '',
  });
  const [selectedProvider, setSelectedProvider] = useState<ModelProvider>(() => getModelProvider(selectedModel));
  const [isChecking, setIsChecking] = useState<Record<ModelProvider, boolean>>({ google: false, groq: false, github: false, mistral: false, openai: false, openrouter: false });
  const [checkResult, setCheckResult] = useState<Record<ModelProvider, {status: 'success' | 'warning' | 'error', message: string} | null>>({ google: null, groq: null, github: null, mistral: null, openai: null, openrouter: null });
  const [keyCheckStatuses, setKeyCheckStatuses] = useState<Record<ModelProvider, Record<string, 'valid' | 'limited' | 'invalid'>>>({ google: {}, groq: {}, github: {}, mistral: {}, openai: {}, openrouter: {} });
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [apiKeyTextareaScrollTop, setApiKeyTextareaScrollTop] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const providerTriggerRef = useRef<HTMLButtonElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const { dropdownRef: providerDropdownRef, dropdownStyle: providerDropdownStyle } = useDropdownPosition({
    isOpen: isProviderDropdownOpen,
    triggerRef: providerTriggerRef,
    onClose: () => setIsProviderDropdownOpen(false),
    matchTriggerWidth: true,
    minWidth: 190,
  });

  useEffect(() => {
    setLocalApiKeyText({
      google: currentApiKeys.google.join('\n'),
      github: currentApiKeys.github?.join('\n') ?? '',
      groq: currentApiKeys.groq.join('\n'),
      mistral: currentApiKeys.mistral.join('\n'),
      openrouter: currentApiKeys.openrouter?.join('\n') ?? '',
    });
  }, [currentApiKeys]);
  
  useEffect(() => {
    setCheckResult({ google: null, github: null, groq: null, mistral: null, openrouter: null });
  }, []);

  const requestClose = useCallback(() => {
    if (isClosing) return;
    setIsProviderDropdownOpen(false);
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
    }, API_KEY_MODAL_CLOSE_ANIMATION_MS);
  }, [isClosing, onClose]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  // Listen to Escape key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isProviderDropdownOpen) {
          setIsProviderDropdownOpen(false);
          return;
        }
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProviderDropdownOpen, requestClose]);

  const handleSave = () => {
    onSave({
      google: normalizeApiKeyList(localApiKeyText.google),
      groq: normalizeApiKeyList(localApiKeyText.groq),
      github: normalizeApiKeyList(localApiKeyText.github),
      mistral: normalizeApiKeyList(localApiKeyText.mistral),
      openai: normalizeApiKeyList(localApiKeyText.openai),
      openrouter: normalizeApiKeyList(localApiKeyText.openrouter),
    });
    if (onModelChange) {
      onModelChange(DEFAULT_PROVIDER_MODELS[selectedProvider]);
    }
    requestClose();
  };

  const handleCheck = async (provider: ModelProvider) => {
    const keys = normalizeApiKeyList(localApiKeyText[provider]);
    if (keys.length === 0) return;
    setIsChecking(prev => ({ ...prev, [provider]: true }));
    setCheckResult(prev => ({ ...prev, [provider]: null }));

    const results = await Promise.all(keys.map(key => onCheck(provider, key, selectedModel)));
    setKeyCheckStatuses(prev => ({
      ...prev,
      [provider]: Object.fromEntries(keys.map((key, index) => [
        key,
        results[index].success ? 'valid' : (results[index].reason === 'limited' ? 'limited' : 'invalid'),
      ])),
    }));
    const validCount = results.filter(result => result.success).length;
    const limitedCount = results.filter(result => result.reason === 'limited').length;
    const invalidCount = results.length - validCount - limitedCount;

    if (validCount === results.length) {
        setCheckResult(prev => ({ ...prev, [provider]: { status: 'success', message: t('apiKeyCheckAllSuccess', { count: validCount }) } }));
    } else if (validCount > 0) {
        setCheckResult(prev => ({ ...prev, [provider]: { status: 'warning', message: t('apiKeyCheckPartial', { valid: validCount, limited: limitedCount, invalid: invalidCount }) } }));
    } else {
        setCheckResult(prev => ({ ...prev, [provider]: { status: 'error', message: t('apiKeyCheckAllFailed', { limited: limitedCount, invalid: invalidCount }) } }));
    }
    setIsChecking(prev => ({ ...prev, [provider]: false }));
  };

  const handleRemoveDeadKeysFromModal = (provider: ModelProvider) => {
    const currentKeys = normalizeApiKeyList(localApiKeyText[provider]);
    const statuses = keyCheckStatuses[provider] || {};
    const validOnlyKeys = currentKeys.filter(k => statuses[k] !== 'invalid' && statuses[k] !== 'limited');
    const removedCount = currentKeys.length - validOnlyKeys.length;

    setLocalApiKeyText(prev => ({ ...prev, [provider]: validOnlyKeys.join('\n') }));
    setKeyCheckStatuses(prev => ({ ...prev, [provider]: {} }));
    setCheckResult(prev => ({
      ...prev,
      [provider]: {
        status: 'success',
        message: `${removedCount} API Key yang mati/limit telah berhasil dihapus.`,
      },
    }));
  };
  
  const handleInputChange = (provider: ModelProvider, value: string) => {
    // Convert commas to newlines so the masking dots render correctly line-by-line
    const formattedValue = value.replace(/,/g, '\n');
    setLocalApiKeyText(prev => ({ ...prev, [provider]: formattedValue }));
    setCheckResult(prev => ({ ...prev, [provider]: null }));
    setKeyCheckStatuses(prev => ({ ...prev, [provider]: {} }));
  };

  const maskApiKeyLine = (line: string): string => {
    const trimmedEndLength = line.length - line.trimEnd().length;
    const trimmedLine = line.trimEnd();
    if (!trimmedLine) return line;

    const visibleTailLength = Math.min(6, trimmedLine.length);
    const hiddenLength = Math.max(0, trimmedLine.length - visibleTailLength);
    const maskedPrefix = '.'.repeat(hiddenLength);
    return `${maskedPrefix}${trimmedLine.slice(-visibleTailLength)}${' '.repeat(trimmedEndLength)}`;
  };

  const getApiKeyLineStatus = (provider: ModelProvider, line: string): 'valid' | 'limited' | 'invalid' | undefined => {
    const key = line.trim();
    if (!key) return undefined;
    return keyCheckStatuses[provider][key];
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const isTextFile = file.name.toLowerCase().endsWith('.txt') || file.type === 'text/plain';
    if (!isTextFile) {
      setCheckResult(prev => ({ ...prev, [selectedProvider]: { status: 'error', message: 'Import only supports .txt API key files.' } }));
      return;
    }

    try {
      const fileText = await file.text();
      const importedKeys = normalizeApiKeyList(fileText);
      if (importedKeys.length === 0) {
        setCheckResult(prev => ({ ...prev, [selectedProvider]: { status: 'error', message: 'No API keys found in the imported file.' } }));
        return;
      }
      setLocalApiKeyText(prev => ({
        ...prev,
        [selectedProvider]: normalizeApiKeyList([...normalizeApiKeyList(prev[selectedProvider]), ...importedKeys]).join('\n'),
      }));
      setCheckResult(prev => ({ ...prev, [selectedProvider]: { status: 'success', message: `${importedKeys.length} API key(s) imported.` } }));
      setKeyCheckStatuses(prev => ({ ...prev, [selectedProvider]: {} }));
    } catch {
      setCheckResult(prev => ({ ...prev, [selectedProvider]: { status: 'error', message: 'Failed to import API key file.' } }));
    }
  };

  const providerOptions: Array<{ provider: ModelProvider; label: string; apiLabel: string }> = [
    { provider: 'google', label: 'Gemini', apiLabel: 'Gemini API Key' },
    { provider: 'github', label: 'GitHub', apiLabel: 'GitHub Token (PAT)' },
    { provider: 'groq', label: 'Groq', apiLabel: 'Groq API Key' },
    { provider: 'mistral', label: 'Mistral', apiLabel: 'Mistral API Key' },
    { provider: 'openrouter', label: 'OpenRouter', apiLabel: 'OpenRouter API Key' },
  ];

  const selectedResult = checkResult[selectedProvider];
  const selectedLabel = MODEL_PROVIDER_LABELS[selectedProvider];
  const selectedInitialized = apiStatus[selectedProvider];
  const selectedOption = providerOptions.find(option => option.provider === selectedProvider) ?? providerOptions[0];
  const selectedKeyCount = normalizeApiKeyList(localApiKeyText[selectedProvider]).length;
  const hasAnyLocalKey = normalizeApiKeyList(localApiKeyText.google).length > 0
    || normalizeApiKeyList(localApiKeyText.github).length > 0
    || normalizeApiKeyList(localApiKeyText.groq).length > 0
    || normalizeApiKeyList(localApiKeyText.mistral).length > 0
    || normalizeApiKeyList(localApiKeyText.openrouter).length > 0;

  const handleProviderSelect = (provider: ModelProvider) => {
    setSelectedProvider(provider);
    setIsProviderDropdownOpen(false);
    setApiKeyTextareaScrollTop(0);
    if (onModelChange) {
      onModelChange(DEFAULT_PROVIDER_MODELS[provider]);
    }
  };

  const providerDropdownMenu = (
    <div
      ref={providerDropdownRef}
      className="dropdown-menu-portal p-1"
      style={providerDropdownStyle}
      role="menu"
      aria-orientation="vertical"
      aria-labelledby="apiProviderDropdownButton"
    >
      <div className="selector-options-list max-h-60 overflow-y-auto flex flex-col gap-0.5">
        {providerOptions.map((option) => (
          <button
            key={option.provider}
            type="button"
            onClick={() => handleProviderSelect(option.provider)}
            className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${option.provider === selectedProvider ? 'active' : ''}`}
            role="menuitemradio"
            aria-checked={option.provider === selectedProvider}
          >
            <span className="truncate">{option.label}</span>
            {option.provider === selectedProvider && <span className="material-symbols-outlined text-base">check</span>}
          </button>
        ))}
      </div>
    </div>
  );

  const content = (
    <div 
      className={`modal-backdrop-container ${isClosing ? 'animate-fade-out' : 'animate-fade-in'} ${isSidebarOpen ? 'sidebar-active' : ''} overlay-darkness`}
      onClick={requestClose}
    >
      <div 
        role="dialog"
        className={`modal-card api-key-modal-card p-6 relative w-full rounded-[20px] shadow-xl ${isClosing ? 'animate-slide-out-bottom-right-center' : 'animate-slide-in-bottom-right-center'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          onClick={requestClose}
          className="api-key-modal-close-btn absolute top-3 right-3 text-gray-400 transition-colors"
          aria-label="Close modal"
          type="button"
        >
          <span className="material-symbols-outlined text-xl">close</span>
        </button>

        <div className="relative z-[1]">
          <style>{`
            #apiKeyModalTitle { font-size: 17px !important; }
            #apiKeyModalLegendText { font-size: 13px !important; }
            .api-key-modal-layout label,
            .api-key-modal-layout button,
            .api-key-modal-layout a,
            .api-key-modal-layout textarea,
            .api-key-modal-layout .api-key-mask-overlay,
            .api-key-modal-layout p,
            .api-key-modal-layout div {
              font-size: 12px !important;
            }
            .api-key-modal-layout textarea:focus {
              color: var(--text-primary) !important;
              -webkit-text-fill-color: var(--text-primary) !important;
            }
            .api-key-modal-actions button {
              font-size: 13px !important;
            }
          `}</style>
          <h2 id="apiKeyModalTitle" className="font-bold mb-2 pr-6">{t('apiKeySectionLabel')}</h2>
          
          <p id="apiKeyModalLegendText" className="mb-4 legend-text max-w-[32rem]">{t('tooltip_API_KEY_INPUT')}</p>

          <div className="api-key-modal-layout">
            <div>
              <div className="flex items-center ml-0.5 mb-2 h-4">
                <label htmlFor="apiProviderDropdownButton" className="advanced-settings-field-label block mb-0" style={{ fontSize: '12px' }}>
                  {t('modelApiLabel')}
                </label>
              </div>
              <button
                id="apiProviderDropdownButton"
                ref={providerTriggerRef}
                type="button"
                onClick={() => setIsProviderDropdownOpen(prev => !prev)}
                className="dropdown-trigger-button api-provider-dropdown-trigger flat-input w-full flex items-center justify-between text-left"
                aria-haspopup="true"
                aria-expanded={isProviderDropdownOpen}
                style={{ paddingTop: '0.5rem', paddingBottom: '0.5rem', fontSize: '12px' }}
              >
                <span className="truncate min-w-0 flex-1 pr-1 text-left">{selectedOption.label}</span>
                <svg
                  className="inline-block w-4 h-4 ml-0.5 transition-transform duration-[180ms] flex-shrink-0"
                  style={{ transform: isProviderDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex items-center justify-between ml-0.5 mb-2 h-4">
                <label htmlFor={`${selectedProvider}ApiKeyInputModal`} className="advanced-settings-field-label block mb-0" style={{ fontSize: '12px' }}>
                  {selectedOption.apiLabel}
                </label>
                <a 
                  href={
                    selectedProvider === 'google' ? 'https://aistudio.google.com/app/apikey' : 
                    selectedProvider === 'groq' ? 'https://console.groq.com/keys' : 
                    selectedProvider === 'openrouter' ? 'https://openrouter.ai/settings/keys' :
                    selectedProvider === 'github' ? 'https://github.com/settings/tokens' :
                    'https://console.mistral.ai/api-keys/'
                  } 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                  style={{ fontSize: '12px' }}
                >
                  {t('apiKeyGetLinkText')}
                </a>
              </div>
              <div className="relative w-full mb-2">
                <textarea
                  ref={inputRef}
                  id={`${selectedProvider}ApiKeyInputModal`}
                  value={localApiKeyText[selectedProvider]}
                  onChange={(e) => handleInputChange(selectedProvider, e.target.value)}
                  onScroll={(e) => setApiKeyTextareaScrollTop(e.currentTarget.scrollTop)}
                  placeholder={`${selectedLabel}: ${t('apiKeyMultiPlaceholder')}`}
                  className="flat-input api-key-masked-textarea w-full min-h-[128px] resize-y"
                  style={{ paddingTop: '0.65rem', paddingBottom: '0.65rem', fontSize: '12px' }}
                  rows={5}
                  wrap="off"
                  spellCheck={false}
                />
                {localApiKeyText[selectedProvider] && (
                  <div
                    className="api-key-mask-overlay"
                    aria-hidden="true"
                    style={{ fontSize: '12px' }}
                  >
                    <div style={{ transform: `translateY(-${apiKeyTextareaScrollTop}px)` }}>
                      {localApiKeyText[selectedProvider].split('\n').map((line, index) => {
                        const status = getApiKeyLineStatus(selectedProvider, line);
                        return (
                          <div key={`${index}-${line}`} className={`api-key-mask-line ${status ? `is-${status}` : ''}`}>
                            {maskApiKeyLine(line) || ' '}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Detailed Breakdown Per-Key List if checked */}
              {Object.keys(keyCheckStatuses[selectedProvider] || {}).length > 0 && (
                <div className="mt-2.5 max-h-40 overflow-y-auto rounded-xl border border-white/[0.08] bg-black/40 p-2 flex flex-col gap-1.5 scrollbar-thin">
                  {normalizeApiKeyList(localApiKeyText[selectedProvider]).map((key, idx) => {
                    const status = keyCheckStatuses[selectedProvider]?.[key];
                    const masked = `${key.slice(0, 6)}...${key.slice(-4)}`;
                    const isValid = status === 'valid';
                    const isDead = status === 'invalid' || status === 'limited';

                    return (
                      <div
                        key={`${idx}-${key}`}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border ${
                          isValid
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                            : isDead
                            ? 'bg-red-500/10 border-red-500/20 text-red-300'
                            : 'bg-white/[0.04] border-white/[0.06] text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-[10px] text-gray-400">#{idx + 1}</span>
                          <span className="font-semibold">{masked}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            isValid
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : isDead
                              ? 'bg-red-500/20 text-red-300'
                              : 'bg-gray-700 text-gray-400'
                          }`}>
                            {isValid ? 'Aktif' : isDead ? 'Mati / Limit' : 'Belum Dicek'}
                          </span>

                          {isDead && (
                            <button
                              type="button"
                              onClick={() => {
                                const currentKeys = normalizeApiKeyList(localApiKeyText[selectedProvider]);
                                const updated = currentKeys.filter(k => k !== key);
                                setLocalApiKeyText(prev => ({ ...prev, [selectedProvider]: updated.join('\n') }));
                                setKeyCheckStatuses(prev => {
                                  const next = { ...prev[selectedProvider] };
                                  delete next[key];
                                  return { ...prev, [selectedProvider]: next };
                                });
                              }}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1 rounded transition-colors cursor-pointer"
                              title="Hapus key ini"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="min-h-[2rem] flex items-start mt-1">
                {selectedResult ? (
                  <div className={`w-full mt-1 max-h-32 overflow-y-auto custom-scrollbar break-words ${
                    selectedResult.status === 'success'
                      ? 'api-key-status-valid'
                      : selectedResult.status === 'warning'
                        ? 'api-key-status-warning'
                        : 'api-key-status-invalid'
                  }`} style={{ fontSize: '12px' }}>
                    {selectedResult.message}
                  </div>
                ) : (
                  <p className={`mt-1 ${(selectedInitialized || selectedKeyCount > 0) ? 'api-key-status-valid' : 'api-key-status-invalid'}`} style={{ fontSize: '12px' }}>
                    {selectedKeyCount > 0
                      ? t('apiKeyCountStatus', { provider: selectedLabel, count: selectedKeyCount })
                      : `${selectedLabel}: ${t('apiKeyStatusMissing')}`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="api-key-modal-actions flex justify-end items-center gap-2 flex-wrap mt-5">
             <input
                ref={importInputRef}
                type="file"
                accept=".txt,text/plain"
                className="hidden"
                onChange={handleImportFile}
             />
             <button
                type="button"
                onClick={handleImportClick}
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
             >
                {t('apiKeyImportButton')}
             </button>
             {Object.values(keyCheckStatuses[selectedProvider] || {}).some(s => s === 'invalid' || s === 'limited') && (
               <button
                  type="button"
                  onClick={() => handleRemoveDeadKeysFromModal(selectedProvider)}
                  className="btn btn-destructive text-red-400 hover:text-red-300 border border-red-500/30"
                  style={{ fontSize: '13px' }}
               >
                  Hapus Key Mati/Limit ({Object.values(keyCheckStatuses[selectedProvider] || {}).filter(s => s === 'invalid' || s === 'limited').length})
               </button>
             )}
             <button
                onClick={() => handleCheck(selectedProvider)}
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
                disabled={isChecking[selectedProvider] || selectedKeyCount === 0}
             >
                {isChecking[selectedProvider] ? (
                  <>
                    <Spinner size="w-3 h-3" thickness="border-2" color={'border-gray-800'} />
                    <span className="ml-1.5" style={{ fontSize: '13px' }}>{t('apiKeyCheckingButton')}</span>
                  </>
                ) : (
                  <span style={{ fontSize: '13px' }}>{t('apiKeyCheckButton')}</span>
                )}
             </button>
             <button onClick={handleSave} className="btn btn-action" style={{ fontSize: '13px' }} disabled={!hasAnyLocalKey}>
                {t('apiKeySaveButton')}
             </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(content, document.body)}
      {isProviderDropdownOpen && typeof document !== 'undefined' && createPortal(providerDropdownMenu, document.body)}
    </>
  );
};

export default memo(ApiKeyModal);

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Spinner from './Spinner';

import { useLocalizationContext } from '../contexts/LocalizationContext';
import { MODEL_PROVIDER_LABELS } from '../constants';
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

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onClose, onSave, onCheck, currentApiKeys, apiStatus, selectedModel, isSidebarOpen }) => {
  const { t } = useLocalizationContext();
  const [localApiKeyText, setLocalApiKeyText] = useState<string>(currentApiKeys.google.join('\n'));
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [checkResult, setCheckResult] = useState<{status: 'success' | 'warning' | 'error', message: string} | null>(null);
  const [isClosing, setIsClosing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setLocalApiKeyText(currentApiKeys.google.join('\n'));
  }, [currentApiKeys]);

  const requestClose = useCallback(() => {
    if (isClosing) return;
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
        requestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [requestClose]);

  const handleSave = () => {
    const keys = normalizeApiKeyList(localApiKeyText);
    onSave({
      google: keys,
    });
    requestClose();
  };

  const handleCheck = async () => {
    const keys = normalizeApiKeyList(localApiKeyText);
    if (keys.length === 0) return;
    setIsChecking(true);
    setCheckResult(null);

    const results = await Promise.all(keys.map(key => onCheck('google', key, selectedModel)));
    const validCount = results.filter(result => result.success).length;
    const limitedCount = results.filter(result => result.reason === 'limited').length;
    const invalidCount = results.length - validCount - limitedCount;

    if (validCount === results.length) {
      setCheckResult({ status: 'success', message: t('apiKeyCheckAllSuccess', { count: validCount }) });
    } else if (validCount > 0) {
      setCheckResult({ status: 'warning', message: t('apiKeyCheckPartial', { valid: validCount, limited: limitedCount, invalid: invalidCount }) });
    } else {
      setCheckResult({ status: 'error', message: t('apiKeyCheckAllFailed', { limited: limitedCount, invalid: invalidCount }) });
    }
    setIsChecking(false);
  };

  const handleInputChange = (value: string) => {
    const formattedValue = value.replace(/,/g, '\n');
    setLocalApiKeyText(formattedValue);
    setCheckResult(null);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const fileText = await file.text();
      const importedKeys = normalizeApiKeyList(fileText);
      if (importedKeys.length === 0) {
        setCheckResult({ status: 'error', message: 'No API keys found in the imported file.' });
        return;
      }
      setLocalApiKeyText(prev => normalizeApiKeyList([...normalizeApiKeyList(prev), ...importedKeys]).join('\n'));
      setCheckResult({ status: 'success', message: `${importedKeys.length} API key(s) imported.` });
    } catch {
      setCheckResult({ status: 'error', message: 'Failed to import API key file.' });
    }
  };

  const selectedKeyCount = normalizeApiKeyList(localApiKeyText).length;

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
          <h2 id="apiKeyModalTitle" className="font-bold mb-2 pr-6 text-lg">Google AI Studio API Key</h2>
          
          <p id="apiKeyModalLegendText" className="mb-4 legend-text text-sm">
            Aplikasi terhubung langsung ke mesin Google AI Studio (Gemini). Masukkan API Key Anda di bawah ini jika diperlukan.
          </p>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between ml-0.5 mb-2">
                <label htmlFor="googleApiKeyInputModal" className="advanced-settings-field-label text-xs font-semibold">
                  Google AI Studio API Key
                </label>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  {t('apiKeyGetLinkText')}
                </a>
              </div>
              <textarea
                ref={inputRef}
                id="googleApiKeyInputModal"
                value={localApiKeyText}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="AIzaSy... (atau biarkan kosong jika sudah terset di environment)"
                className="flat-input w-full min-h-[100px] resize-y p-3 text-xs font-mono"
                rows={4}
                wrap="off"
                spellCheck={false}
              />

              <div className="min-h-[1.5rem] flex items-start mt-2">
                {checkResult ? (
                  <div className={`w-full text-xs font-medium ${
                    checkResult.status === 'success'
                      ? 'text-emerald-400'
                      : checkResult.status === 'warning'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}>
                    {checkResult.message}
                  </div>
                ) : (
                  <p className={`text-xs ${apiStatus.google || selectedKeyCount > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                    {selectedKeyCount > 0
                      ? `Google AI Studio: ${selectedKeyCount} API Key aktif.`
                      : apiStatus.google ? 'Google AI Studio: Siap digunakan (via Environment).' : 'Google AI Studio: Siap digunakan.'}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="api-key-modal-actions flex justify-end items-center gap-2 flex-wrap mt-5 pt-3 border-t border-white/[0.08]">
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
                className="btn btn-secondary text-xs"
             >
                {t('apiKeyImportButton')}
             </button>
             <button
                onClick={handleCheck}
                className="btn btn-secondary text-xs"
                disabled={isChecking || selectedKeyCount === 0}
             >
                {isChecking ? (
                  <>
                    <Spinner size="w-3 h-3" thickness="border-2" color={'border-gray-800'} />
                    <span className="ml-1.5">{t('apiKeyCheckingButton')}</span>
                  </>
                ) : (
                  <span>{t('apiKeyCheckButton')}</span>
                )}
             </button>
             <button onClick={handleSave} className="btn btn-action text-xs">
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
    </>
  );
};

export default memo(ApiKeyModal);

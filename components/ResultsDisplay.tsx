import React, { useState, useCallback, memo } from 'react';
import { GeneratedPromptSet, InputMode } from '../types';
import { useLocalizationContext } from '../contexts/LocalizationContext';

interface ResultsDisplayProps {
  generatedPromptSets: GeneratedPromptSet[];
  totalPrompts: number;
  onClearAll: () => void;
  onRetryFailed: (set: GeneratedPromptSet) => void;
  onRetryAllFailed: () => void;
  formatPromptsForExport: (prompts?: (string | Record<string, any>)[]) => string;
  inputMode: InputMode;
  isRetryingAll?: boolean;
  retryingIds?: Set<string | number>;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  generatedPromptSets,
  totalPrompts,
  onClearAll,
  onRetryFailed,
  onRetryAllFailed,
  formatPromptsForExport,
  inputMode,
  isRetryingAll = false,
  retryingIds = new Set()
}) => {
  const { t } = useLocalizationContext();
  const [isCopied, setIsCopied] = useState(false);
  const [copiedCardId, setCopiedCardId] = useState<string | number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const successfulPromptSets = generatedPromptSets.filter(set => !set.hasError);
  const failedPromptSets = generatedPromptSets.filter(set => set.hasError);

  const fallbackCopy = (text: string, onSuccess: () => void) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      if (successful) {
        onSuccess();
      }
    } catch (err) {
      console.error('Fallback copy failed', err);
    }
  };

  const copyToClipboard = (text: string, onSuccess: () => void) => {
    if (!text || !text.trim()) return;

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        onSuccess();
      }).catch(() => {
        fallbackCopy(text, onSuccess);
      });
    } else {
      fallbackCopy(text, onSuccess);
    }
  };

  const getExportText = useCallback(() => {
    const exported = formatPromptsForExport();
    if (exported && exported.trim().length > 0) return exported.trim();
    return successfulPromptSets
      .flatMap(s => s.prompts)
      .map(p => (typeof p === 'object' && p !== null ? JSON.stringify(p, null, 2) : String(p)))
      .join('\n\n');
  }, [formatPromptsForExport, successfulPromptSets]);

  const handleCopyAll = useCallback(() => {
    if (totalPrompts === 0) return;
    const textToCopy = getExportText();
    copyToClipboard(textToCopy, () => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  }, [totalPrompts, getExportText]);

  const handleCopySet = (set: GeneratedPromptSet) => {
    const text = set.prompts
      .map(p => (typeof p === 'object' && p !== null ? JSON.stringify(p, null, 2) : String(p)))
      .join('\n\n');
    copyToClipboard(text, () => {
      setCopiedCardId(set.id);
      setTimeout(() => setCopiedCardId(null), 2000);
    });
  };

  const handleCopySinglePrompt = (prompt: string | Record<string, any>, key: string) => {
    const text = typeof prompt === 'object' && prompt !== null ? JSON.stringify(prompt, null, 2) : String(prompt);
    copyToClipboard(text, () => {
      setCopiedIndex(key);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleDownloadAll = useCallback(() => {
    if (totalPrompts === 0) return;
    const getFormattedDate = () => new Date().toISOString().replace(/[:.]/g, '-');
    const textToDownload = getExportText();
    const blob = new Blob([textToDownload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Prompts-${getFormattedDate()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [totalPrompts, getExportText]);

  if (generatedPromptSets.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="prompt-results-heading" className="editorial-results-section mt-0">
      <div className="glass-card p-5 md:p-6 lg:p-7 rounded-[20px] lg:rounded-[24px]">
        <div className="editorial-results-header flex flex-wrap items-center justify-between gap-y-3 mb-5">
          <div className="flex items-baseline space-x-3">
            <h2 id="prompt-results-heading" className="results-heading text-xl leading-none font-semibold">
              {t('promptResultsHeading')}
            </h2>
            {totalPrompts > 0 && (
              <span className="counter-text-spec inline-flex items-center leading-none" aria-live="polite">
                {t('totalPromptsGeneratedLabel', { count: totalPrompts })}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {failedPromptSets.length > 0 && (
              <button
                type="button"
                onClick={onRetryAllFailed}
                className="btn btn-secondary results-toolbar-btn cursor-pointer"
                disabled={isRetryingAll}
              >
                <span className={`material-symbols-outlined ${isRetryingAll ? 'animate-spin' : ''}`}>refresh</span>
                {t('retryAllFailedButtonLabel')}
              </button>
            )}
            {totalPrompts > 0 && (
              <>
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className={`${isCopied ? "btn btn-success" : "btn btn-action"} results-toolbar-btn cursor-pointer`}
                >
                  <span className="material-symbols-outlined">{isCopied ? 'done' : 'copy_all'}</span>
                  {isCopied ? t('copiedButtonLabel') : t('copyAllButtonLabel')}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="btn btn-success results-toolbar-btn cursor-pointer"
                >
                  <span className="material-symbols-outlined">download</span>
                  {t('downloadAllButtonLabel')}
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onClearAll}
              className="btn btn-destructive results-toolbar-btn cursor-pointer"
            >
              <span className="material-symbols-outlined">clear_all</span>
              {t('clearAllButtonLabel')}
            </button>
          </div>
        </div>

        {successfulPromptSets.length > 0 && (
          <div className="editorial-results-list space-y-4" tabIndex={0} aria-label={t('scrollableResultsAreaAriaLabel')}>
            {successfulPromptSets.map((set) => (
              <div key={set.id} className="editorial-result-card inner-card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center min-w-0">
                    {set.thumbnailUrl && (
                      <div className="relative w-8 h-8 mr-3 rounded-sm overflow-hidden flex-shrink-0 border border-gray-200 ">
                        <img src={set.thumbnailUrl} alt={set.originalConcept} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <h3 className="results-concept-title text-sm font-semibold break-all">{set.originalConcept}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopySet(set)}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-300 border border-white/[0.08] transition-all cursor-pointer flex-shrink-0"
                    title="Salin semua prompt dalam set ini"
                  >
                    <span className="material-symbols-outlined text-sm">
                      {copiedCardId === set.id ? 'done' : 'content_copy'}
                    </span>
                    <span>{copiedCardId === set.id ? 'Tersalin' : 'Copy'}</span>
                  </button>
                </div>
                {set.prompts.length === 0 ? (
                  <p className="text-sm text-slate-600">{t('noPromptsGeneratedForConcept')}</p>
                ) : (
                  set.prompts.map((prompt, promptIndex) => {
                    const promptIsObject = typeof prompt === 'object' && prompt !== null;
                    const promptIsJsonString = typeof prompt === 'string' && prompt.trim().startsWith('{') && prompt.trim().endsWith('}');
                    const promptIsXmlString = typeof prompt === 'string' && (prompt.includes('<Subject>') || prompt.includes('<Style>') || prompt.includes('<Background>'));
                    const promptKey = `${set.id}-${promptIndex}`;

                    let content;
                    if (promptIsObject) {
                      content = JSON.stringify(prompt, null, 2);
                    } else if (promptIsJsonString) {
                      try {
                        content = JSON.stringify(JSON.parse(prompt as string), null, 2);
                      } catch (e) {
                        content = prompt as string;
                      }
                    } else {
                      content = prompt as string;
                    }

                    return (
                      <div key={promptIndex} className={`group relative mb-2 pb-2 ${promptIndex < set.prompts.length - 1 ? 'results-item-divider border-b' : ''}`}>
                        <div className="flex items-start justify-between gap-2">
                          {promptIsObject || promptIsJsonString || promptIsXmlString ? (
                            <pre className="json-code-block flex-1"><code>{content}</code></pre>
                          ) : (
                            <div className="results-prompt-text flex-1">
                              {content.split('\n').map((line: string, lineIndex: number) => (
                                <React.Fragment key={lineIndex}>{line}{lineIndex < content.split('\n').length - 1 && <br />}</React.Fragment>
                              ))}
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => handleCopySinglePrompt(prompt, promptKey)}
                            className="opacity-60 group-hover:opacity-100 p-1.5 rounded-lg bg-white/[0.06] hover:bg-indigo-500/20 text-gray-300 hover:text-indigo-300 transition-all cursor-pointer flex-shrink-0"
                            title="Salin prompt ini"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {copiedIndex === promptKey ? 'done' : 'content_copy'}
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ))}
          </div>
        )}

        {failedPromptSets.length > 0 && (
          <div className={`${successfulPromptSets.length > 0 ? 'mt-5 pt-5 results-item-divider border-t' : ''}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-red-400">error</span>
                <h3 className="results-heading text-base leading-none font-semibold">{t('failedResultsHeading')}</h3>
                <span className="counter-text-spec inline-flex items-center leading-none" aria-live="polite">
                  {failedPromptSets.length}
                </span>
              </div>
            </div>

            <div className="editorial-results-list space-y-4">
              {failedPromptSets.map((set) => (
                <div key={set.id} className="editorial-result-card inner-card p-5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="flex items-center min-w-0">
                      {set.thumbnailUrl && (
                        <div className="relative w-8 h-8 mr-3 rounded-sm overflow-hidden flex-shrink-0 border border-gray-200 ">
                          <img src={set.thumbnailUrl} alt={set.originalConcept} className="w-full h-full object-cover" />
                        </div>
                      )}
                      <h3 className="results-concept-title text-sm font-semibold break-all">{set.originalConcept}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRetryFailed(set)}
                      className="btn btn-secondary results-toolbar-btn flex-shrink-0"
                      disabled={isRetryingAll || retryingIds.has(set.id)}
                    >
                      <span className={`material-symbols-outlined ${retryingIds.has(set.id) ? 'animate-spin' : ''}`}>refresh</span>
                      {t('retryFailedButtonLabel')}
                    </button>
                  </div>
                  {set.prompts.length > 0 ? (
                    <div className="results-prompt-text mb-0 text-red-700">
                      {String(set.prompts[0]).split('\n').map((line, lineIndex) => (
                        <React.Fragment key={lineIndex}>{line}{lineIndex < String(set.prompts[0]).split('\n').length - 1 && <br />}</React.Fragment>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">{t('noPromptsGeneratedForConcept')}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default memo(ResultsDisplay);

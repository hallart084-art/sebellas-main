import React, { useState, useEffect, memo } from 'react';
import { useLocalizationContext } from '../contexts/LocalizationContext';

type MinifyMode = 'json' | 'xml';

interface JsonMinifierModalProps {
 onClose: () => void;
 isSidebarOpen?: boolean;
}

const JsonMinifierModal: React.FC<JsonMinifierModalProps> = ({ onClose, isSidebarOpen = false }) => { const { t } = useLocalizationContext();
 const [inputValue, setInputValue] = useState('');
 const [outputValue, setOutputValue] = useState('');
 const [isCopied, setIsCopied] = useState(false);
 const [inputObjCount, setInputObjCount] = useState(0);
 const [outputObjCount, setOutputObjCount] = useState(0);
 const [mode, setMode] = useState<MinifyMode>('json');


 const countObjectsInString = (str: string): number => {
 const trimmed = str.trim();
 if (!trimmed) return 0;

 if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
 try {
 const parsed = JSON.parse(trimmed);
 if (Array.isArray(parsed)) {
 return parsed.length;
 }
 } catch (e) { /* Fall through */ }
 }

 let objectCount = 0;
 let braceCount = 0;
 let inString = false;
 let objStartIndex = -1;

 for (let i = 0; i < trimmed.length; i++) {
 const char = trimmed[i];
 if (char === '"' && (i === 0 || trimmed[i - 1] !== '\\')) {
 inString = !inString;
 }

 if (!inString) {
 if (char === '{') {
 if (braceCount === 0) objStartIndex = i;
 braceCount++;
 } else if (char === '}') {
 if (braceCount > 0) {
 braceCount--;
 if (braceCount === 0 && objStartIndex !== -1) {
 try {
 JSON.parse(trimmed.substring(objStartIndex, i + 1));
 objectCount++;
 } catch (e) { /* Not a valid object */ }
 objStartIndex = -1;
 }
 }
 }
 }
 }
 
 if (objectCount === 0 && trimmed.startsWith('{') && trimmed.endsWith('}')) {
 try {
 JSON.parse(trimmed);
 return 1;
 } catch (e) {
 return 0;
 }
 }
 return objectCount;
 };

 const countXmlPrompts = (str: string): number => {
 const trimmed = str.trim();
 if (!trimmed) return 0;
 const segments = trimmed.split('\n---\n');
 return segments.filter(s => s.trim().length > 0).length;
 };

 useEffect(() => {
 if (mode === 'json') {
 const count = countObjectsInString(inputValue);
 setInputObjCount(count);
 } else {
 const count = countXmlPrompts(inputValue);
 setInputObjCount(count);
 }
 }, [inputValue, mode]);

 useEffect(() => {
 const trimmed = outputValue.trim();
 if (!trimmed || trimmed.startsWith('Error:')) {
 setOutputObjCount(0);
 return;
 }
 if (mode === 'json') {
 const count = trimmed.split('\n').filter(Boolean).length;
 setOutputObjCount(count);
 } else {
 const count = trimmed.split('\n\n').filter(s => s.trim().length > 0).length;
 setOutputObjCount(count);
 }
 }, [outputValue, mode]);

 useEffect(() => {
 setInputValue('');
 setOutputValue('');
 setIsCopied(false);
 setInputObjCount(0);
 setOutputObjCount(0);
 }, []);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape') onClose();
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => window.removeEventListener('keydown', handleKeyDown);
 }, [onClose]);

 const handleModeChange = (newMode: MinifyMode) => {
 setMode(newMode);
 setInputValue('');
 setOutputValue('');
 setIsCopied(false);
 setInputObjCount(0);
 setOutputObjCount(0);
 };

 const handleMinifyJson = () => {
 const input = inputValue.trim();
 if (!input) {
 setOutputValue('');
 return;
 }

 const objects: string[] = [];
 let braceCount = 0;
 let startIndex = -1;
 let inString = false;

 if (input.startsWith('[') && input.endsWith(']')) {
 try {
 const parsed = JSON.parse(input);
 if (Array.isArray(parsed)) {
 const minified = parsed.map(item => JSON.stringify(item));
 setOutputValue(minified.join('\n\n'));
 return;
 }
 } catch (e) { /* Fall through */ }
 }

 for (let i = 0; i < input.length; i++) {
 const char = input[i];
 if (char === '"' && (i === 0 || input[i - 1] !== '\\')) {
 inString = !inString;
 }
 if (inString) continue;

 if (char === '{') {
 if (braceCount === 0) startIndex = i;
 braceCount++;
 } else if (char === '}') {
 if (braceCount > 0) {
 braceCount--;
 if (braceCount === 0 && startIndex !== -1) {
 objects.push(input.substring(startIndex, i + 1));
 startIndex = -1;
 }
 }
 }
 }

 if (objects.length > 0) {
 try {
 const minified = objects.map(objStr => JSON.stringify(JSON.parse(objStr)));
 setOutputValue(minified.join('\n\n'));
 } catch (error) {
 setOutputValue('Error: Invalid JSON object found in stream.');
 }
 } else {
 try {
 const parsed = JSON.parse(input);
 setOutputValue(JSON.stringify(parsed));
 } catch(e) {
 setOutputValue('Error: Invalid JSON format. Expected an array or a series of objects.');
 }
 }
 };

 const handleMinifyXml = () => {
 const input = inputValue.trim();
 if (!input) {
 setOutputValue('');
 return;
 }

 const segments = input.split('\n---\n');
 const minifiedSegments = segments
 .map(segment => {
 const trimmed = segment.trim();
 if (!trimmed) return '';
 // Collapse each segment into one line: replace newlines with spaces, then collapse multiple spaces
 return trimmed
 .replace(/\r\n/g, '\n')
 .replace(/\n+/g, ' ')
 .replace(/\s{2,}/g, ' ')
 .trim();
 })
 .filter(s => s.length > 0);

 if (minifiedSegments.length === 0) {
 setOutputValue('Error: No valid XML prompts found.');
 return;
 }

 setOutputValue(minifiedSegments.join('\n\n'));
 };

 const handleMinify = () => {
 if (mode === 'json') {
 handleMinifyJson();
 } else {
 handleMinifyXml();
 }
 };

 const handleCopy = () => {
 if (!outputValue || outputValue.startsWith('Error:')) return;
 navigator.clipboard.writeText(outputValue).then(() => {
 setIsCopied(true);
 setTimeout(() => setIsCopied(false), 2000);
 });
 };
 
 const handleClear = () => {
 setInputValue('');
 setOutputValue('');
 };

 const handleDownload = () => {
 if (!outputValue || outputValue.startsWith('Error:')) return;

 const getFormattedDate = () => {
 const d = new Date();
 const year = d.getFullYear();
 const month = (d.getMonth() + 1).toString().padStart(2, '0');
 const day = d.getDate().toString().padStart(2, '0');
 const hours = d.getHours().toString().padStart(2, '0');
 const minutes = d.getMinutes().toString().padStart(2, '0');
 const seconds = d.getSeconds().toString().padStart(2, '0');
 return `${year}${month}${day}-${hours}${minutes}${seconds}`;
 };

 const prefix = mode === 'json' ? 'minified_json' : 'minified_xml';
 const blob = new Blob([outputValue], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `${prefix}-${getFormattedDate()}.txt`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 const counterLabel = mode === 'json'
 ? t('jsonMinifierObjectsCounter', { count: inputObjCount })
 : t('xmlMinifierPromptsCounter', { count: inputObjCount });

 const outputCounterLabel = mode === 'json'
 ? t('jsonMinifierObjectsCounter', { count: outputObjCount })
 : t('xmlMinifierPromptsCounter', { count: outputObjCount });

 const content = (
 <div className="w-full mx-auto mt-4 px-4 md:px-0 animate-fade-in" style={{ maxWidth: 'min(900px, calc(100vw - 2rem))' }}>
  <style>{`
    body .input-mode-selector.minifier-mode-selector,
    .input-mode-selector.minifier-mode-selector {
      width: 140px !important;
      max-width: 140px !important;
      height: 42px !important;
      margin-left: 0 !important;
      margin-right: unset !important;
      padding: var(--input-mode-inset, 3px) !important;
    }
    body .input-mode-selector.minifier-mode-selector .input-mode-button:not(.active):not(:disabled):hover {
      background-color: rgba(0, 0, 0, 0.04) !important;
      color: #4b5563 !important;
      border-radius: 9999px !important;
      transform: none !important;
    }
    body .input-mode-selector.minifier-mode-selector .input-mode-button.active:hover:not(:disabled) {
      background: transparent !important;
      transform: none !important;
    }
  `}</style>
 <div className="relative w-full py-2 flex flex-col">
 <header className="flex-shrink-0 mb-4">
 <h2 id="jsonMinifierModalTitle" className="text-lg font-bold">{t('jsonMinifierModalTitle')}</h2>
 <p className="text-sm legend-text mt-1">{mode === 'json' ? t('jsonMinifierDescription') : t('xmlMinifierDescription')}</p>
 <div className="input-mode-selector minifier-mode-selector mt-3">
 <span
 aria-hidden="true"
 style={{ position: 'absolute', top: '3px', left: '3px', height: 'calc(100% - 6px)', width: 'calc((100% - 6px) / 2)', borderRadius: '9999px', background: '#FFFFFF', boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)', border: '1px solid rgba(229,231,235,0.3)', transition: 'transform 400ms cubic-bezier(0.22,1,0.36,1)', transform: `translateX(${mode === 'json' ? '0%' : '100%'})`, pointerEvents: 'none', zIndex: 0 }}
 />
 <button onClick={() => handleModeChange('json')} className={`input-mode-button ${mode === 'json' ? 'active' : ''}`}>
 JSON
 </button>
 <button onClick={() => handleModeChange('xml')} className={`input-mode-button ${mode === 'xml' ? 'active' : ''}`}>
 XML
 </button>
 </div>
 </header>
 <div className="grid grid-cols-1 gap-4 flex-grow min-h-[36vh] overflow-y-auto pr-1">
 <div className="flex flex-col">
 <div className="flex justify-between items-center mb-1">
 <label htmlFor="json-input" className="text-sm-input-label block text-[13px] font-semibold">{mode === 'json' ? t('jsonMinifierInputLabel') : t('xmlMinifierInputLabel')}</label>
 <span className="text-xs legend-text">{counterLabel}</span>
 </div>
 <textarea
 id="json-input"
 value={inputValue}
 onChange={(e) => setInputValue(e.target.value)}
 placeholder={mode === 'json' ? t('jsonMinifierPlaceholder') : t('xmlMinifierPlaceholder')}
 className="flat-input text-xs flex-grow w-full resize-none p-3"
 aria-label={mode === 'json' ? t('jsonMinifierInputLabel') : t('xmlMinifierInputLabel')}
 rows={6}
 />
 </div>
 <div className="flex flex-col">
 <div className="flex justify-between items-center mb-1">
 <label htmlFor="json-output" className="text-sm-input-label block text-[13px] font-semibold">{mode === 'json' ? t('jsonMinifierOutputLabel') : t('xmlMinifierOutputLabel')}</label>
 <span className="text-xs legend-text">{outputCounterLabel}</span>
 </div>
 <textarea
 id="json-output"
 value={outputValue}
 readOnly
 className="flat-input text-xs flex-grow w-full resize-none p-3"
 aria-label={mode === 'json' ? t('jsonMinifierOutputLabel') : t('xmlMinifierOutputLabel')}
 rows={6}
 />
 </div>
 </div>
 <footer className="flex justify-between items-center mt-4 flex-shrink-0">
 <div>
 <button onClick={handleMinify} className="btn btn-action">
 <span className="material-symbols-outlined">compress</span>
 {t('minifyButtonLabel')}
 </button>
 </div>
 <div className="flex items-center space-x-2">
 <button onClick={handleClear} className="btn btn-destructive btn-icon" aria-label={t('clearButtonLabel')}>
 <span className="material-symbols-outlined">delete_sweep</span>
 </button>
 <button onClick={handleDownload} className="btn btn-success btn-icon" disabled={!outputValue || outputValue.startsWith('Error:')} aria-label={t('downloadButtonLabel')}>
 <span className="material-symbols-outlined">download</span>
 </button>
 <button onClick={handleCopy} className={`btn ${isCopied ? 'btn-success' : 'btn-action'} btn-icon`} disabled={!outputValue || isCopied || outputValue.startsWith('Error:')} aria-label={isCopied ? t('copiedButtonLabel') : t('copyButtonLabel')}>
 <span className="material-symbols-outlined">{isCopied ? 'done' : 'content_copy'}</span>
                            </button>
                        </div>
                    </footer>
            </div>
        </div>
    );

    return content;
};

export default memo(JsonMinifierModal);

import React, { memo, useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useDropdownPosition } from '../hooks/useDropdownPosition';
import { UseSettingsReturn } from '../hooks/useSettings';
import ModelSelector from './ModelSelector';
import StyleSelector from './StyleSelector';
import PromptQualitySelector from './PromptQualitySelector';
import { useLocalizationContext } from '../contexts/LocalizationContext';
import { Folder } from '../types';
import { AnimatedModalWrapper } from './HistoryModal';

interface SettingsFormProps {
 isLoading: boolean;
 settings: UseSettingsReturn;
 disabled: boolean;
 folders: Folder[];
 onUpdateFolders?: (updated: Folder[]) => void;
}

const SettingsForm: React.FC<SettingsFormProps> = ({ isLoading, settings, disabled, folders, onUpdateFolders }) => {
 const { t } = useLocalizationContext();
 const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
 const [isCreatingFolder, setIsCreatingFolder] = useState(false);
 const [newFolderName, setNewFolderName] = useState('');
 const folderDropdownTriggerRef = useRef<HTMLButtonElement>(null);

 const { dropdownRef: folderDropdownRef, dropdownStyle: folderDropdownStyle } = useDropdownPosition({
 isOpen: isFolderDropdownOpen,
 triggerRef: folderDropdownTriggerRef,
 onClose: () => setIsFolderDropdownOpen(false),
 forceDownward: true,
 });

 const activeFolder = settings.targetFolderId ? folders.find(f => f.id === settings.targetFolderId) : null;
 const activeFolderName = activeFolder ? activeFolder.name : 'Default (Library)';

 const handleCreateFolderClick = () => {
 setIsFolderDropdownOpen(false);
 setIsCreatingFolder(true);
 };

 const handleCreateFolderSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!newFolderName.trim() || !onUpdateFolders) return;
 
 const newFolder: Folder = {
 id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
 name: newFolderName.trim(),
 createdAt: Date.now()
 };
 onUpdateFolders([...folders, newFolder]);
 settings.setTargetFolderId(newFolder.id);
 setNewFolderName('');
 setIsCreatingFolder(false);
 };

 const folderDropdownMenu = (
 <div 
 ref={folderDropdownRef} 
 className="dropdown-menu-portal p-1" 
 style={folderDropdownStyle} 
 role="menu"
 aria-labelledby="targetFolderDropdownButton"
 >
 <button
 type="button"
 onClick={() => { settings.setTargetFolderId(null); setIsFolderDropdownOpen(false); }}
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${!settings.targetFolderId ? 'active' : ''}`}
 role="menuitem"
 >
 <span className="truncate">Default (Library)</span>
 </button>
 {[...folders].sort((a, b) => a.createdAt - b.createdAt).map(f => (
 <button
 key={f.id}
 type="button"
 onClick={() => { settings.setTargetFolderId(f.id); setIsFolderDropdownOpen(false); }}
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${settings.targetFolderId === f.id ? 'active' : ''}`}
 role="menuitem"
 >
 <span className="truncate">{f.name}</span>
 </button>
 ))}
 <button
 type="button"
 onClick={handleCreateFolderClick}
 className="dropdown-menu-item flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10"
 role="menuitem"
 >
 <span className="text-[16px] leading-none">+</span>
 <span className="font-medium">New folder</span>
 </button>
 </div>
 );
 
 return (
 <section className="space-y-3 mb-3">
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <div>
 <label htmlFor="workerCount" className="advanced-settings-field-label block ml-0.5">
 Worker
 </label>
 <div className="h-3" aria-hidden="true" />
 <div className="advanced-number-field">
 <input
 id="workerCount"
 type="number"
 min={1}
 max={50}
 step={1}
 value={settings.workerCount}
 onChange={settings.handleWorkerCountChange}
 className="flat-input text-sm advanced-number-input"
 aria-label="Worker"
 disabled={disabled || isLoading}
 />
 <div className="advanced-number-stepper">
 <button
 type="button"
 className="advanced-number-step-btn"
 onClick={() => settings.setWorkerCount(settings.workerCount + 1)}
 disabled={disabled || isLoading || settings.workerCount >= 50}
 aria-label="Increase worker count"
 >
 <svg className="advanced-number-arrow is-up" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 <button
 type="button"
 className="advanced-number-step-btn"
 onClick={() => settings.setWorkerCount(Math.max(1, settings.workerCount - 1))}
 disabled={disabled || isLoading || settings.workerCount <= 1}
 aria-label="Decrease worker count"
 >
 <svg className="advanced-number-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 </div>
 </div>
 </div>

 <div>
 <label htmlFor="batchDelaySeconds" className="advanced-settings-field-label block ml-0.5">
 Delay (seconds)
 </label>
 <div className="h-3" aria-hidden="true" />
 <div className="advanced-number-field">
 <input
 id="batchDelaySeconds"
 type="number"
 min={0}
 max={300}
 step={1}
 value={settings.batchDelaySeconds}
 onChange={settings.handleBatchDelaySecondsChange}
 className="flat-input text-sm advanced-number-input"
 aria-label="Delay between batches in seconds"
 disabled={disabled || isLoading}
 />
 <div className="advanced-number-stepper">
 <button
 type="button"
 className="advanced-number-step-btn"
 onClick={() => settings.setBatchDelaySeconds(settings.batchDelaySeconds + 1)}
 disabled={disabled || isLoading || settings.batchDelaySeconds >= 300}
 aria-label="Increase batch delay"
 >
 <svg className="advanced-number-arrow is-up" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 <button
 type="button"
 className="advanced-number-step-btn"
 onClick={() => settings.setBatchDelaySeconds(Math.max(0, settings.batchDelaySeconds - 1))}
 disabled={disabled || isLoading || settings.batchDelaySeconds <= 0}
 aria-label="Decrease batch delay"
 >
 <svg className="advanced-number-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 </div>
 </div>
 </div>

 <div>
 <label htmlFor="targetFolderDropdownButton" className="advanced-settings-field-label block ml-0.5">
 Save Location
 </label>
 <div className="h-3" aria-hidden="true" />
 <button
 id="targetFolderDropdownButton"
 ref={folderDropdownTriggerRef}
 type="button"
 onClick={() => setIsFolderDropdownOpen(prev => !prev)}
 className="dropdown-trigger-button api-provider-dropdown-trigger flat-input w-full text-sm flex items-center justify-between text-left"
 disabled={disabled || isLoading}
 aria-haspopup="true"
 aria-expanded={isFolderDropdownOpen}
 >
 <span className="truncate">{activeFolderName}</span>
 <svg 
 className="w-4 h-4 opacity-70 flex-shrink-0 transition-transform duration-200" 
 fill="none" 
 stroke="currentColor" 
 viewBox="0 0 24 24"
 style={{ transform: isFolderDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {isFolderDropdownOpen && typeof document !== 'undefined' && createPortal(folderDropdownMenu, document.body)}
 </div>
 </div>

 <div>
 <label htmlFor="negativePrompt" className="advanced-settings-field-label block ml-0.5">
 Negative Prompt
 </label>
 <div className="h-3" aria-hidden="true" />
 <textarea
 id="negativePrompt" value={settings.negativePrompt} onChange={(e) => settings.setNegativePrompt(e.target.value)}
 placeholder={t('negativePromptPlaceholder')} className="flat-input text-sm min-h-[64px] resize-none overflow-y-auto"
 aria-label={t('negativePromptLabel')} disabled={disabled} rows={2}
 />
 </div>

 <div>
 <label htmlFor="customTemplate" className="advanced-settings-field-label block ml-0.5">
 {t('customTemplateLabel')}
 </label>
 <div className="h-3" aria-hidden="true" />
 <textarea
 id="customTemplate"
 value={settings.customTemplate}
 onChange={(e) => settings.setCustomTemplate(e.target.value)}
 placeholder={t('customTemplatePlaceholder')}
 className="flat-input text-sm min-h-[88px] resize-none overflow-y-auto"
 aria-label={t('customTemplateLabel')}
 disabled={disabled || isLoading}
 rows={3}
 />
 </div>

 {/* Create Folder Modal */}
 <AnimatedModalWrapper
 isOpen={isCreatingFolder}
 onClose={() => setIsCreatingFolder(false)}
 modalClassName="w-full max-w-md rounded-[20px] p-6"
 >
 <button type="button" onClick={() => setIsCreatingFolder(false)} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
 </button>
 
 <h2 className="text-[17px] font-bold text-text-primary mb-2">Create new folder</h2>
 <p className="text-sm text-text-secondary mb-6">Organise your prompts by creating a folder.</p>
 
 <form onSubmit={handleCreateFolderSubmit}>
 <input
 type="text"
 value={newFolderName}
 onChange={(e) => setNewFolderName(e.target.value)}
 placeholder="Enter folder name"
 className="w-full bg-white border-[3px] border-[#c2e0ff] rounded-full px-5 py-3 text-sm text-text-primary focus:outline-none focus:border-[#80c0ff] mb-8 transition-colors"
 autoFocus
 />
 
 <div className="flex items-center justify-end gap-3">
 <button 
 type="button" 
 onClick={() => setIsCreatingFolder(false)} 
 className="folder-modal-btn px-5 py-2.5 text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
 style={{ borderRadius: '14px' }}
 >
 Cancel
 </button>
 <button 
 type="submit" 
 disabled={!newFolderName.trim()} 
 className="folder-modal-btn px-5 py-2.5 text-sm font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 style={{ borderRadius: '14px' }}
 >
 Create
 </button>
 </div>
 </form>
 </AnimatedModalWrapper>
 </section>
 );
};

export default memo(SettingsForm);

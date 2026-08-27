import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import { createPortal } from 'react-dom';
import { HistoryEntry, StyleOption, InputMode, Folder } from '../types';
import { AllTranslationKeys } from '../locales';
import { useLocalizationContext } from '../contexts/LocalizationContext';
import { useDropdownPosition } from '../hooks/useDropdownPosition';

interface HistoryModalProps {
 onClose: () => void;
 history: HistoryEntry[];
 onDelete: (id: number) => void;
 onClear: () => void;
 formatPromptsForExport: (prompts: (string | Record<string, any>)[]) => string;
 folders?: Folder[];
 onUpdateHistory?: (history: HistoryEntry[]) => void;
 onUpdateFolders?: (folders: Folder[]) => void;
}

const styleOptionLabels: Record<StyleOption, AllTranslationKeys> = {
 photographic: 'promptStylePhotographic',
 sameAsReference: 'promptStyleSameAsReference',
 isolated: 'promptStyleIsolated',
 vector: 'promptStyleVector',
 custom: 'promptStyleCustom',
 footage: 'promptStyleFootage',
};

const filterOptions = [
 { value: 'all' as const, label: 'All Prompts' },
 { value: 'text' as const, label: 'Text Prompts' },
 { value: 'vector' as const, label: 'Vector Prompts' },
 { value: 'image' as const, label: 'Image Prompts' },
 { value: 'video' as const, label: 'Video Prompts' },
];

const sortOptions = [
 { value: 'newest' as const, label: 'Last Created' },
 { value: 'oldest' as const, label: 'Oldest Created' },
 { value: 'name-asc' as const, label: 'Name (A-Z)' },
 { value: 'name-desc' as const, label: 'Name (Z-A)' },
];

const formatPromptPreview = (prompt: string | Record<string, any> | undefined): string => {
 if (!prompt) return '';

 if (typeof prompt === 'string') {
 const trimmed = prompt.trim();
 if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
 try {
 return JSON.stringify(JSON.parse(trimmed));
 } catch {
 return trimmed.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
 }
 }

 return trimmed.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
 }

 return JSON.stringify(prompt);
};

export const AnimatedModalWrapper: React.FC<{
 isOpen: boolean;
 onClose: () => void;
 modalClassName: string;
 children: React.ReactNode;
}> = ({ isOpen, onClose, modalClassName, children }) => {
 const [render, setRender] = useState(isOpen);
 const [isClosing, setIsClosing] = useState(false);

 useEffect(() => {
 if (isOpen) {
 setRender(true);
 setIsClosing(false);
 } else if (render) {
 setIsClosing(true);
 const timer = setTimeout(() => {
 setRender(false);
 setIsClosing(false);
 }, 300);
 return () => clearTimeout(timer);
 }
 }, [isOpen, render]);

 if (!render) return null;

 if (typeof document === 'undefined') return null;

 return createPortal(
 <div 
 className={`fixed inset-0 overlay-darkness flex items-center justify-center p-4 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
 style={{ zIndex: 9999 }}
 onClick={onClose}
 >
 <div 
 className={`modal-card relative shadow-2xl ${modalClassName} ${isClosing ? 'animate-slide-out-bottom-right-center' : 'animate-slide-in-bottom-right-center'}`}
 onClick={(e) => e.stopPropagation()}
 >
 {children}
 </div>
 </div>,
 document.body
 );
};

interface FolderCardProps {
 folder: Folder;
 itemsCount: number;
 isSelected: boolean;
 onClick: () => void;
 onEdit: (folderId: string, newName: string) => void;
 onDelete: (folderId: string, folderName: string, itemsCount: number) => void;
}

const FolderCardComponent: React.FC<FolderCardProps> = ({ folder, itemsCount, isSelected, onClick, onEdit, onDelete }) => {
 const [isMenuOpen, setIsMenuOpen] = useState(false);
 const triggerRef = useRef<HTMLButtonElement>(null);
 const [isEditing, setIsEditing] = useState(false);
 const [editName, setEditName] = useState(folder.name);
 
 const { dropdownRef, dropdownStyle } = useDropdownPosition({
 isOpen: isMenuOpen,
 triggerRef,
 onClose: () => setIsMenuOpen(false),
 horizontalAlign: 'end',
 matchTriggerWidth: false,
 minWidth: 120,
 });

 useEffect(() => {
 setEditName(folder.name);
 }, [folder.name]);

 const handleEditSubmit = (e?: React.FormEvent) => {
 if (e) e.preventDefault();
 if (editName.trim() && editName.trim() !== folder.name) {
 onEdit(folder.id, editName.trim());
 }
 setIsEditing(false);
 };

 const handleKeyDown = (e: React.KeyboardEvent) => {
 if (e.key === 'Enter') {
 handleEditSubmit();
 } else if (e.key === 'Escape') {
 setIsEditing(false);
 setEditName(folder.name);
 }
 };

 return (
 <div 
 onClick={onClick}
 className={`flex flex-col justify-between p-4 rounded-xl cursor-pointer transition-all min-h-[90px] folder-card relative ${isSelected ? 'border-focus shadow-sm' : 'hover:border-gray-300'}`}
 style={{ overflow: 'visible' }}
 >
 {isEditing ? (
 <div onClick={e => e.stopPropagation()} className="w-full">
 <input
 type="text"
 value={editName}
 onChange={e => setEditName(e.target.value)}
 className="w-full text-sm font-semibold text-text-primary bg-background-input border border-border-default rounded px-2 py-1 outline-none focus:border-focus"
 autoFocus
 onBlur={() => handleEditSubmit()}
 onKeyDown={handleKeyDown}
 />
 </div>
 ) : (
 <div className="flex items-start justify-between w-full">
 <span className="text-sm font-semibold text-text-primary truncate pr-6" title={folder.name}>{folder.name}</span>
 <button
 ref={triggerRef}
 onClick={(e) => {
 e.stopPropagation();
 setIsMenuOpen(!isMenuOpen);
 }}
 className="absolute top-3 right-2 text-text-secondary hover:text-text-primary p-0.5 rounded transition-colors flex items-center justify-center z-10"
 aria-label="Folder actions"
 >
 <span className="material-symbols-outlined text-lg leading-none">more_vert</span>
 </button>
 </div>
 )}
 
 <div className="flex items-center justify-between w-full mt-4">
 <div className="flex items-center gap-1.5 text-text-secondary">
 <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path></svg>
 <span className="text-xs">{itemsCount} items</span>
 </div>
 <span className="text-xs text-text-secondary">Updated today</span>
 </div>

 {isMenuOpen && typeof document !== 'undefined' && createPortal(
 <div
 ref={dropdownRef}
 className="dropdown-menu-portal p-1"
 style={{
 ...dropdownStyle,
 transition: 'none',
 }}
 onClick={(e) => e.stopPropagation()}
 >
 <button
 onClick={(e) => {
 e.stopPropagation();
 setIsEditing(true);
 setIsMenuOpen(false);
 }}
 className="dropdown-menu-item flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-text-primary hover:bg-background-hover rounded"
 >
 <span className="material-symbols-outlined text-base">edit</span>
 Edit
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 onDelete(folder.id, folder.name, itemsCount);
 setIsMenuOpen(false);
 }}
 className="dropdown-menu-item flex items-center gap-2 w-full text-left px-3 py-2 text-sm text-[#e74c3c] hover:bg-[#e74c3c]/10 rounded"
 >
 <span className="material-symbols-outlined text-base">delete</span>
 Delete
 </button>
 </div>,
 document.body
 )}
 </div>
 );
};

const HistoryModal: React.FC<HistoryModalProps> = ({ onClose, history, onDelete, onClear, formatPromptsForExport, folders = [], onUpdateHistory, onUpdateFolders }) => {
 const { t } = useLocalizationContext();

 const [expandedEntryId, setExpandedEntryId] = useState<number | null>(null);
 const [copiedId, setCopiedId] = useState<number | null>(null);
 const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(() => new Set());
 const [isHistorySectionOpen, setIsHistorySectionOpen] = useState(true);
 
 // Search, Filter, Sort State
 const [searchQuery, setSearchQuery] = useState('');
 const [filterType, setFilterType] = useState<'all' | 'text' | 'image' | 'video'>('all');
 const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'name-asc' | 'name-desc'>('newest');
 
 // Folder state
 const [isCreatingFolder, setIsCreatingFolder] = useState(false);
 const [newFolderName, setNewFolderName] = useState('');
 const [selectedFolderId, setSelectedFolderId] = useState<string | null>(() => {
 if (typeof window !== 'undefined') {
 return localStorage.getItem('historySelectedFolderId');
 }
 return null;
 });

 useEffect(() => {
 if (selectedFolderId) {
 localStorage.setItem('historySelectedFolderId', selectedFolderId);
 } else {
 localStorage.removeItem('historySelectedFolderId');
 }
 }, [selectedFolderId]);
 const [folderToDelete, setFolderToDelete] = useState<{ id: string, name: string, count: number } | null>(null);
 const [folderMoveEntry, setFolderMoveEntry] = useState<HistoryEntry | null>(null);
 const [bulkMoveEntryIds, setBulkMoveEntryIds] = useState<number[]>([]);
 const [pendingMoveFolderId, setPendingMoveFolderId] = useState<string | null>(null);
 const isSelectionMode = selectedEntryIds.size > 0;
 const selectedEntryCount = selectedEntryIds.size;

 const handleEntrySelectionChange = (entryId: number, checked: boolean) => {
 setSelectedEntryIds(prev => {
 const next = new Set(prev);
 if (checked) {
 next.add(entryId);
 } else {
 next.delete(entryId);
 }
 return next;
 });
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
 setNewFolderName('');
 setIsCreatingFolder(false);
 };

 const handleEditFolder = (folderId: string, newName: string) => {
 if (!onUpdateFolders) return;
 const updated = folders.map(f => f.id === folderId ? { ...f, name: newName } : f);
 onUpdateFolders(updated);
 };

 const handleDeleteFolder = (folderId: string) => {
 if (!onUpdateFolders) return;
 const updated = folders.filter(f => f.id !== folderId);
 onUpdateFolders(updated);

 if (selectedFolderId === folderId) {
 setSelectedFolderId(null);
 }

 if (onUpdateHistory) {
 const updatedHistory = history.map(h => h.folderId === folderId ? { ...h, folderId: null } : h);
 onUpdateHistory(updatedHistory);
 }
 };

 const openMoveToFolderModal = (entry: HistoryEntry) => {
 setBulkMoveEntryIds([]);
 setFolderMoveEntry(entry);
 setPendingMoveFolderId(entry.folderId || null);
 };

 const openBulkMoveToFolderModal = () => {
 const ids = Array.from(selectedEntryIds);
 if (ids.length === 0) return;

 const selectedEntries = history.filter(entry => selectedEntryIds.has(entry.id));
 const firstFolderId = selectedEntries[0]?.folderId ?? null;
 const commonFolderId = selectedEntries.every(entry => (entry.folderId ?? null) === firstFolderId)
 ? firstFolderId
 : null;

 setFolderMoveEntry(null);
 setBulkMoveEntryIds(ids);
 setPendingMoveFolderId(commonFolderId);
 };

 const closeMoveToFolderModal = () => {
 setFolderMoveEntry(null);
 setBulkMoveEntryIds([]);
 setPendingMoveFolderId(null);
 };

 const handleMoveToFolder = () => {
 if (!onUpdateHistory) return;

 if (bulkMoveEntryIds.length > 0) {
 const idsToMove = new Set(bulkMoveEntryIds);
 onUpdateHistory(history.map(h => idsToMove.has(h.id) ? { ...h, folderId: pendingMoveFolderId } : h));
 setSelectedEntryIds(new Set());
 closeMoveToFolderModal();
 return;
 }

 if (!folderMoveEntry) return;
 onUpdateHistory(history.map(h => h.id === folderMoveEntry.id ? { ...h, folderId: pendingMoveFolderId } : h));
 closeMoveToFolderModal();
 };

 const handleDeleteSelectedEntries = () => {
 if (selectedEntryIds.size === 0) return;
 const idsToDelete = new Set(selectedEntryIds);

 if (onUpdateHistory) {
 onUpdateHistory(history.filter(entry => !idsToDelete.has(entry.id)));
 } else {
 idsToDelete.forEach(id => onDelete(id));
 }

 if (expandedEntryId !== null && idsToDelete.has(expandedEntryId)) {
 setExpandedEntryId(null);
 }
 setSelectedEntryIds(new Set());
 };
 const [isFilterOpen, setIsFilterOpen] = useState(false);
 const [isSortOpen, setIsSortOpen] = useState(false);
 const filterTriggerRef = useRef<HTMLButtonElement>(null);
 const sortTriggerRef = useRef<HTMLButtonElement>(null);
 const { dropdownRef: filterDropdownRef, dropdownStyle: filterDropdownStyle } = useDropdownPosition({
 isOpen: isFilterOpen,
 triggerRef: filterTriggerRef,
 onClose: () => setIsFilterOpen(false),
 horizontalAlign: 'start',
 minWidth: 160,
 matchTriggerWidth: true,
 });
 const { dropdownRef: sortDropdownRef, dropdownStyle: sortDropdownStyle } = useDropdownPosition({
 isOpen: isSortOpen,
 triggerRef: sortTriggerRef,
 onClose: () => setIsSortOpen(false),
 horizontalAlign: 'start',
 minWidth: 160,
 matchTriggerWidth: true,
 });

 useEffect(() => {
 setExpandedEntryId(null);
 }, []);

 useEffect(() => {
 const onEsc = (e: KeyboardEvent) => {
 if (e.key !== 'Escape') return;
 setIsFilterOpen(false);
 setIsSortOpen(false);
 closeMoveToFolderModal();
 };
 document.addEventListener('keydown', onEsc);
 return () => document.removeEventListener('keydown', onEsc);
 }, []);

 useEffect(() => {
 setSelectedEntryIds(prev => {
 if (prev.size === 0) return prev;
 const existingIds = new Set(history.map(entry => entry.id));
 let changed = false;
 const next = new Set<number>();
 prev.forEach(id => {
 if (existingIds.has(id)) {
 next.add(id);
 } else {
 changed = true;
 }
 });
 return changed ? next : prev;
 });
 }, [history]);

 const handleCopy = useCallback((entry: HistoryEntry) => {
 const promptsToCopy = entry.sets.flatMap(s => s.hasError ? [] : s.prompts);
 if (promptsToCopy.length === 0) return;

 const text = formatPromptsForExport(promptsToCopy);
 navigator.clipboard.writeText(text).then(() => {
 setCopiedId(entry.id);
 setTimeout(() => setCopiedId(null), 2000);
 });
 }, [formatPromptsForExport]);

 const handleDownload = useCallback((entry: HistoryEntry) => {
 const promptsToDownload = entry.sets.flatMap(s => s.hasError ? [] : s.prompts);
 if (promptsToDownload.length === 0) return;

 const getFormattedDate = (timestamp: number) => {
 const d = new Date(timestamp);
 const year = d.getFullYear();
 const month = (d.getMonth() + 1).toString().padStart(2, '0');
 const day = d.getDate().toString().padStart(2, '0');
 const hours = d.getHours().toString().padStart(2, '0');
 const minutes = d.getMinutes().toString().padStart(2, '0');
 const seconds = d.getSeconds().toString().padStart(2, '0');
 return `${year}${month}${day}-${hours}${minutes}${seconds}`;
 };

 const text = formatPromptsForExport(promptsToDownload);
 const blob = new Blob([text], { type: 'text/plain' });
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `Prompts-${getFormattedDate(entry.timestamp)}.txt`;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 }, [formatPromptsForExport]);

 const formatDate = (timestamp: number) => {
 return new Intl.DateTimeFormat(undefined, {
 dateStyle: 'medium',
 timeStyle: 'short',
 }).format(new Date(timestamp));
 };

 // Helper to get first concept text for sorting
 const getFirstConcept = (entry: HistoryEntry) => {
   if (entry.settings.inputMode === 'text' || entry.settings.inputMode === 'vector') return entry.settings.conceptsInput;
   if (entry.settings.inputMode === 'image') return entry.settings.imageNames[0] || '';
   if (entry.settings.inputMode === 'video') return entry.settings.videoNames[0] || '';
   return '';
 };

 // Filter by Search Query and Filter Type
 const filteredHistory = history.filter(entry => {
 // 1. Filter Type Check
 if (filterType !== 'all' && entry.settings.inputMode !== filterType) {
 return false;
 }

 // 2. Folder Check
 if (selectedFolderId !== null) {
 if (entry.folderId !== selectedFolderId) {
 return false;
 }
 }

 // 2. Search Query Check
 if (searchQuery.trim()) {
 const query = searchQuery.toLowerCase().trim();
 const conceptInput = entry.settings.conceptsInput.toLowerCase();
 const matchesConcept = conceptInput.includes(query);
 const matchesSets = entry.sets.some(s => 
 s.originalConcept.toLowerCase().includes(query) ||
 s.prompts.some(p => {
 const str = typeof p === 'string' ? p : JSON.stringify(p);
 return str.toLowerCase().includes(query);
 })
 );
 return matchesConcept || matchesSets;
 }

 return true;
 });

 // Sort entries
 const sortedHistory = [...filteredHistory].sort((a, b) => {
 if (sortOrder === 'newest') return b.timestamp - a.timestamp;
 if (sortOrder === 'oldest') return a.timestamp - b.timestamp;
 if (sortOrder === 'name-asc') return getFirstConcept(a).localeCompare(getFirstConcept(b));
 if (sortOrder === 'name-desc') return getFirstConcept(b).localeCompare(getFirstConcept(a));
 return 0;
 });
 const orderedFolders = [...folders].sort((a, b) => a.createdAt - b.createdAt);
 const selectedFolder = selectedFolderId
 ? orderedFolders.find(folder => folder.id === selectedFolderId) ?? null
 : null;

 return (
 <div className="w-full mt-0 md:-mt-4 lg:-mt-6 px-4 md:px-6 lg:px-8 animate-fade-in">
 <div className="relative w-full">
 <header className="flex justify-between items-center mb-8 flex-shrink-0">
 {selectedFolder ? (
 <div id="historyModalTitle" className="flex items-center gap-2 min-w-0">
 <button
 type="button"
 onClick={() => setSelectedFolderId(null)}
 className="text-sm text-text-secondary hover:text-text-primary transition-colors"
 >
 Library
 </button>
 <span className="material-symbols-outlined text-[18px] text-text-secondary">chevron_right</span>
 <h2 className="text-xl font-semibold text-text-primary truncate">{selectedFolder.name}</h2>
 </div>
 ) : (
 <h2 id="historyModalTitle" className="text-lg font-bold">{t('historyModalTitle')}</h2>
 )}
 <div className="flex items-center space-x-2">
 {folders.length > 0 && !selectedFolder && (
 <button 
 onClick={() => setIsCreatingFolder(true)}
 className="bg-[#1c1c1e] hover:bg-[#2c2c2e] transition-colors text-white w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
 aria-label="Create new folder"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
 </button>
 )}
 </div>
 </header>

 {/* Search History Bar */}
 <div className="relative mb-6 flex-shrink-0 max-w-[360px]">
 <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400">
 <circle cx="11" cy="11" r="8"></circle>
 <path d="m21 21-4.34-4.34"></path>
 </svg>
 <input 
 type="text" 
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search Library"
 className="w-full pl-10 pr-4 py-2 text-sm bg-bg-canvas border border-border-default rounded-[10px] text-text-primary placeholder:text-text-secondary focus:outline-none focus:ring-2 focus:ring-focus focus:border-transparent transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
 />
 </div>

 {/* Filter and Sort options */}
 <div className="flex flex-wrap items-center gap-6 text-sm mb-6 flex-shrink-0">
 <div className="flex items-center gap-3">
 <span className="font-medium text-text-primary">Filter</span>
 <button
 ref={filterTriggerRef}
 type="button"
 className="bg-bg-canvas border border-border-default rounded-[10px] py-1.5 px-3 text-sm cursor-pointer inline-flex items-center justify-between min-w-[130px] hover:bg-surface-primary transition-colors text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
 aria-haspopup="true"
 aria-expanded={isFilterOpen}
 onClick={() => {
 setIsSortOpen(false);
 setIsFilterOpen(v => !v);
 }}
 >
 <span className="truncate pr-2">{filterOptions.find(o => o.value === filterType)?.label || 'All Prompts'}</span>
 <svg
 className="inline-block w-4 h-4 ml-0.5 transition-transform duration-[180ms] flex-shrink-0"
 style={{ transform: isFilterOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 </button>
 </div>
 <div className="flex items-center gap-3">
 <span className="font-medium text-text-primary">Sort</span>
 <button
 ref={sortTriggerRef}
 type="button"
 className="bg-bg-canvas border border-border-default rounded-[10px] py-1.5 px-3 text-sm cursor-pointer inline-flex items-center justify-between min-w-[130px] hover:bg-surface-primary transition-colors text-text-primary shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
 aria-haspopup="true"
 aria-expanded={isSortOpen}
 onClick={() => {
 setIsFilterOpen(false);
 setIsSortOpen(v => !v);
 }}
 >
 <span className="truncate pr-2">{sortOptions.find(o => o.value === sortOrder)?.label || 'Last Created'}</span>
 <svg
 className="inline-block w-4 h-4 ml-0.5 transition-transform duration-[180ms] flex-shrink-0"
 style={{ transform: isSortOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
 </svg>
 </button>
 </div>
 </div>
 {isFilterOpen && typeof document !== 'undefined' && createPortal(
 <div
 ref={filterDropdownRef}
 className="dropdown-menu-portal p-1"
 style={{
 ...filterDropdownStyle,
 transition: 'none',
 }}
 role="menu"
 aria-orientation="vertical"
 >
 <div className="selector-options-list max-h-60 overflow-y-auto flex flex-col gap-0.5">
 {filterOptions.map((option) => (
 <button
 key={option.value}
 type="button"
 onClick={() => {
 setFilterType(option.value);
 setIsFilterOpen(false);
 }}
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${option.value === filterType ? 'active' : ''}`}
 role="menuitemradio"
 aria-checked={option.value === filterType}
 >
 <span>{option.label}</span>
 {option.value === filterType && <span className="material-symbols-outlined text-base">check</span>}
 </button>
 ))}
 </div>
 </div>,
 document.body
 )}
 {isSortOpen && typeof document !== 'undefined' && createPortal(
 <div
 ref={sortDropdownRef}
 className="dropdown-menu-portal p-1"
 style={{
 ...sortDropdownStyle,
 transition: 'none',
 }}
 role="menu"
 aria-orientation="vertical"
 >
 <div className="selector-options-list max-h-60 overflow-y-auto flex flex-col gap-0.5">
 {sortOptions.map((option) => (
 <button
 key={option.value}
 type="button"
 onClick={() => {
 setSortOrder(option.value);
 setIsSortOpen(false);
 }}
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${option.value === sortOrder ? 'active' : ''}`}
 role="menuitemradio"
 aria-checked={option.value === sortOrder}
 >
 <span>{option.label}</span>
 {option.value === sortOrder && <span className="material-symbols-outlined text-base">check</span>}
 </button>
 ))}
 </div>
 </div>,
 document.body
 )}

 {/* Move to Folder Modal */}
 <AnimatedModalWrapper
 isOpen={!!(folderMoveEntry || bulkMoveEntryIds.length > 0)}
 onClose={closeMoveToFolderModal}
 modalClassName="w-full max-w-[480px] min-h-[408px] rounded-[18px] p-6"
 >
 <button
 type="button"
 onClick={closeMoveToFolderModal}
 className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1"
 aria-label="Close"
 >
 <span className="material-symbols-outlined text-[22px]">close</span>
 </button>

 <h2 className="text-lg font-bold text-text-primary mb-3 pr-8">Move to Folder</h2>
 <p className="text-sm text-text-secondary mb-8">
 {bulkMoveEntryIds.length > 0
 ? `Select a folder for ${bulkMoveEntryIds.length} selected prompts.`
 : 'Select a folder for this prompt.'}
 </p>

 <div className="space-y-4">
 <label className="flex items-center gap-3 cursor-pointer text-sm text-text-primary">
 <input
 type="radio"
 name="move-folder"
 checked={pendingMoveFolderId === null}
 onChange={() => setPendingMoveFolderId(null)}
 className="w-4 h-4"
 />
 <span className="material-symbols-outlined text-xl text-text-secondary">folder</span>
 <span className="font-medium text-text-secondary">No folder</span>
 </label>

 {orderedFolders.map(folder => (
 <label key={folder.id} className="flex items-center gap-3 cursor-pointer text-sm text-text-primary">
 <input
 type="radio"
 name="move-folder"
 checked={pendingMoveFolderId === folder.id}
 onChange={() => setPendingMoveFolderId(folder.id)}
 className="w-4 h-4"
 />
 <span className="material-symbols-outlined text-xl text-text-secondary">folder</span>
 <span>{folder.name}</span>
 </label>
 ))}

 <button
 type="button"
 onClick={() => {
 closeMoveToFolderModal();
 setIsCreatingFolder(true);
 }}
 className="flex items-center gap-3 text-sm text-text-primary hover:text-text-main transition-colors"
 >
 <span className="material-symbols-outlined text-xl text-text-secondary">add</span>
 <span>New folder</span>
 </button>
 </div>

 <div className="absolute bottom-6 right-6 flex items-center gap-2">
 <button
 type="button"
 onClick={closeMoveToFolderModal}
 className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[#f3f4f6] text-gray-800 hover:bg-gray-200 transition-colors"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleMoveToFolder}
 className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-[#111111] text-white hover:bg-[#2a2a2a] transition-colors"
 >
 Move
 </button>
 </div>
 </AnimatedModalWrapper>

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
 className="folder-modal-btn px-5 py-2.5 text-[13px] font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
 style={{ borderRadius: '14px' }}
 >
 Cancel
 </button>
 <button 
 type="submit" 
 disabled={!newFolderName.trim()} 
 className="folder-modal-btn px-5 py-2.5 text-[13px] font-semibold bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 style={{ borderRadius: '14px' }}
 >
 Create
 </button>
 </div>
 </form>
 </AnimatedModalWrapper>

 {/* Delete Folder Modal */}
 <AnimatedModalWrapper
 isOpen={!!folderToDelete}
 onClose={() => setFolderToDelete(null)}
 modalClassName="bg-white w-full max-w-sm rounded-[20px] p-6"
 >
 <button type="button" onClick={() => setFolderToDelete(null)} className="absolute top-4 right-4 text-text-secondary hover:text-text-primary p-1">
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
 </button>
 
 <h2 className="text-lg font-bold text-text-primary mb-4 pr-6">Are you sure you want to delete?</h2>
 <p className="text-sm text-text-secondary mb-8">
 This will delete "{folderToDelete?.name}" and move {folderToDelete?.count} items to Unorganised. This action cannot be undone.
 </p>
 
 <div className="flex items-center justify-end gap-3">
 <button 
 type="button" 
 onClick={() => setFolderToDelete(null)} 
 className="px-5 py-2.5 rounded-xl text-[13px] font-medium bg-[#f3f4f6] text-gray-800 border-[3px] border-[#bbd8fb] hover:bg-gray-200 transition-colors"
 >
 Cancel
 </button>
 <button 
 type="button" 
 onClick={() => {
 if (folderToDelete) {
 handleDeleteFolder(folderToDelete.id);
 setFolderToDelete(null);
 }
 }} 
 className="px-5 py-2.5 rounded-xl text-[13px] font-medium bg-[#ef4444] text-white hover:bg-[#dc2626] transition-colors shadow-sm"
 >
 Delete
 </button>
 </div>
 </AnimatedModalWrapper>

 <div className="w-full border-b border-border-default mb-6"></div>

 {/* Content Body */}
 <div className="w-full pr-1">
 
 {!selectedFolder && (
 <div className="mb-10">
 <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-6">FOLDERS</h3>
 
 {folders.length === 0 ? (
 <div className="flex flex-col items-center justify-center py-16 w-full">
 <p className="text-sm text-text-secondary mb-4">You have no folders</p>
 <button 
 onClick={() => setIsCreatingFolder(true)}
 className="bg-[#1c1c1e] hover:bg-[#2c2c2e] transition-colors text-white px-4 py-2 text-sm font-medium flex items-center gap-2 folder-modal-btn"
 >
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path><path d="M12 10v6"></path><path d="M9 13h6"></path></svg>
 Create folder
 </button>
 </div>
 ) : (
 <div className="flex flex-col gap-4">
 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 {orderedFolders.map(folder => {
 const itemsCount = history.filter(h => h.folderId === folder.id).length;
 return (
 <FolderCardComponent
 key={folder.id}
 folder={folder}
 itemsCount={itemsCount}
 isSelected={false}
 onClick={() => setSelectedFolderId(folder.id)}
 onEdit={handleEditFolder}
 onDelete={(id, name, count) => setFolderToDelete({ id, name, count })}
 />
 );
 })}
 </div>
 </div>
 )}
 </div>
 )}

 {/* HISTORY Section */}
 {(!selectedFolder || isSelectionMode) && <div className="mb-4 flex items-center justify-between gap-4">
 {!selectedFolder ? (
 <button
 type="button"
 onClick={() => setIsHistorySectionOpen(prev => !prev)}
 className="inline-flex items-center gap-1 text-xs leading-none font-semibold text-text-secondary uppercase tracking-wider cursor-pointer hover:text-text-main transition-colors"
 aria-expanded={isHistorySectionOpen}
 >
 <span className="leading-none">HISTORY ({filteredHistory.length})</span>
 <svg
 xmlns="http://www.w3.org/2000/svg"
 width="12"
 height="12"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth="2.4"
 strokeLinecap="round"
 strokeLinejoin="round"
 className={`block translate-y-[0.75px] transition-transform duration-200 ${isHistorySectionOpen ? 'rotate-90' : ''}`}
 aria-hidden="true"
 >
 <path d="m9 18 6-6-6-6" />
 </svg>
 </button>
 ) : (
 <div></div>
 )}
 {isSelectionMode && (
 <div className="flex items-center gap-5 text-xs font-semibold">
 <button
 type="button"
 onClick={openBulkMoveToFolderModal}
 className="inline-flex items-center gap-1 text-text-secondary hover:text-text-main transition-colors"
 >
 <span className="material-symbols-outlined text-[15px]">folder</span>
 <span>Move ({selectedEntryCount})</span>
 </button>
 <button
 type="button"
 onClick={handleDeleteSelectedEntries}
 className="inline-flex items-center gap-1 text-red-700 hover:text-red-600 transition-colors"
 >
 <span className="material-symbols-outlined text-[15px]">delete</span>
 <span>Delete ({selectedEntryCount})</span>
 </button>
 <button
 type="button"
 onClick={() => {
 if (selectedEntryCount === sortedHistory.length) {
 setSelectedEntryIds(new Set());
 } else {
 setSelectedEntryIds(new Set(sortedHistory.map(entry => entry.id)));
 }
 }}
 className="inline-flex items-center gap-1 text-text-secondary hover:text-text-main transition-colors"
 >
 <span className="material-symbols-outlined text-[15px]">
 {selectedEntryCount === sortedHistory.length ? 'check_box_outline_blank' : 'library_add_check'}
 </span>
 <span>{selectedEntryCount === sortedHistory.length ? 'Deselect all' : 'Select all'}</span>
 </button>
 </div>
 )}
 </div>}

 {/* Prompts list items */}
 {(selectedFolder || isHistorySectionOpen) && (sortedHistory.length === 0 ? (
 <div className="text-center py-10 legend-text border border-dashed border-gray-200 rounded-2xl bg-gray-500/5">
 <span className="material-symbols-outlined text-3xl mb-2">folder_open</span>
 <p className="text-xs">{searchQuery ? t('noHistoryFound') : selectedFolder ? 'No prompts in this folder.' : 'No prompts found.'}</p>
 </div>
 ) : (
 <div className="space-y-3">
 {sortedHistory.map(entry => {
 const isExpanded = expandedEntryId === entry.id;
 const totalPrompts = entry.sets.reduce((acc, s) => acc + (s.hasError ? 0 : s.prompts.length), 0);
 
 let conceptCount = 0;
 let conceptTypeKey: 'historyConceptType_text' | 'historyConceptType_image' | 'historyConceptType_video' = 'historyConceptType_text';

 switch (entry.settings.inputMode) {
 case 'image':
 conceptCount = entry.settings.imageNames.length;
 conceptTypeKey = 'historyConceptType_image';
 break;
 case 'video':
 conceptCount = entry.settings.videoNames.length;
 conceptTypeKey = 'historyConceptType_video';
 break;
 case 'text':
 default:
 conceptCount = entry.settings.conceptsInput.split(/[,;]/).filter(c => c.trim()).length;
 conceptTypeKey = 'historyConceptType_text';
 break;
 }
 const conceptType = t(conceptTypeKey);

 const conceptTitle = `Generated on ${formatDate(entry.timestamp)}`;
 const firstPrompt = entry.sets[0]?.prompts[0];
 const firstPromptSnippet = formatPromptPreview(firstPrompt);
 const assignedFolder = folders.find(folder => folder.id === entry.folderId);
 const folderButtonLabel = assignedFolder?.name || 'Add to folder';
 const isSelected = selectedEntryIds.has(entry.id);
 const shouldShowCheckbox = isSelectionMode || isExpanded;

 return (
 <div key={entry.id} className="inner-card group transition-all duration-300 overflow-hidden">
 <div 
 className="flex gap-4 cursor-pointer px-4 py-3 hover:bg-black/5 transition-colors h-[120px]"
 onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
 >
 {/* Checkbox Placeholder */}
 <label
 className="flex-shrink-0 self-stretch flex items-center justify-center w-7 cursor-pointer"
 onClick={(e) => e.stopPropagation()}
 >
 <input 
 type="checkbox" 
 checked={isSelected}
 className={`w-[14px] h-[14px] rounded border-border-strong text-indigo-600 focus:ring-indigo-500 bg-transparent cursor-pointer transition-opacity ${shouldShowCheckbox ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
 onChange={(e) => handleEntrySelectionChange(entry.id, e.target.checked)}
 />
 </label>

 <div className="flex-grow min-w-0 flex flex-col justify-between overflow-hidden">
 {/* Top Row */}
 <div className="flex items-center justify-between gap-3 mb-1">
 <div className="flex items-center gap-3 min-w-0">
 <h3 className="font-semibold text-sm text-text-main truncate">{conceptTitle}</h3>
 {onUpdateHistory && !selectedFolder && (
 <button
 type="button"
 className={`inline-flex items-center text-xs leading-none text-text-secondary hover:text-text-main transition-all min-w-0 ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
 onClick={(e) => {
 e.stopPropagation();
 openMoveToFolderModal(entry);
 }}
 >
 <span className="material-symbols-outlined text-[17px] leading-none mr-1 flex-shrink-0">create_new_folder</span>
 <span className="truncate leading-none">{folderButtonLabel}</span>
 </button>
 )}
 </div>
 
 {/* Right Actions */}
 <div className={`flex items-center gap-2 flex-shrink-0 text-text-muted transition-opacity ${isExpanded ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'}`}>
 <button 
 onClick={(e) => { 
 e.stopPropagation(); 
 handleCopy(entry);
 }}
 className="hover:text-text-main transition-colors p-1 flex items-center justify-center rounded"
 disabled={totalPrompts === 0 || copiedId === entry.id}
 aria-label={copiedId === entry.id ? t('copiedButtonLabel') : t('copyPromptsButtonLabel')}
 >
 <span className="material-symbols-outlined text-[16px]">{copiedId === entry.id ? 'done' : 'content_copy'}</span>
 </button>
 <button 
 onClick={(e) => { 
 e.stopPropagation(); 
 handleDownload(entry);
 }}
 className="hover:text-text-main transition-colors p-1 flex items-center justify-center rounded"
 disabled={totalPrompts === 0}
 aria-label={t('downloadPromptsButtonLabel')}
 >
 <span className="material-symbols-outlined text-[16px]">download</span>
 </button>
 <button 
 onClick={(e) => {
 e.stopPropagation();
 onDelete(entry.id);
 }} 
 className="hover:text-red-500 transition-colors p-1 flex items-center justify-center rounded"
 aria-label={t('deleteHistoryEntryButtonLabel')}
 >
 <span className="material-symbols-outlined text-[18px]">delete</span>
 </button>
 </div>
 </div>

 {/* Middle Row: Prompt Snippet */}
 <div className="text-[13px] text-text-muted pr-4 mb-1.5" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '2.6em', lineHeight: '1.3em' }}>
 {firstPromptSnippet || 'No prompt content'}
 </div>

 {/* Bottom Row */}
 <div className="flex items-center gap-3 text-[11px] text-text-secondary">
 <span className="bg-surface-raised border border-border-soft px-2 py-0.5 rounded text-text-main font-medium">
 {t('historyEntrySummary', { numPrompts: totalPrompts, conceptCount, conceptType })}
 </span>
 <span className="bg-orange-100/80 text-orange-700 border border-orange-200/50 px-2 py-0.5 rounded font-medium">
 {t(styleOptionLabels[entry.settings.styleOption])}
 </span>
 </div>
 </div>
 </div>
 {isExpanded && (
 <div className="border-t results-item-divider pt-3 px-4 pb-4">
 <div className="space-y-4 max-h-[30vh] overflow-y-auto pr-1">
 {entry.sets.map((set) => (
 <div key={set.id} className="editorial-result-card inner-card p-4">
 <div className="flex items-center mb-3">
 <h4 className="results-concept-title text-sm font-semibold break-all">{set.originalConcept}</h4>
 </div>
 {set.prompts.map((prompt, promptIndex) => {
 const promptIsObject = typeof prompt === 'object' && prompt !== null;
 const promptIsJsonString = typeof prompt === 'string' && prompt.trim().startsWith('{') && prompt.trim().endsWith('}');

 if (promptIsObject || promptIsJsonString) {
 let content;
 if (promptIsObject) {
 content = JSON.stringify(prompt, null, 2);
 } else {
 try {
 content = JSON.stringify(JSON.parse(prompt as string), null, 2);
 } catch (e) {
 content = prompt as string;
 }
 }
 return (
 <div key={promptIndex} className={`mb-2 pb-2 ${promptIndex < set.prompts.length - 1 ? 'results-item-divider border-b' : ''}`}>
 <pre className="json-code-block"><code>{content}</code></pre>
 </div>
 );
 } else {
 return (
 <div key={promptIndex} className={`results-prompt-text mb-2 pb-2 ${promptIndex < set.prompts.length - 1 ? 'results-item-divider border-b' : ''}`}>
 {(prompt as string).split('\n').map((line, lineIndex) => (
 <React.Fragment key={lineIndex}>{line}{lineIndex < (prompt as string).split('\n').length - 1 && <br />}</React.Fragment>
                                                                            ))}
                                                                        </div>
                                                                    );
                                                                }
                                                            })}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default memo(HistoryModal);

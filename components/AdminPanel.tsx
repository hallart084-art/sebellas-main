
import React, { useState, useCallback, memo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import RoleSelector from './RoleSelector';
import { NotificationKind, NotificationTarget, SentNotificationItem } from '../types';
import { useDropdownPosition } from '../hooks/useDropdownPosition';
import { useErrorLogs } from '../hooks/useErrorLogs';
import { MODEL_PROVIDER_LABELS, getModelProvider, ApiModel } from '../constants';

interface AdminPanelProps {
 isOpen: boolean;
 onClose: () => void;
 isSidebarOpen: boolean;
 onSendNotification: (payload: {
 title: string;
 message: string;
 target: NotificationTarget;
 recipientUsername?: string;
 kind: NotificationKind;
 }) => Promise<{ success: boolean; message: string }>;
 onListSentNotifications: () => Promise<{ success: boolean; message?: string; items: SentNotificationItem[] }>;
 onUpdateSentNotification: (payload: {
 dispatchId: string;
 title: string;
 message: string;
 kind: NotificationKind;
 }) => Promise<{ success: boolean; message: string }>;
 onDeleteSentNotification: (dispatchId: string) => Promise<{ success: boolean; message: string }>;
}

type Tab = 'users' | 'create' | 'settings' | 'notifications' | 'errors';
const ADMIN_ACTIVE_TAB_STORAGE_KEY = 'adminActiveTab';
const adminTabs: Tab[] = ['users', 'create', 'settings', 'notifications', 'errors'];

const isAdminTab = (value: string | null): value is Tab => {
 return Boolean(value && adminTabs.includes(value as Tab));
};

interface AdminDropdownOption {
 value: string;
 label: string;
}

const AdminDropdown: React.FC<{
 id?: string;
 value: string;
 placeholder: string;
 options: AdminDropdownOption[];
 onChange: (value: string) => void;
 disabled?: boolean;
}> = ({ id, value, placeholder, options, onChange, disabled = false }) => {
 const [isOpen, setIsOpen] = useState(false);
 const triggerRef = useRef<HTMLButtonElement>(null);
 const { dropdownRef, dropdownStyle } = useDropdownPosition({
 isOpen,
 triggerRef,
 onClose: () => setIsOpen(false),
 minWidth: 180,
 });

 const selected = options.find((option) => option.value === value);
 const displayLabel = selected?.label || placeholder;

 const handleSelect = (nextValue: string) => {
 onChange(nextValue);
 setIsOpen(false);
 };

 return (
 <div className="relative w-full">
 <button
 id={id}
 ref={triggerRef}
 type="button"
 className="admin-input admin-dropdown-trigger"
 aria-haspopup="menu"
 aria-expanded={isOpen}
 onClick={() => setIsOpen((current) => !current)}
 disabled={disabled}
 >
 <span className={`truncate ${selected ? '' : 'admin-dropdown-placeholder'}`}>{displayLabel}</span>
 <svg
 className="inline-block w-4 h-4 ml-1 transition-transform duration-[180ms] flex-shrink-0 text-gray-500 "
 style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
 fill="none"
 stroke="currentColor"
 viewBox="0 0 24 24"
 xmlns="http://www.w3.org/2000/svg"
 aria-hidden="true"
 >
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
 </svg>
 </button>
 {isOpen && typeof document !== 'undefined' && createPortal(
 <div ref={dropdownRef} className="dropdown-menu-portal admin-dropdown-menu p-1" style={dropdownStyle} role="menu">
 <div className="selector-options-list max-h-60 overflow-y-auto flex flex-col gap-0.5">
 {options.map((option) => (
 <button
 key={option.value}
 type="button"
 className={`dropdown-menu-item flex items-center justify-between w-full text-left px-3 py-2 text-sm ${option.value === value ? 'active' : ''}`}
 role="menuitemradio"
 aria-checked={option.value === value}
 onClick={() => handleSelect(option.value)}
 >
 <span className="truncate pr-2">{option.label}</span>
 {option.value === value && <span className="material-symbols-outlined text-base">check</span>}
 </button>
 ))}
 </div>
 </div>,
 document.body
 )}
 </div>
 );
};

const AdminConfirmModal: React.FC<{
 isOpen: boolean;
 onClose: () => void;
 onConfirm: () => void;
 title: string;
 message: string;
 confirmText?: string;
 cancelText?: string;
}> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'OK', cancelText = 'Batal' }) => {
 const [render, setRender] = useState(isOpen);
 const [isClosing, setIsClosing] = useState(false);
 const [isConfirming, setIsConfirming] = useState(false);

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

 if (!render || typeof document === 'undefined') return null;

 return createPortal(
 <div 
 className={`fixed inset-0 bg-black/45 flex items-center justify-center p-4 z-[99999] ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
 onClick={onClose}
 >
 <div 
 className={`modal-card relative shadow-2xl p-6 max-w-sm w-full ${isClosing ? 'animate-slide-out-bottom-right-center' : 'animate-slide-in-bottom-right-center'}`}
 onClick={(e) => e.stopPropagation()}
 style={{ background: 'var(--bg-surface)' }}
 >
 <h3 className="text-lg font-bold mb-2 text-[var(--text-primary)]">{title}</h3>
 <p className="text-sm mb-6 text-[var(--text-secondary)]">{message}</p>
 <div className="flex items-center justify-end gap-3">
 <button type="button" className="btn btn-secondary text-[13px]" onClick={onClose} disabled={isConfirming}>
 {cancelText}
 </button>
 <button 
 type="button" 
 className="btn btn-destructive text-[13px]" 
 disabled={isConfirming}
 onClick={async () => {
 setIsConfirming(true);
 try {
 await onConfirm();
 } finally {
 setIsConfirming(false);
 onClose();
 }
 }}
 >
 {isConfirming ? 'Memproses...' : confirmText}
 </button>
 </div>
 </div>
 </div>,
 document.body
 );
};

const AdminPanel: React.FC<AdminPanelProps> = ({
 isOpen,
 onClose,
 isSidebarOpen,
 onSendNotification,
 onListSentNotifications,
 onUpdateSentNotification,
 onDeleteSentNotification,
}) => {
 const { getAllUsers, createUser, deleteUser, updateUserAccount, toggleUserActive, resetUserDevice, resetExtensionSession, updateOwnAccount, currentUser, isSuperAdmin, onlineUsers } = useAuth(); const [isTogglingUser, setIsTogglingUser] = useState<string | null>(null);
 // Controls the CSS entry animation — set to true when panel opens, cleared after animation ends
 const [isEntryAnimating, setIsEntryAnimating] = useState<boolean>(false);

 const [activeTab, setActiveTab] = useState<Tab>(() => {
 if (typeof window === 'undefined') return 'users';
 const stored = window.localStorage.getItem(ADMIN_ACTIVE_TAB_STORAGE_KEY);
 return isAdminTab(stored) ? stored : 'users';
 });

 // Create user form
 const [newUsername, setNewUsername] = useState('');
 const [newPassword, setNewPassword] = useState('');
 const [newUserRole, setNewUserRole] = useState<'admin' | 'user'>('user');
 const [showNewPassword, setShowNewPassword] = useState(false);
 const [createMsg, setCreateMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
 const [isCreating, setIsCreating] = useState(false);

 // Edit account state
 const [resetTarget, setResetTarget] = useState<string | null>(null);
 const [resetNewUsername, setResetNewUsername] = useState('');
 const [resetNewRole, setResetNewRole] = useState<'user'|'admin'|'superadmin'>('user');
 const [resetPassword, setResetPassword] = useState('');
 const [showResetPassword, setShowResetPassword] = useState(false);
 const [resetMsg, setResetMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

 // Delete confirmation
 

 // Edit own account
 const [oldPassword, setOldPassword] = useState('');
 const [newOwnUsername, setNewOwnUsername] = useState('');
 const [newOwnPassword, setNewOwnPassword] = useState('');
 const [showOldPwd, setShowOldPwd] = useState(false);
 const [showNewPwd, setShowNewPwd] = useState(false);
 const [updateAccountMsg, setUpdateAccountMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
 const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
 const [isEditOwnAccountOpen, setIsEditOwnAccountOpen] = useState(false);

 // Notifications
 const [notificationTitle, setNotificationTitle] = useState('');
 const [notificationMessage, setNotificationMessage] = useState('');
 const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('all');
 const [notificationRecipient, setNotificationRecipient] = useState('');
 const [notificationKind, setNotificationKind] = useState<NotificationKind>('info');
 const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
 const [isSendingNotification, setIsSendingNotification] = useState(false);
 const [sentNotifications, setSentNotifications] = useState<SentNotificationItem[]>([]);
 const [isLoadingSentNotifications, setIsLoadingSentNotifications] = useState(false);
 const [editingDispatchId, setEditingDispatchId] = useState<string | null>(null);
 const [editTitle, setEditTitle] = useState('');
 const [editMessage, setEditMessage] = useState('');
 const [editKind, setEditKind] = useState<NotificationKind>('info');
 const [isSavingEdit, setIsSavingEdit] = useState(false);
 
 
 const [copiedErrorLogId, setCopiedErrorLogId] = useState<string | null>(null);
 const [confirmModalConfig, setConfirmModalConfig] = useState<{
 isOpen: boolean;
 title: string;
 message: string;
 confirmText?: string;
 onConfirm: () => void;
 } | null>(null);

 const {
 errorLogs,
 isLoadingErrorLogs,
 isClearingErrorLogs,
 deletingErrorLogId,
 loadErrorLogs,
 clearErrorLogs,
 deleteErrorLog,
 } = useErrorLogs(currentUser, isOpen && activeTab === 'errors');

 const users = getAllUsers();
 
 const displayUsers = users.filter(u => {
 if (u.id === currentUser?.id) return false;
 if (u.role === 'superadmin') return false;
 if (!isSuperAdmin && u.role === 'admin') return false;
 return true;
 });
 const activeRecipients = users.filter((u) => u.isActive).map((u) => u.username);
 const recipientOptions = activeRecipients.map((username) => ({ value: username, label: username }));
 const notificationKindOptions: AdminDropdownOption[] = [
 { value: 'info', label: 'Info' },
 { value: 'success', label: 'Success' },
 { value: 'warning', label: 'Warning' },
 { value: 'error', label: 'Error' },
 ];

 const handleCreate = useCallback(async () => {
 if (!newUsername.trim() || !newPassword) return;
 setIsCreating(true);
 setCreateMsg(null);
 const result = await createUser(newUsername, newPassword, newUserRole);
 setCreateMsg({ type: result.success ? 'success' : 'error', text: result.message });
 if (result.success) {
 setNewUsername('');
 setNewPassword('');
 setNewUserRole('user');
 }
 setIsCreating(false);
 }, [newUsername, newPassword, newUserRole, createUser]);

 const handleUpdateAccount = useCallback(async () => {
 if (!resetTarget) return;
 const targetUser = users.find(u => u.username === resetTarget);
 if (!resetNewUsername && !resetPassword && (!resetNewRole || resetNewRole === targetUser?.role)) {
 setResetMsg({ type: 'error', text: 'Tidak ada perubahan.' });
 return;
 }
 const result = await updateUserAccount(resetTarget, resetNewUsername, resetPassword, resetNewRole);
 setResetMsg({ type: result.success ? 'success' : 'error', text: result.message });
 if (result.success) {
 setResetPassword('');
 setTimeout(() => {
 setResetTarget(null);
 setResetMsg(null);
 }, 2000);
 }
 }, [resetTarget, resetNewUsername, resetPassword, resetNewRole, users, updateUserAccount]);

 const handleUpdateOwnAccount = useCallback(async () => {
 if (!oldPassword) return;
 if (!newOwnUsername && !newOwnPassword) {
 setUpdateAccountMsg({ type: 'error', text: 'Tidak ada perubahan.' });
 return;
 }
 setIsUpdatingAccount(true);
 setUpdateAccountMsg(null);
 const result = await updateOwnAccount(oldPassword, newOwnUsername, newOwnPassword);
 setUpdateAccountMsg({ type: result.success ? 'success' : 'error', text: result.message });
 if (result.success) {
 setOldPassword('');
 setNewOwnUsername('');
 setNewOwnPassword('');
 }
 setIsUpdatingAccount(false);
 }, [oldPassword, newOwnUsername, newOwnPassword, updateOwnAccount]);

 const handleSendNotification = useCallback(async () => {
 if (!notificationTitle.trim() || !notificationMessage.trim()) {
 setNotificationMsg({ type: 'error', text: 'Judul dan pesan wajib diisi.' });
 return;
 }
 if (notificationTarget === 'single_user' && !notificationRecipient) {
 setNotificationMsg({ type: 'error', text: 'Pilih user tujuan terlebih dahulu.' });
 return;
 }

 setIsSendingNotification(true);
 setNotificationMsg(null);
 const result = await onSendNotification({
 title: notificationTitle.trim(),
 message: notificationMessage.trim(),
 target: notificationTarget,
 recipientUsername: notificationTarget === 'single_user' ? notificationRecipient : undefined,
 kind: notificationKind,
 });
 if (result.success) {
 setNotificationTitle('');
 setNotificationMessage('');
 setNotificationRecipient('');
 setNotificationKind('info');
 setNotificationTarget('all');
 const refresh = await onListSentNotifications();
 if (refresh.success) {
 setSentNotifications(refresh.items);
 }
 } else {
 setNotificationMsg({ type: 'error', text: result.message });
 }
 setIsSendingNotification(false);
 }, [
 notificationTitle,
 notificationMessage,
 notificationTarget,
 notificationRecipient,
 notificationKind,
 onSendNotification,
 onListSentNotifications,
 ]);

 const loadSentNotifications = useCallback(async (options?: { silent?: boolean }) => {
 const silent = Boolean(options?.silent);
 if (!silent) {
 setIsLoadingSentNotifications(true);
 }
 const result = await onListSentNotifications();
 if (result.success) {
 setSentNotifications(result.items);
 } else {
 setNotificationMsg({ type: 'error', text: result.message || 'Gagal memuat notifikasi terkirim.' });
 }
 if (!silent) {
 setIsLoadingSentNotifications(false);
 }
 }, [onListSentNotifications]);

 const beginEditNotification = useCallback((item: SentNotificationItem) => {
 setEditingDispatchId(item.dispatchId);
 setEditTitle(item.title);
 setEditMessage(item.message);
 setEditKind(item.kind);
 setNotificationMsg(null);
 }, []);

 const handleSaveEditedNotification = useCallback(async () => {
 if (!editingDispatchId) return;
 if (!editTitle.trim() || !editMessage.trim()) {
 setNotificationMsg({ type: 'error', text: 'Judul dan pesan wajib diisi.' });
 return;
 }

 setIsSavingEdit(true);
 const result = await onUpdateSentNotification({
 dispatchId: editingDispatchId,
 title: editTitle.trim(),
 message: editMessage.trim(),
 kind: editKind,
 });
 if (result.success) {
 setEditingDispatchId(null);
 setEditTitle('');
 setEditMessage('');
 await loadSentNotifications({ silent: true });
 } else {
 setNotificationMsg({ type: 'error', text: result.message });
 }
 setIsSavingEdit(false);
 }, [editingDispatchId, editTitle, editMessage, editKind, onUpdateSentNotification, loadSentNotifications]);

 const handleDeleteNotification = useCallback(async (dispatchId: string) => {
    setNotificationMsg(null);

    const result = await onDeleteSentNotification(dispatchId);
    if (result.success) {
      setSentNotifications((prev) => prev.filter((item) => item.dispatchId !== dispatchId));
      if (editingDispatchId === dispatchId) {
        setEditingDispatchId(null);
        setEditTitle('');
        setEditMessage('');
      }
      await loadSentNotifications({ silent: true });
    } else {
      setNotificationMsg({ type: 'error', text: result.message });
    }
  }, [onDeleteSentNotification, loadSentNotifications, editingDispatchId]);

 const clearAllErrorLogs = useCallback(() => {
 setConfirmModalConfig({
 isOpen: true,
 title: 'Hapus Semua Error',
 message: 'Apakah Anda yakin ingin menghapus SEMUA riwayat error aplikasi? Tindakan ini tidak dapat dibatalkan.',
 confirmText: 'Ya, Hapus Semua',
 onConfirm: async () => {
 const result = await clearErrorLogs();
 setNotificationMsg({ type: result.success ? 'success' : 'error', text: result.message });
 }
 });
 }, [clearErrorLogs]);

 const deleteIndividualErrorLog = useCallback((id: string) => {
 setConfirmModalConfig({
 isOpen: true,
 title: 'Hapus Error',
 message: 'Apakah Anda yakin ingin menghapus error log ini?',
 confirmText: 'Ya, Hapus',
 onConfirm: async () => {
 const result = await deleteErrorLog(id);
 setNotificationMsg({ type: result.success ? 'success' : 'error', text: result.message });
 }
 });
 }, [deleteErrorLog]);

 const copyErrorLog = useCallback(async (id: string, errorMessage: string) => {
 if (!errorMessage) return;
 try {
 await navigator.clipboard.writeText(errorMessage);
 setCopiedErrorLogId(id);
 window.setTimeout(() => {
 setCopiedErrorLogId((current) => current === id ? null : current);
 }, 1600);
 } catch (error) {
 console.error('Could not copy error log: ', error);
 setNotificationMsg({ type: 'error', text: 'Gagal menyalin error log.' });
 }
 }, []);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (e.key === 'Escape') {
 onClose();
 }
 };
 window.addEventListener('keydown', handleKeyDown);
 return () => {
 window.removeEventListener('keydown', handleKeyDown);
 };
 }, [onClose]);

 useEffect(() => {
 if (!isOpen) return;
 if (activeTab === 'notifications') {
 loadSentNotifications();
 }
 }, [isOpen, activeTab, loadSentNotifications]);

 useEffect(() => {
 if (typeof window === 'undefined') return;
 window.localStorage.setItem(ADMIN_ACTIVE_TAB_STORAGE_KEY, activeTab);
 }, [activeTab]);

 // Trigger the entry animation once every time the panel opens
 useEffect(() => {
 if (isOpen) {
 setIsEntryAnimating(true);
 } else {
 setIsEntryAnimating(false);
 }
 }, [isOpen]);

 if (!isOpen) return null;

 const formatDate = (value: number | string) => {
 const ts = typeof value === 'number' ? value : Date.parse(value);
 return new Date(ts).toLocaleDateString('id-ID', {
 day: 'numeric', month: 'short', year: 'numeric',
 hour: '2-digit', minute: '2-digit'
 });
 };

 const content = (
 <div
 className={`admin-panel-container${isEntryAnimating ? ' animate-fade-in' : ''}`}
 onAnimationEnd={() => setIsEntryAnimating(false)}
 >
 {/* Header */}
 <div className="admin-panel-header">
 <div className="admin-panel-header-left">
 <div className="admin-panel-icon-ring">
 <span className="material-symbols-outlined">admin_panel_settings</span>
 </div>
 <div>
 <h2 className="admin-panel-title">Admin Panel</h2>
 <p className="admin-panel-subtitle">Kelola akun pengguna</p>
 </div>
 </div>
 
 </div>

 {/* Stats */}
 <div className="pt-6 pb-2 flex-shrink-0">
 <div className="admin-stats-banner">
 <div className="admin-stat-item">
 <div className="admin-stat-header">
 <span className="material-symbols-outlined">group</span> Total
 </div>
 <span className="admin-stat-value">{displayUsers.length}</span>
 </div>
 <div className="admin-stat-item">
              <div className="admin-stat-header stat-active" style={{ color: '#10B981' }}>
                <span className="stat-dot" style={{ backgroundColor: '#10B981' }}></span> Sedang Aktif
              </div>
              <span className="admin-stat-value">{onlineUsers.length}</span>
            </div>
            
            <div className="admin-stat-item">
              <div className="admin-stat-header stat-inactive">
                <span className="stat-dot"></span> Dinonaktifkan
              </div>
              <span className="admin-stat-value">{displayUsers.filter(u => !u.isActive).length}</span>
            </div>
 </div>
 </div>

 {/* Tabs */}
 <div className="py-2 flex-shrink-0">
 <div className="admin-tabs-selector">
 <div 
 className="admin-tabs-slider"
 style={{
 transform: `translateX(${activeTab === 'users' ? '0%' : activeTab === 'create' ? '100%' : activeTab === 'settings' ? '200%' : activeTab === 'notifications' ? '300%' : '400%'})`,
 width: 'calc((100% - (var(--admin-tabs-gap) * 2)) / 5)',
 }}
 />
 <button className={`admin-tabs-button ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
 <span className="material-symbols-outlined">group</span>
 <span>Pengguna</span>
 </button>
 <button className={`admin-tabs-button ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
 <span className="material-symbols-outlined">person_add</span>
 <span>Buat Akun</span>
 </button>
 <button className={`admin-tabs-button ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
 <span className="material-symbols-outlined">manage_accounts</span>
 <span>Akun Saya</span>
 </button>
 <button className={`admin-tabs-button ${activeTab === 'notifications' ? 'active' : ''}`} onClick={() => setActiveTab('notifications')}>
 <span className="material-symbols-outlined">notifications</span>
 <span>Notifikasi</span>
 </button>
 <button className={`admin-tabs-button ${activeTab === 'errors' ? 'active' : ''}`} onClick={() => setActiveTab('errors')}>
 <span className="material-symbols-outlined">bug_report</span>
 <span>Error Logs</span>
 </button>
 </div>
 </div>

 {/* Content */}
 <div className="admin-panel-content">

 {/* ===== TAB: USERS ===== */}
 {activeTab === 'users' && (
 <div className="admin-users-list">
 {displayUsers.length === 0 ? (
 <div className="admin-empty-state">
 <span className="material-symbols-outlined admin-empty-icon">group_off</span>
 <p>Belum ada pengguna. Buat akun baru di tab "Buat Akun".</p>
 </div>
 ) : (
 displayUsers.map(user => (
 <div key={user.username} className={`admin-user-card ${!user.isActive ? 'inactive' : ''}`}>
 <div className="admin-user-card-header">
 <div className="admin-user-info">
 <div className="admin-user-avatar" style={{ position: 'relative' }}>
                    <span style={{ lineHeight: 1 }}>{user.username.charAt(0).toUpperCase()}</span>
                    {onlineUsers.includes(user.username) && (
                      <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid var(--bg-main-light, #fff)' }} title="Online"></div>
                    )}
                  </div>
 <div className="admin-user-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span className="admin-user-name" style={{ marginBottom: 0 }}>{user.username}</span>
 <span className={`admin-user-badge role-${user.role}`}>
 {user.role === 'superadmin' ? 'Superadmin' : user.role === 'admin' ? 'Admin' : 'User'}
 </span>
 {!user.isActive && (
                            <span className="admin-user-badge inactive">
                              Nonaktif
                            </span>
                          )}
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <span className="admin-user-meta" style={{ display: 'flex', alignItems: 'center' }}>
 Dibuat {formatDate(user.createdAt)}
 </span>
 </div>
 </div>
 </div>
 <div className="admin-user-actions">
 {/* Reset Device */}
 {user.sessionToken && (
 <button
 className="btn btn-secondary btn-icon admin-reset-btn"
 title="Reset Perangkat (Buka Kunci)"
 onClick={() => resetUserDevice(user.username)}
 >
 <span className="material-symbols-outlined">phonelink_erase</span>
 </button>
 )}
 {/* Reset Extension */}
 {user.extSessionToken && (
 <button
 className="btn btn-secondary btn-icon admin-reset-btn"
 title="Reset Sesi Ekstensi"
 onClick={() => resetExtensionSession(user.username)}
 >
 <span className="material-symbols-outlined">extension_off</span>
 </button>
 )}
 {/* Edit Account */}
 <button
 className={`btn ${resetTarget === user.username ? 'btn-secondary' : 'btn-action'} btn-icon`}
 title={resetTarget === user.username ? "Batal Edit" : "Edit Akun (Username/Password)"}
 onClick={() => {
 if (resetTarget === user.username) {
 setResetTarget(null); setResetMsg(null);
 } else {
 setResetTarget(user.username); setResetNewUsername(user.username); setResetPassword(''); setResetNewRole(user.role as any); setResetMsg(null);
 }
 }}
 >
 <span className="material-symbols-outlined" style={{ transition: 'transform 0.2s', transform: resetTarget === user.username ? 'rotate(90deg)' : 'rotate(0deg)' }}>
 {resetTarget === user.username ? 'close' : 'edit'}
 </span>
 </button>
 {/* Toggle active */}
 <button
 className={`btn ${user.isActive ? 'btn-secondary admin-deactivate-btn' : 'btn-success admin-activate-btn'} btn-icon`}
 title={user.isActive ? 'Nonaktifkan' : 'Aktifkan'}
 disabled={isTogglingUser === user.username}
 onClick={async () => { setIsTogglingUser(user.username); await toggleUserActive(user.username); setIsTogglingUser(null); }}
 >
 <span className="material-symbols-outlined">
 {user.isActive ? 'block' : 'check_circle'}
 </span>
 </button>
 {/* Delete */}
 <button
 className="btn btn-destructive btn-icon"
 title="Hapus Akun"
 onClick={() => {
                            setConfirmModalConfig({
                              isOpen: true,
                              title: 'Hapus Akun',
                              message: `Yakin hapus akun ${user.username}? Tindakan ini tidak dapat dibatalkan.`,
                              confirmText: 'Ya, Hapus',
                              onConfirm: async () => {
                                await deleteUser(user.username);
                              }
                            });
                          }}
 >
 <span className="material-symbols-outlined">delete</span>
 </button>
 </div>
 </div>

 {/* Edit Account inline */}
 {/* Edit Account inline */}
 {resetTarget === user.username && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '0.5rem' }}>
 <div style={{ display: 'flex', gap: '0.875rem' }}>
 <div className="admin-form-field" style={{ flex: 1 }}>
 <label className="admin-form-label">
 Nama Akun (Username)
 </label>
 <div className="admin-input-wrapper">
 <input
 type="text"
 className="admin-input"
 placeholder="Username baru"
 value={resetNewUsername}
 onChange={e => setResetNewUsername(e.target.value)}
 />
 </div>
 </div>
 
 <div className="admin-form-field" style={{ flex: 1 }}>
 <label className="admin-form-label">
 Password
 </label>
 <div className="admin-input-wrapper">
 <input
 type={showResetPassword ? 'text' : 'password'}
 className="admin-input"
 placeholder="Password baru (opsional)"
 value={resetPassword}
 onChange={e => setResetPassword(e.target.value)}
 />
 <button type="button" className="admin-pwd-toggle" onClick={() => setShowResetPassword(v => !v)}>
 <span className="material-symbols-outlined">{showResetPassword ? 'visibility_off' : 'visibility'}</span>
 </button>
 </div>
 </div>
 </div>

 {isSuperAdmin && (
 <div className="admin-form-field">
 <label className="admin-form-label">
 Role Akses
 </label>
 <RoleSelector 
 currentRole={resetNewRole}
 onRoleChange={setResetNewRole}
 options={['user', 'admin']}
 />
 </div>
 )}

 {resetMsg && (
 <div className={`admin-message ${resetMsg.type}`}>
 <span className="material-symbols-outlined">
 {resetMsg.type === 'success' ? 'check_circle' : 'error'}
 </span>
 {resetMsg.text}
 </div>
 )}

 <button
 className="admin-submit-btn"
 onClick={handleUpdateAccount}
 disabled={!resetNewUsername || (resetPassword.length > 0 && resetPassword.length < 6)}
 >
 <span className="material-symbols-outlined">save</span>Simpan Perubahan
 </button>
 </div>
 )}

 
 </div>
 ))
 )}
 </div>
 )}

 {/* ===== TAB: CREATE ===== */}
 {activeTab === 'create' && (
 <div className="admin-create-form">
 <div className="admin-form-field">
 <label className="admin-form-label">
 Nama Akun (Username)
 </label>
 <input
 type="text"
 className="admin-input"
 placeholder="Masukkan username (min. 3 karakter)"
 value={newUsername}
 onChange={e => { setNewUsername(e.target.value); setCreateMsg(null); }}
 />
 </div>
 <div className="admin-form-field">
 <label className="admin-form-label">
 Password
 </label>
 <div className="admin-input-wrapper">
 <input
 type={showNewPassword ? 'text' : 'password'}
 className="admin-input"
 placeholder="Masukkan password (min. 6 karakter)"
 value={newPassword}
 onChange={e => { setNewPassword(e.target.value); setCreateMsg(null); }}
 />
 <button type="button" className="admin-pwd-toggle" onClick={() => setShowNewPassword(v => !v)}>
 <span className="material-symbols-outlined">{showNewPassword ? 'visibility_off' : 'visibility'}</span>
 </button>
 </div>
 </div>

 {isSuperAdmin && (
 <div className="admin-form-field">
 <label className="admin-form-label">
 Role Akses
 </label>
 <RoleSelector 
 currentRole={newUserRole}
 onRoleChange={setNewUserRole as any}
 options={['user', 'admin']}
 />
 </div>
 )}

 {createMsg && (
 <div className={`admin-message ${createMsg.type}`}>
 <span className="material-symbols-outlined">
 {createMsg.type === 'success' ? 'check_circle' : 'error'}
 </span>
 {createMsg.text}
 </div>
 )}

 <button
 className="admin-submit-btn"
 onClick={handleCreate}
 disabled={isCreating || !newUsername.trim() || newPassword.length < 6}
 >
 {isCreating ? (
 <><span className="login-spinner" />{' '}Membuat akun...</>
 ) : (
 <><span className="material-symbols-outlined">person_add</span>Buat Akun</>
 )}
 </button>
 </div>
 )}

 {/* ===== TAB: SETTINGS ===== */}
 {activeTab === 'settings' && currentUser && (
 <div className="admin-user-card" style={{ cursor: 'default' }}>
 <div className="admin-user-card-header">
 <div className="admin-user-info">
 <div className="admin-user-avatar" style={{ position: 'relative' }}>
                    <span style={{ lineHeight: 1 }}>{currentUser.username.charAt(0).toUpperCase()}</span>
                    {onlineUsers.includes(currentUser.username) && (
                      <div style={{ position: 'absolute', top: '-1px', right: '-1px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: '#10B981', border: '2px solid var(--bg-main-light, #fff)' }} title="Online"></div>
                    )}
                  </div>
 <div className="admin-user-details" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
 <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
 <span className="admin-user-name" style={{ marginBottom: 0 }}>{currentUser.username}</span>
 <span className={`admin-user-badge role-${currentUser.role}`}>
 {currentUser.role === 'superadmin' ? 'Superadmin' : currentUser.role === 'admin' ? 'Admin' : 'User'}
 </span>
 {!currentUser.isActive && (
                            <span className="admin-user-badge inactive">
                              Nonaktif
                            </span>
                          )}
 </div>
 <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
 <span className="admin-user-meta" style={{ display: 'flex', alignItems: 'center' }}>
 Dibuat {formatDate(currentUser.createdAt)}
 </span>
 </div>
 </div>
 </div>
 <div className="admin-user-actions">
 <button
 className={`btn ${isEditOwnAccountOpen ? 'btn-secondary' : 'btn-action'} btn-icon`}
 onClick={() => setIsEditOwnAccountOpen(o => !o)}
 title={isEditOwnAccountOpen ? 'Tutup Edit Akun' : 'Edit Akun'}
 >
 <span className="material-symbols-outlined" style={{ transition: 'transform 0.2s', transform: isEditOwnAccountOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
 {isEditOwnAccountOpen ? 'close' : 'edit'}
 </span>
 </button>
 </div>
 </div>

 {isEditOwnAccountOpen && (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', padding: '0.5rem' }}>
 <div style={{ display: 'flex', gap: '0.875rem' }}>
 <div className="admin-form-field" style={{ flex: 1 }}>
 <label className="admin-form-label">
 Nama Akun (Username)
 </label>
 <div className="admin-input-wrapper">
 <input
 type="text"
 className="admin-input"
 placeholder="Username baru (opsional)"
 value={newOwnUsername}
 onChange={e => { setNewOwnUsername(e.target.value); setUpdateAccountMsg(null); }}
 />
 </div>
 </div>

 <div className="admin-form-field" style={{ flex: 1 }}>
 <label className="admin-form-label">
 Password
 </label>
 <div className="admin-input-wrapper">
 <input
 type={showNewPwd ? 'text' : 'password'}
 className="admin-input"
 placeholder="Masukkan password baru (opsional)"
 value={newOwnPassword}
 onChange={e => { setNewOwnPassword(e.target.value); setUpdateAccountMsg(null); }}
 />
 <button type="button" className="admin-pwd-toggle" onClick={() => setShowNewPwd(v => !v)}>
 <span className="material-symbols-outlined">{showNewPwd ? 'visibility_off' : 'visibility'}</span>
 </button>
 </div>
 </div>
 </div>

 <div className="admin-form-field">
 <label className="admin-form-label">
 Verifikasi
 </label>
 <div className="admin-input-wrapper">
 <input
 type={showOldPwd ? 'text' : 'password'}
 className="admin-input"
 placeholder="Masukkan password saat ini untuk menyimpan"
 value={oldPassword}
 onChange={e => { setOldPassword(e.target.value); setUpdateAccountMsg(null); }}
 />
 <button type="button" className="admin-pwd-toggle" onClick={() => setShowOldPwd(v => !v)}>
 <span className="material-symbols-outlined">{showOldPwd ? 'visibility_off' : 'visibility'}</span>
 </button>
 </div>
 </div>

 {updateAccountMsg && (
 <div className={`admin-message ${updateAccountMsg.type}`}>
 <span className="material-symbols-outlined">
 {updateAccountMsg.type === 'success' ? 'check_circle' : 'error'}
 </span>
 {updateAccountMsg.text}
 </div>
 )}

 <button
 className="admin-submit-btn"
 onClick={handleUpdateOwnAccount}
 disabled={isUpdatingAccount || !oldPassword || (!newOwnUsername && !newOwnPassword)}
 >
 {isUpdatingAccount ? (
 <><span className="login-spinner" />{' '}Menyimpan...</>
 ) : (
 <><span className="material-symbols-outlined">save</span>Simpan Perubahan</>
 )}
 </button>
 </div>
 )}
 </div>
 )}

 {/* ===== TAB: NOTIFICATIONS ===== */}
 {activeTab === 'notifications' && (
 <div className="admin-create-form">
 <div className="admin-form-section-title">Kirim Notifikasi Baru</div>

 <div className="admin-form-field">
 <label className="admin-form-label">Target</label>
 <div className="flex items-center gap-2">
 <button
 type="button"
 className={`btn ${notificationTarget === 'all' ? 'btn-primary' : 'btn-secondary'} btn-action admin-target-btn`}
 onClick={() => {
 setNotificationTarget('all');
 setNotificationMsg(null);
 }}
 >
 Semua User
 </button>
 <button
 type="button"
 className={`btn ${notificationTarget === 'single_user' ? 'btn-primary' : 'btn-secondary'} btn-action admin-target-btn`}
 onClick={() => {
 setNotificationTarget('single_user');
 setNotificationMsg(null);
 }}
 >
 User Tertentu
 </button>
 </div>
 </div>

 {notificationTarget === 'single_user' && (
 <div className="admin-form-field">
 <label className="admin-form-label">Pilih User</label>
 <AdminDropdown
 id="notification-recipient"
 value={notificationRecipient}
 placeholder="Pilih user"
 options={recipientOptions}
 onChange={(nextValue) => {
 setNotificationRecipient(nextValue);
 setNotificationMsg(null);
 }}
 disabled={recipientOptions.length === 0}
 />
 </div>
 )}

 <div className="admin-form-field">
 <label className="admin-form-label">Jenis</label>
 <AdminDropdown
 id="notification-kind"
 value={notificationKind}
 placeholder="Pilih jenis"
 options={notificationKindOptions}
 onChange={(nextValue) => {
 setNotificationKind(nextValue as NotificationKind);
 setNotificationMsg(null);
 }}
 />
 </div>

 <div className="admin-form-field">
 <label className="admin-form-label">Judul</label>
 <input
 type="text"
 className="admin-input"
 placeholder="Contoh: Maintenance selesai"
 maxLength={120}
 value={notificationTitle}
 onChange={(e) => {
 setNotificationTitle(e.target.value);
 setNotificationMsg(null);
 }}
 />
 </div>

 <div className="admin-form-field">
 <label className="admin-form-label">Pesan</label>
 <textarea
 className="admin-input"
 placeholder="Tulis isi notifikasi"
 rows={4}
 maxLength={2000}
 value={notificationMessage}
 onChange={(e) => {
 setNotificationMessage(e.target.value);
 setNotificationMsg(null);
 }}
 />
 </div>

 <button
 className="admin-submit-btn"
 onClick={handleSendNotification}
 disabled={isSendingNotification || !notificationTitle.trim() || !notificationMessage.trim()}
 >
 {isSendingNotification ? (
 <><span className="login-spinner" />{' '}Mengirim...</>
 ) : (
 <>Kirim Notifikasi</>
 )}
 </button>

 <div className="admin-form-section-title mt-2">Notifikasi Terkirim</div>
 <div className="flex items-center justify-end">
 <button
 type="button"
 className="btn btn-secondary btn-action admin-target-btn"
 onClick={() => loadSentNotifications()}
 disabled={isLoadingSentNotifications}
 >
 {isLoadingSentNotifications ? 'Memuat...' : 'Refresh'}
 </button>
 </div>

 <div className="admin-sent-notification-frame">
 {isLoadingSentNotifications && sentNotifications.length === 0 ? (
 <div className="admin-empty-state py-6 admin-empty-state-fixed">
 <span className="login-spinner" />
 <p>Memuat notifikasi terkirim...</p>
 </div>
 ) : sentNotifications.length === 0 ? (
 <div className="admin-empty-state py-6 admin-empty-state-fixed">
 <span className="material-symbols-outlined admin-empty-icon">notifications_off</span>
 <p>Belum ada notifikasi terkirim.</p>
 </div>
 ) : (
 <div 
 className="admin-sent-notification-list"
 style={{ 
 opacity: isLoadingSentNotifications ? 0.5 : 1, 
 pointerEvents: isLoadingSentNotifications ? 'none' : 'auto', 
 transition: 'opacity 0.2s' 
 }}
 >
 {sentNotifications.map((item) => (
 <div key={item.dispatchId} className="admin-sent-notification-card">
 <div className="admin-sent-notification-head">
 <div className="admin-sent-notification-title-wrap">
 <span className={`admin-kind-badge kind-${item.kind}`}>{item.kind}</span>
 {editingDispatchId !== item.dispatchId && (
 <h4 className="admin-sent-notification-title">{item.title}</h4>
 )}
 </div>
 <div className="admin-user-actions">
 <button
 className="btn btn-action btn-icon"
 title="Edit notifikasi"
 onClick={() => beginEditNotification(item)}
 >
 <span className="material-symbols-outlined">edit</span>
 </button>
 <button
                          className="btn btn-destructive btn-icon"
                          title="Hapus notifikasi"
                          onClick={() => setConfirmModalConfig({
                            isOpen: true,
                            title: 'Hapus Notifikasi',
                            message: 'Hapus notifikasi ini untuk semua penerima?',
                            confirmText: 'Ya, Hapus',
                            onConfirm: async () => {
                              await handleDeleteNotification(item.dispatchId);
                            }
                          })}
                        >
 <span className="material-symbols-outlined">delete</span>
 </button>
 </div>
 </div>
 {editingDispatchId !== item.dispatchId && (
 <p className="admin-sent-notification-message">{item.message}</p>
 )}
 <div className="admin-sent-notification-meta">
 <span>Dikirim: {formatDate(item.createdAt)}</span>
 <span>Penerima: {item.recipientCount}</span>
 <span>Sudah baca: {item.readCount}</span>
 <span>Belum baca: {item.unreadCount}</span>
 </div>

 {editingDispatchId === item.dispatchId && (
 <div className="admin-notification-edit-wrap mt-2">
 <div className="admin-form-field">
 <label className="admin-form-label">Edit Jenis</label>
 <AdminDropdown
 id={`edit-notification-kind-${item.dispatchId}`}
 value={editKind}
 placeholder="Pilih jenis"
 options={notificationKindOptions}
 onChange={(nextValue) => setEditKind(nextValue as NotificationKind)}
 />
 </div>
 <div className="admin-form-field">
 <label className="admin-form-label">Edit Judul</label>
 <input
 type="text"
 className="admin-input"
 maxLength={120}
 value={editTitle}
 onChange={(e) => setEditTitle(e.target.value)}
 />
 </div>
 <div className="admin-form-field">
 <label className="admin-form-label">Edit Pesan</label>
 <textarea
 className="admin-input"
 rows={4}
 maxLength={2000}
 value={editMessage}
 onChange={(e) => setEditMessage(e.target.value)}
 />
 </div>
 <div className="admin-inline-row">
 <button
 type="button"
 className="admin-inline-btn confirm"
 onClick={handleSaveEditedNotification}
 disabled={isSavingEdit}
 >
 {isSavingEdit ? 'Menyimpan...' : 'Simpan'}
 </button>
 <button
 type="button"
 className="admin-inline-btn cancel"
 onClick={() => {
 setEditingDispatchId(null);
 setEditTitle('');
 setEditMessage('');
 }}
 >
 Batal
 </button>
 </div>
 </div>
 )}

 
 </div>
 ))}
 </div>
 )}
 </div>

 <div className="admin-message-slot">
 {notificationMsg ? (
 <div className={`admin-message ${notificationMsg.type}`}>
 <span className="material-symbols-outlined">
 {notificationMsg.type === 'success' ? 'check_circle' : 'error'}
 </span>
 {notificationMsg.text}
 </div>
 ) : (
 <div className="admin-message-placeholder" aria-hidden="true" />
 )}
 </div>
 </div>
 )}
 {/* ===== TAB: ERRORS ===== */}
 {activeTab === 'errors' && (
 <div className="admin-users-list">
 <div className="flex items-center justify-between mb-4 mt-2">
 <div className="admin-form-section-title" style={{ margin: 0 }}>Riwayat Error Aplikasi</div>
 <div className="flex gap-2">
 <button
 type="button"
 className="btn btn-secondary btn-action admin-target-btn flex items-center gap-1.5"
 onClick={() => loadErrorLogs()}
 disabled={isLoadingErrorLogs || isClearingErrorLogs}
 >
 {isLoadingErrorLogs ? 'Memuat...' : 'Refresh'}
 </button>
 {errorLogs.length > 0 && (
 <button
 type="button"
 className="btn btn-destructive btn-action admin-target-btn flex items-center gap-1.5"
 onClick={clearAllErrorLogs}
 disabled={isLoadingErrorLogs || isClearingErrorLogs}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>delete_sweep</span>
 {isClearingErrorLogs ? 'Menghapus...' : 'Clear All'}
 </button>
 )}
 </div>
 </div>

 {isLoadingErrorLogs && errorLogs.length === 0 ? (
 <div className="admin-empty-state">
 <span className="login-spinner" />
 <p>Memuat error logs...</p>
 </div>
 ) : errorLogs.length === 0 ? (
 <div className="admin-empty-state">
 <span className="material-symbols-outlined admin-empty-icon">check_circle</span>
 <p>Belum ada error log yang tercatat.</p>
 </div>
 ) : (
 <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', opacity: isLoadingErrorLogs ? 0.5 : 1, pointerEvents: isLoadingErrorLogs ? 'none' : 'auto', transition: 'opacity 0.2s' }}>
 {errorLogs.map(log => (
 <div key={log.id} className="admin-user-card admin-error-log-card" style={{ cursor: 'default' }}>
 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
 <h4 className="results-prompt-text admin-error-log-message" style={{ margin: 0, fontWeight: 400, letterSpacing: 0, wordBreak: 'break-word', paddingRight: '1rem' }}>
 {log.errorMessage}
 </h4>
 <div className="flex items-center gap-2 flex-shrink-0">
 <span className="admin-kind-badge kind-error">
 {log.occurrences}x
 </span>
 <button
 type="button"
 className="btn btn-action btn-icon"
 onClick={() => copyErrorLog(log.id, log.errorMessage)}
 title={copiedErrorLogId === log.id ? 'Tersalin' : 'Salin error penuh'}
 aria-label={copiedErrorLogId === log.id ? 'Error tersalin' : 'Salin error penuh'}
 style={{ minWidth: '30px', minHeight: '30px', padding: 0 }}
 >
 <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
 {copiedErrorLogId === log.id ? 'done' : 'content_copy'}
 </span>
 </button>
 <button
 type="button"
 className="btn btn-destructive btn-icon btn-action"
 onClick={() => deleteIndividualErrorLog(log.id)}
 disabled={deletingErrorLogId === log.id}
 title="Hapus log ini"
 style={{ minWidth: '30px', minHeight: '30px', padding: 0 }}
 >
 {deletingErrorLogId === log.id ? (
 <span className="login-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
 ) : (
 <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>delete</span>
 )}
 </button>
 </div>
 </div>
 
 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem' }}>
 <span className="admin-user-badge role-user">User: {log.username}</span>
 {log.aiModel && (
 <>
 <span className="admin-user-badge role-admin">Provider: {MODEL_PROVIDER_LABELS[getModelProvider(log.aiModel as ApiModel)]}</span>
 <span className="admin-user-badge role-admin">Model: {log.aiModel}</span>
 </>
 )}
 {log.promptStyle && (
 <span className="admin-user-badge role-admin">Style: {log.promptStyle}</span>
 )}
 {log.origin && (
 <span className={`admin-user-badge ${log.origin.toLowerCase() === 'web' ? 'active' : 'inactive'}`}>
 {log.origin.toLowerCase() === 'web' ? 'Web' : 'Ekstensi'}
 </span>
 )}
 </div>
 
 <div style={{ fontSize: '0.7rem', color: '#6B7280', display: 'flex', justifyContent: 'space-between' }}>
 <span>Pertama: {formatDate(log.firstSeenAt)}</span>
 <span>Terakhir: {formatDate(log.lastSeenAt)}</span>
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 )}
 </div>

 {confirmModalConfig && (
 <AdminConfirmModal
 isOpen={confirmModalConfig.isOpen}
 onClose={() => setConfirmModalConfig(prev => prev ? { ...prev, isOpen: false } : null)}
 onConfirm={confirmModalConfig.onConfirm}
 title={confirmModalConfig.title}
 message={confirmModalConfig.message}
 confirmText={confirmModalConfig.confirmText}
 />
 )}

 <style>{`
 /* === Container === */
 .admin-panel-container {
 width: 100%;
 max-width: min(900px, calc(100vw - 2rem));
 margin: 0 auto;
 margin-top: 1rem;
 display: flex;
 flex-direction: column;
 padding: 0 1rem;
 }
 @media (min-width: 768px) {
 .admin-panel-container {
 padding: 0;
 }
 }
 body.theme-light .admin-panel-container {
 background: transparent;
 border: none;
 box-shadow: none;
 }
 body.theme-dark .admin-panel-container {
 background: transparent;
 border: none;
 box-shadow: none;
 }

 /* === Header === */
 .admin-panel-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 padding: 0.5rem 0 1.25rem 0;
 border-bottom: none;
 flex-shrink: 0;
 }
 
 

 .admin-panel-header-left { display: flex; align-items: center; gap: 0.75rem; }
 .admin-panel-icon-ring {
 width: 40px; height: 40px;
 border-radius: 0.625rem;
 display: flex;
 align-items: center;
 justify-content: center;
 flex-shrink: 0;
 }
 body.theme-light .admin-panel-icon-ring {
 background: linear-gradient(135deg, #6366F1, #8B5CF6);
 }
 body.theme-dark .admin-panel-icon-ring {
 background: linear-gradient(135deg, #818CF8, #A78BFA);
 }
 .admin-panel-icon-ring .material-symbols-outlined {
 color: white; font-size: 1.25rem !important;
 font-variation-settings: 'FILL' 1;
 }
 .admin-panel-title {
 font-size: 1rem; font-weight: 700; margin: 0;
 }
 body.theme-light .admin-panel-title { color: #111827; }
 body.theme-dark .admin-panel-title { color: #F0F0F0; }

 .admin-panel-subtitle { font-size: 0.75rem; margin: 0; }
 body.theme-light .admin-panel-subtitle { color: #6B7280; }
 body.theme-dark .admin-panel-subtitle { color: #A9A9A9; }

 .admin-panel-close-btn {
 background: none; border: none; cursor: pointer;
 padding: 0.375rem; border-radius: 0.5rem;
 display: flex; align-items: center; justify-content: center;
 transition: background 0.15s;
 }
 body.theme-light .admin-panel-close-btn:hover { background: #F3F4F6; }
 body.theme-dark .admin-panel-close-btn:hover { background: #333; }
 body.theme-light .admin-panel-close-btn:hover,
 body.theme-dark .admin-panel-close-btn:hover {
 box-shadow: none !important;
 }
 body.theme-light .admin-panel-close-btn .material-symbols-outlined { color: #6B7280; }
 body.theme-dark .admin-panel-close-btn .material-symbols-outlined { color: #A9A9A9; }

 /* === Stats === */
 /* === Stats Banner === */
 .admin-stats-banner {
 display: flex;
 border-radius: 1rem;
 overflow: hidden;
 transition: all 0.3s ease;
 }
 body.theme-light .admin-stats-banner { background: rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.06); }
 body.theme-dark .admin-stats-banner { background: #1d222c; border: 1px solid #2a2f39; }

 .admin-stat-item {
 flex: 1;
 display: flex; flex-direction: column; align-items: center; justify-content: center;
 padding: 0.875rem 0.5rem;
 position: relative;
 }
 .admin-stat-item:not(:last-child)::after {
 content: ''; position: absolute; right: 0; top: 25%; bottom: 25%; width: 1px;
 }
 body.theme-light .admin-stat-item:not(:last-child)::after { background: rgba(0,0,0,0.1); }
 body.theme-dark .admin-stat-item:not(:last-child)::after { background: rgba(255,255,255,0.1); }

 .admin-stat-header {
 display: flex; align-items: center; gap: 0.375rem;
 font-size: 0.65rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
 margin-bottom: 0.25rem;
 opacity: 0.7;
 }
 .admin-stat-header .material-symbols-outlined { font-size: 0.875rem !important; }
 body.theme-light .admin-stat-header { color: #4B5563; }
 body.theme-dark .admin-stat-header { color: #9CA3AF; }
 
 .stat-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
 
 .stat-active { opacity: 1; }
 body.theme-light .stat-active { color: #059669; }
 body.theme-dark .stat-active { color: #34D399; }

 .stat-inactive { opacity: 1; }
 body.theme-light .stat-inactive { color: #E11D48; }
 body.theme-dark .stat-inactive { color: #FB7185; }

 .admin-stat-value {
 font-size: 1.5rem; font-weight: 900; line-height: 1;
 }
 body.theme-light .admin-stat-value { color: #111827; }
 body.theme-dark .admin-stat-value { color: #F9FAFB; }

 /* === Tabs removed in favor of global input-mode-selector === */

 /* === Content === */
 .admin-panel-content {
 flex: 1;
 overflow-y: auto;
 padding: 1rem 0;
 display: flex;
 flex-direction: column;
 }

 /* === Users List === */
 .admin-users-list { display: flex; flex-direction: column; gap: 0.75rem; }
 .admin-empty-state {
 display: flex; flex-direction: column; align-items: center;
 padding: 2.5rem 1rem; text-align: center; gap: 0.75rem;
 }
 .admin-empty-icon { font-size: 2.5rem !important; }
 body.theme-light .admin-empty-state { color: #9CA3AF; }
 body.theme-dark .admin-empty-state { color: #6F6F6F; }

 .admin-user-card {
 border-radius: 0.75rem;
 border: 1px solid;
 padding: 0.875rem;
 display: flex;
 flex-direction: column;
 gap: 0.75rem;
 transition: opacity 0.2s;
 }
 .admin-user-card-header {
 display: flex;
 align-items: center;
 justify-content: space-between;
 width: 100%;
 gap: 0.75rem;
 }
 .admin-user-card-header > :first-child {
 display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0;
 }

 body.theme-light .admin-user-card { background: #F9FAFB; border-color: #E5E7EB; }
 body.theme-dark .admin-user-card { background: #1d222c; border-color: #2a2f39; }

 .admin-error-log-card {
 height: 154px;
 overflow: hidden;
 justify-content: space-between;
 gap: 8px;
 }
 .admin-error-log-message {
 display: -webkit-box;
 -webkit-line-clamp: 3;
 -webkit-box-orient: vertical;
 overflow: hidden;
 flex: 1;
 min-width: 0;
 }

 .admin-user-info { display: flex; align-items: center; gap: 0.75rem; flex: 1; min-width: 0; }
 .admin-user-avatar {
 width: 36px; height: 36px;
 border-radius: 50%;
 display: flex; align-items: center; justify-content: center;
 font-weight: 800; font-size: 0.875rem;
 flex-shrink: 0;
 }
 body.theme-light .admin-user-avatar { background: linear-gradient(135deg,#6366F1,#8B5CF6); color: #fff; }
 body.theme-dark .admin-user-avatar { background: linear-gradient(135deg,#818CF8,#A78BFA); color: #fff; }

 .admin-user-details { display: flex; flex-direction: column; gap: 0.125rem; min-width: 0; }
 .admin-user-name { font-weight: 700; font-size: 0.875rem; }
 body.theme-light .admin-user-name { color: #111827; }
 body.theme-dark .admin-user-name { color: #F0F0F0; }

 .admin-user-meta { font-size: 0.6875rem; }
 body.theme-light .admin-user-meta { color: #9CA3AF; }
 body.theme-dark .admin-user-meta { color: #6F6F6F; }

 .admin-user-badge {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 height: 18px;
 padding: 0 6px;
 border-radius: 9px;
 font-size: 0.55rem;
 font-weight: 600;
 text-transform: capitalize;
 letter-spacing: 0.05em;
 line-height: normal; /* Normal line-height helps flexbox center perfectly */
 border: 1px solid transparent;
 box-sizing: border-box;
 }
 .admin-user-badge.active { background: #D1FAE5; color: #065F46; }
 .admin-user-badge.inactive { background: #FEE2E2; color: #991B1B; }
 body.theme-dark .admin-user-badge.active { background: #064E3B; color: #6EE7B7; }
 body.theme-dark .admin-user-badge.inactive { background: #450A0A; color: #FCA5A5; }
 
 .admin-user-badge.role-superadmin { background: #818CF8; color: #FFF; }
 .admin-user-badge.role-admin { background: #6366F1; color: #FFF; }
 .admin-user-badge.role-user { background: transparent; color: inherit; border-color: #E5E7EB; }
 
 body.theme-dark .admin-user-badge.role-superadmin { background: #6366F1; color: #FFF; }
 body.theme-dark .admin-user-badge.role-admin { background: #4F46E5; color: #FFF; }
 body.theme-dark .admin-user-badge.role-user { border-color: #4B5563; color: #D1D5DB; }

 .admin-user-actions { display: flex; gap: 0.375rem; margin-left: auto; flex-shrink: 0; align-items: center; }
 .admin-user-actions .btn.btn-icon {
 width: 32px !important;
 height: 32px !important;
 min-width: 32px !important;
 min-height: 32px !important;
 padding: 0 !important;
 display: flex !important;
 align-items: center !important;
 justify-content: center !important;
 }
 .admin-user-actions .btn-action.btn-icon,
 .admin-user-actions .btn-destructive.btn-icon {
 width: 30px !important;
 height: 30px !important;
 min-width: 30px !important;
 min-height: 30px !important;
 }

 .admin-target-btn {
 font-size: 13px !important;
 padding-top: 6px !important;
 padding-bottom: 6px !important;
 }



 /* === Inline form (reset password / delete confirm) === */
 .admin-inline-form {
 width: 100%;
 padding: 0.75rem;
 border-radius: 0.625rem;
 }
 body.theme-light .admin-inline-form { background: #F0F0FF; border: 1px solid #C7D2FE; }
 body.theme-dark .admin-inline-form { background: #1a1a2e; border: 1px solid #3730A3; }
 body.theme-light .admin-inline-form.danger { background: #FFF1F2; border-color: #FECDD3; }
 body.theme-dark .admin-inline-form.danger { background: #2d0a0a; border-color: #5C2B2B; }

 .admin-inline-label { font-size: 0.8125rem; margin: 0 0 0.5rem 0; }
 body.theme-light .admin-inline-label { color: #374151; }
 body.theme-dark .admin-inline-label { color: #D1D5DB; }

 .admin-inline-row { display: flex; gap: 0.5rem; align-items: stretch; }
 .admin-inline-row .admin-input {
 padding: 0.375rem 0.625rem;
 padding-right: 2rem;
 font-size: 0.75rem;
 border-radius: 0.5rem;
 }
 .admin-inline-row .admin-pwd-toggle {
 right: 0.375rem;
 }
 .admin-inline-row .admin-pwd-toggle .material-symbols-outlined {
 font-size: 0.875rem !important;
 }
 .admin-notification-edit-wrap {
 display: flex;
 flex-direction: column;
 gap: 0.875rem;
 padding: 0.5rem;
 }
 
 .admin-inline-btn {
 height: 32px;
 min-height: 32px;
 padding: 5px 0.625rem 7px 0.625rem;
 border-radius: 0.5rem;
 border: 1.5px solid transparent; cursor: pointer;
 font-size: 0.75rem; font-weight: 600;
 display: flex; align-items: center; justify-content: center; gap: 0.25rem;
 transition: all 0.15s;
 font-family: 'Manrope', sans-serif;
 flex-shrink: 0;
 }
 .admin-delete-confirm-row {
 align-items: center;
 }
 .admin-delete-confirm-row .admin-inline-btn {
 width: 82px;
 height: 32px !important;
 min-height: 32px !important;
 padding: 0 !important;
 border-radius: 0.55rem !important;
 font-size: 0.75rem !important;
 font-weight: 650 !important;
 line-height: 1 !important;
 box-sizing: border-box !important;
 }
 .admin-inline-btn .material-symbols-outlined { font-size: 0.9375rem !important; }
 .admin-inline-btn.confirm { background: #6366F1; color: #fff; background-clip: padding-box !important; }
 .admin-inline-btn.confirm:hover:not(:disabled) { background: #4F46E5; }
 body.theme-light .admin-inline-btn:hover:not(:disabled) {
 box-shadow: none !important;
 }
 body.theme-dark .admin-inline-btn:hover:not(:disabled) {
 box-shadow: none !important;
 }
 .admin-inline-btn.confirm:disabled { opacity: 1 !important; filter: none !important; cursor: not-allowed; }
 body.theme-light .admin-inline-btn.confirm-delete {
 background: var(--button-destructive-bg-light);
 color: var(--button-destructive-text-light);
 }
 body.theme-dark .admin-inline-btn.confirm-delete {
 background: var(--button-destructive-bg-dark);
 color: var(--button-destructive-text-dark);
 }
 body.theme-light .admin-inline-btn.confirm-delete:hover {
 background: var(--button-destructive-hover-bg-light);
 }
 body.theme-dark .admin-inline-btn.confirm-delete:hover {
 background: var(--button-destructive-hover-bg-dark);
 }
 .admin-inline-btn.cancel { background: transparent; color: inherit; border: 1.5px solid; }
 body.theme-light .admin-inline-btn.cancel { border-color: #D1D5DB; color: #6B7280; }
 body.theme-dark .admin-inline-btn.cancel { border-color: #3D3D3D; color: #A9A9A9; }
 .admin-inline-success { font-size: 0.75rem; color: #16a34a; margin: 0.375rem 0 0; font-weight: 600; }

 /* === Create Form === */
 .admin-create-form { display: flex; flex-direction: column; gap: 1rem; }
 .admin-sent-notification-list {
 display: flex;
 flex-direction: column;
 gap: 0.75rem;
 animation: none !important;
 transition: none !important;
 }
 .admin-sent-notification-frame {
 min-height: 280px;
 overflow: visible;
 }
 .admin-sent-notification-frame,
 .admin-sent-notification-frame * {
 transition: none !important;
 animation: none !important;
 }
 .admin-empty-state-fixed {
 min-height: 240px;
 justify-content: center;
 }
 .admin-sent-notification-card {
 border: 1px solid;
 border-radius: 0.75rem;
 padding: 1.25rem;
 display: flex;
 flex-direction: column;
 gap: 0.5rem;
 opacity: 1 !important;
 transform: none !important;
 animation-name: none !important;
 animation-fill-mode: none !important;
 animation-delay: 0ms !important;
 animation-duration: 0ms !important;
 transition-property: none !important;
 transition-delay: 0ms !important;
 transition-duration: 0ms !important;
 transition: none !important;
 animation: none !important;
 }
 body.theme-light .admin-sent-notification-card {
 background: #f9fafb;
 border-color: #e5e7eb;
 }
 body.theme-dark .admin-sent-notification-card {
 background: #1d222c;
 border-color: #2a2f39;
 }
 .admin-sent-notification-head {
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 0.5rem;
 }
 .admin-sent-notification-title-wrap {
 display: flex;
 align-items: center;
 gap: 0.5rem;
 min-width: 0;
 }
 .admin-sent-notification-title {
 margin: 0;
 font-size: 0.875rem;
 font-weight: 700;
 white-space: nowrap;
 overflow: hidden;
 text-overflow: ellipsis;
 }
 body.theme-light .admin-sent-notification-title { color: #111827; }
 body.theme-dark .admin-sent-notification-title { color: #f3f4f6; }
 .admin-sent-notification-message {
 margin: 1rem 0;
 font-size: 0.8125rem;
 white-space: pre-wrap;
 word-break: break-word;
 }
 body.theme-light .admin-sent-notification-message { color: #374151; }
 body.theme-dark .admin-sent-notification-message { color: #d1d5db; }
 .admin-sent-notification-meta {
 display: flex;
 flex-wrap: wrap;
 gap: 0.375rem 0.75rem;
 font-size: 0.6875rem;
 }
 body.theme-light .admin-sent-notification-meta { color: #6b7280; }
 body.theme-dark .admin-sent-notification-meta { color: #9ca3af; }
 .admin-kind-badge {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 border-radius: 999px;
 padding: 0 0.5rem;
 height: 20px;
 font-size: 0.625rem;
 font-weight: 700;
 text-transform: uppercase;
 letter-spacing: 0.05em;
 border: 1px solid transparent;
 }
 .admin-kind-badge.kind-info { background: #dbeafe; color: #1e40af; border-color: #bfdbfe; }
 .admin-kind-badge.kind-success { background: #d1fae5; color: #065f46; border-color: #a7f3d0; }
 .admin-kind-badge.kind-warning { background: #fef3c7; color: #92400e; border-color: #fde68a; }
 .admin-kind-badge.kind-error { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
 body.theme-dark .admin-kind-badge.kind-info { background: #1e3a8a; color: #bfdbfe; border-color: #1d4ed8; }
 body.theme-dark .admin-kind-badge.kind-success { background: #064e3b; color: #6ee7b7; border-color: #065f46; }
 body.theme-dark .admin-kind-badge.kind-warning { background: #78350f; color: #fde68a; border-color: #92400e; }
 body.theme-dark .admin-kind-badge.kind-error { background: #450a0a; color: #fca5a5; border-color: #7f1d1d; }
 .admin-form-field { display: flex; flex-direction: column; gap: 0.375rem; }
 .admin-form-label {
 display: flex; align-items: center; gap: 0.375rem;
 font-size: 0.8125rem; font-weight: 600;
 margin-left: 0.25rem; /* Nudge slightly to the right */
 }
 body.theme-light .admin-form-label { color: #374151; }
 body.theme-dark .admin-form-label { color: #D1D5DB; }

 .admin-form-section-title {
 font-size: 0.8125rem; font-weight: 700;
 padding-bottom: 0.5rem; border-bottom: 1px solid;
 }
 body.theme-light .admin-form-section-title { color: #374151; border-color: #E5E7EB; }
 body.theme-dark .admin-form-section-title { color: #D1D5DB; border-color: #2C2C2C; }

 /* === Input === */
 .admin-input-wrapper { position: relative; }
 .admin-input-wrapper .admin-input { padding-right: 2.5rem; }
 select.admin-select-global-arrow {
 appearance: none;
 -webkit-appearance: none;
 -moz-appearance: none;
 background-repeat: no-repeat;
 background-position: calc(100% - 0.95rem) center;
 background-size: 1rem 1rem;
 padding-right: 2.8rem !important;
 cursor: pointer;
 }
 select.admin-select-global-arrow::-ms-expand {
 display: none;
 }
 body.theme-light select.admin-select-global-arrow {
 background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%236b7280' viewBox='0 0 24 24'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e");
 }
 body.theme-dark select.admin-select-global-arrow {
 background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23A9A9A9' viewBox='0 0 24 24'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e");
 }
 .admin-input {
 width: 100%; box-sizing: border-box;
 padding: 0.625rem 0.875rem;
 border-radius: 0.625rem;
 font-size: 0.875rem;
 font-family: 'Manrope', sans-serif;
 border: 1.5px solid;
 outline: none;
 transition: all 0.2s;
 }
 textarea.admin-input {
 resize: none;
 overflow-y: auto;
 }
 .admin-dropdown-trigger {
 min-height: 42px;
 display: flex;
 align-items: center;
 justify-content: space-between;
 gap: 0.75rem;
 text-align: left;
 cursor: pointer;
 }
 .admin-dropdown-trigger:disabled {
 cursor: not-allowed;
 opacity: 0.55;
 }
 .admin-dropdown-placeholder {
 color: #9CA3AF;
 }
 body.theme-dark .admin-dropdown-placeholder {
 color: #64748B;
 }
 .admin-dropdown-arrow {
 width: 1rem;
 height: 1rem;
 flex-shrink: 0;
 color: currentColor;
 opacity: 0.82;
 transition: transform 180ms ease-out;
 }
 .admin-dropdown-arrow.is-open {
 transform: rotate(180deg);
 }
 .admin-dropdown-menu {
 min-width: 180px;
 }
 body.theme-light .admin-input { background: #F9FAFB; border-color: #D1D5DB; color: #111827; }
 body.theme-light .admin-input::placeholder { color: #9CA3AF; }
 body.theme-light .admin-input:focus { border-color: #6366F1; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); background: #fff; }
 body.theme-dark .admin-input { background: #1d222c; border-color: #2a2f39; color: #F3F4F6; }
 body.theme-dark .admin-input::placeholder { color: #64748B; }
 body.theme-dark .admin-input:focus { background: #1d222c; border-color: #334155; box-shadow: none; }
 body.theme-light select.admin-select-global-arrow.admin-input {
 background-color: #F9FAFB !important;
 border-color: #D1D5DB !important;
 background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%236b7280' viewBox='0 0 24 24'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e") !important;
 background-repeat: no-repeat !important;
 background-position: calc(100% - 0.95rem) center !important;
 background-size: 1rem 1rem !important;
 }
 body.theme-light select.admin-select-global-arrow.admin-input:focus {
 background-color: #F9FAFB !important;
 border-color: #D1D5DB !important;
 box-shadow: none !important;
 }
 body.theme-light select.admin-select-global-arrow.admin-input option {
 background: #F9FAFB;
 color: #111827;
 }
 body.theme-dark select.admin-select-global-arrow.admin-input {
 background-color: #1d222c !important;
 border-color: #2a2f39 !important;
 color: #F3F4F6 !important;
 background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' stroke='%23CBD5E1' viewBox='0 0 24 24'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e") !important;
 background-repeat: no-repeat !important;
 background-position: calc(100% - 0.95rem) center !important;
 background-size: 1rem 1rem !important;
 }
 body.theme-dark select.admin-select-global-arrow.admin-input:focus {
 background-color: #1d222c !important;
 border-color: #334155 !important;
 box-shadow: none !important;
 }
 body.theme-dark select.admin-select-global-arrow.admin-input option {
 background: #1d222c;
 color: #F3F4F6;
 }
 .role-selector-trigger {
 border-radius: 0.625rem !important;
 padding-right: 0.875rem !important;
 }
 .role-selector-trigger svg {
 color: #6b7280;
 }
 body.theme-light .role-selector-trigger {
 background: #F9FAFB !important;
 border-color: #D1D5DB !important;
 color: #111827 !important;
 box-shadow: none !important;
 }
 body.theme-light .role-selector-trigger:hover,
 body.theme-light .role-selector-trigger:focus,
 body.theme-light .role-selector-trigger:focus-visible,
 body.theme-light .role-selector-trigger[aria-expanded="true"] {
 background: #F9FAFB !important;
 border-color: #D1D5DB !important;
 box-shadow: none !important;
 }
 body.theme-dark .role-selector-trigger {
 background: #1d222c !important;
 border-color: #2a2f39 !important;
 color: #F3F4F6 !important;
 box-shadow: none !important;
 }
 body.theme-dark .role-selector-trigger svg {
 color: #CBD5E1 !important;
 }
 body.theme-dark .role-selector-trigger:hover,
 body.theme-dark .role-selector-trigger:focus,
 body.theme-dark .role-selector-trigger:focus-visible,
 body.theme-dark .role-selector-trigger[aria-expanded="true"] {
 background: #1d222c !important;
 border-color: #2a2f39 !important;
 box-shadow: none !important;
 }
 body.theme-light .role-selector-menu {
 background: #F9FAFB !important;
 border-color: #D1D5DB !important;
 }
 body.theme-dark .role-selector-menu {
 background: #151a21 !important;
 border-color: #2a2f39 !important;
 box-shadow: 0 14px 34px rgba(0, 0, 0, 0.42) !important;
 }
 .role-selector-item {
 border-radius: 0.5rem !important;
 }
 body.theme-dark .role-selector-item:not(.active) {
 color: #F3F4F6 !important;
 }
 body.theme-dark .role-selector-item:hover:not(.active) {
 background: #232d3d !important;
 }
 body.theme-dark .role-selector-item.active {
 background: #2b3952 !important;
 color: #F3F4F6 !important;
 }

 .admin-pwd-toggle {
 position: absolute; right: 0.625rem; top: 50%;
 transform: translateY(-50%);
 background: none; border: none; cursor: pointer;
 padding: 0.25rem; border-radius: 0.375rem;
 display: flex; align-items: center;
 transition: opacity 0.2s;
 }
 .admin-pwd-toggle:hover { opacity: 0.7; }
 .admin-pwd-toggle .material-symbols-outlined { font-size: 1rem !important; }
 body.theme-light .admin-pwd-toggle .material-symbols-outlined { color: #9CA3AF; }
 body.theme-dark .admin-pwd-toggle .material-symbols-outlined { color: #6F6F6F; }

 /* === Messages === */
 .admin-message {
 display: flex; align-items: center; gap: 0.5rem;
 padding: 0.625rem 0.875rem;
 border-radius: 0.625rem;
 font-size: 0.8125rem; font-weight: 500;
 }
 .admin-message-slot {
 min-height: 44px;
 display: flex;
 align-items: stretch;
 }
 .admin-message-placeholder {
 width: 100%;
 border-radius: 0.625rem;
 }
 .admin-message .material-symbols-outlined { font-size: 1rem !important; flex-shrink: 0; }
 .admin-message.success { background: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; }
 .admin-message.error { background: #FEE2E2; color: #B91C1C; border: 1px solid #FCA5A5; }
 body.theme-dark .admin-message.success { background: #064E3B; color: #6EE7B7; border-color: #065F46; }
 body.theme-dark .admin-message.error { background: #450A0A; color: #FCA5A5; border-color: #5C2B2B; }

 /* === Submit Button === */
 .admin-submit-btn {
 display: flex; align-items: center; justify-content: center; gap: 0.5rem;
 width: 100%; padding: 11px 0.75rem 13px 0.75rem;
 border-radius: 0.75rem; border: none;
 font-family: 'Manrope', sans-serif;
 font-size: 0.9375rem; font-weight: 700;
 cursor: pointer; transition: all 0.2s;
 margin-top: 0.25rem;
 }
 .admin-submit-btn:disabled { opacity: 1 !important; filter: none !important; cursor: not-allowed; }
 .admin-submit-btn .material-symbols-outlined { font-size: 1.125rem !important; }
 body.theme-light .admin-submit-btn { background: #6366F1; color: #fff; }
 body.theme-light .admin-submit-btn:hover:not(:disabled) { background: #4F46E5; transform: none; box-shadow: none !important; }
 body.theme-dark .admin-submit-btn { background: #6366F1; color: #fff; }
 body.theme-dark .admin-submit-btn:hover:not(:disabled) { background: #4F46E5; transform: none; box-shadow: none !important; }

 /* === Settings Info === */
 .admin-settings-info {
 display: flex; align-items: center; gap: 1rem;
 padding: 1rem;
 border-radius: 0.75rem;
 }
 body.theme-light .admin-settings-info { background: #F9FAFB; border: 1px solid #E5E7EB; }
 body.theme-dark .admin-settings-info { background: #1d222c; border: 1px solid #2a2f39; }

 .admin-settings-avatar-icon { font-size: 2.5rem !important; }
 body.theme-light .admin-settings-avatar-icon { color: #6366F1; }
 body.theme-dark .admin-settings-avatar-icon { color: #818CF8; }

 .admin-settings-username { font-size: 1rem; font-weight: 700; margin: 0; }
 body.theme-light .admin-settings-username { color: #111827; }
 body.theme-dark .admin-settings-username { color: #F0F0F0; }

 .admin-settings-role { font-size: 0.75rem; margin: 0.125rem 0 0; }
 body.theme-light .admin-settings-role { color: #6B7280; }
 body.theme-dark .admin-settings-role { color: #A9A9A9; }

 /* === Editorial AI admin alignment === */
 body.theme-dark .admin-panel-header,
 body.theme-dark .admin-form-section-title {
 border-color: var(--border-muted, #18202a) !important;
 }
 body.theme-dark .admin-stats-banner,
 body.theme-dark .admin-user-card,
 body.theme-dark .admin-sent-notification-card,
 body.theme-dark .admin-settings-info {
 background: var(--surface-panel-2, #131a24) !important;
 border-color: var(--border-soft, #222b38) !important;
 }
 body.theme-dark .admin-input,
 body.theme-dark .role-selector-trigger,
 body.theme-dark select.admin-select-global-arrow.admin-input {
 background: var(--surface-panel-2, #131a24) !important;
 border-color: var(--border-soft, #222b38) !important;
 color: var(--text-main, #f6f3ea) !important;
 box-shadow: none !important;
 }
 body.theme-dark .admin-input:focus,
 body.theme-dark .role-selector-trigger:focus,
 body.theme-dark select.admin-select-global-arrow.admin-input:focus {
 border-color: var(--surface-raised-2, #1e2836) !important;
 box-shadow: none !important;
 }
 body.theme-dark .admin-form-label,
 body.theme-dark .admin-form-section-title,
 body.theme-dark .admin-panel-title,
 body.theme-dark .admin-user-name,
 body.theme-dark .admin-settings-username,
 body.theme-dark .admin-sent-notification-title {
 color: var(--text-strong, #fffaf0) !important;
 }
 body.theme-dark .admin-panel-subtitle,
 body.theme-dark .admin-user-meta,
 body.theme-dark .admin-settings-role,
 body.theme-dark .admin-sent-notification-meta,
 body.theme-dark .admin-sent-notification-message {
 color: var(--text-muted, #9aa4b2) !important;
 }
 body.theme-dark .admin-submit-btn {
 background: linear-gradient(135deg, rgba(141,156,255,1), rgba(92,111,255,1)) !important;
 border: 1px solid rgba(199, 210, 254, 0.2) !important;
 border-radius: 16px !important;
 box-shadow: none !important;
 }
 body.theme-dark .admin-submit-btn:hover:not(:disabled) {
 background: linear-gradient(135deg, rgba(175,185,255,1), rgba(130,145,255,1)) !important;
 transform: none;
 }
 body.theme-dark .admin-inline-btn,
 body.theme-dark .admin-user-actions .btn {
 border-radius: 12px !important;
 border-color: var(--border-soft, #222b38) !important;
 box-shadow: none !important;
 font-weight: 650 !important;
 letter-spacing: -0.015em !important;
 }
 body.theme-dark .admin-user-actions .btn {
 box-shadow: none !important;
 }
 body.theme-light .admin-user-actions .btn:hover:not(:disabled) {
 box-shadow: none !important;
 }
 body.theme-dark .admin-user-actions .btn:hover:not(:disabled) {
 box-shadow: none !important;
 }
 body.theme-dark .admin-inline-btn.confirm,
 body.theme-dark .admin-user-actions .btn-action {
 background: linear-gradient(135deg, rgba(141,156,255,1), rgba(92,111,255,1)) !important;
 color: #ffffff !important;
 border-color: rgba(199, 210, 254, 0.24) !important;
 }
 body.theme-dark .admin-inline-btn.cancel,
 body.theme-dark .admin-user-actions .btn-secondary {
 background: var(--surface-raised, #18202c) !important;
 color: var(--text-main, #f6f3ea) !important;
 border-color: rgba(255, 255, 255, 0.08) !important;
 }
 body.theme-dark .admin-inline-btn.confirm-delete,
 body.theme-dark .admin-user-actions .btn-destructive {
 background: linear-gradient(135deg, rgba(244, 63, 94, 1), rgba(190, 18, 60, 1)) !important;
 color: #fff5f7 !important;
 border-color: rgba(251, 113, 133, 0.26) !important;
 }
 .admin-panel-container .admin-user-actions .btn.btn-icon {
 transition: background-color 160ms ease-out, border-color 160ms ease-out, color 160ms ease-out, box-shadow 160ms ease-out !important;
 }

 .admin-panel-container button,
 .admin-panel-container button *,
 .admin-panel-container button::before,
 .admin-panel-container button::after,
 .admin-panel-container button:hover,
 .admin-panel-container button:hover *,
 .admin-panel-container button:hover::before,
 .admin-panel-container button:hover::after,
 .admin-panel-container button:focus,
 .admin-panel-container button:focus-visible,
 .admin-panel-container button:active,
 .admin-panel-container .btn,
 .admin-panel-container .btn *,
 .admin-panel-container .btn:hover,
 .admin-panel-container .btn:hover *,
 .admin-panel-container .btn:focus,
 .admin-panel-container .btn:focus-visible,
 .admin-panel-container .btn:active,
 .admin-panel-container .admin-submit-btn,
 .admin-panel-container .admin-submit-btn:hover,
 .admin-panel-container .admin-inline-btn,
 .admin-panel-container .admin-inline-btn:hover,
 .admin-panel-container .admin-panel-close-btn,
 .admin-panel-container .admin-panel-close-btn:hover {
 box-shadow: none !important;
 text-shadow: none !important;
 filter: none !important;
 }
 .admin-panel-container button,
 .admin-panel-container button:hover,
 .admin-panel-container button:focus,
 .admin-panel-container button:focus-visible,
 .admin-panel-container button:active,
 .admin-panel-container .btn,
 .admin-panel-container .btn:hover,
 .admin-panel-container .btn:focus,
 .admin-panel-container .btn:focus-visible,
 .admin-panel-container .btn:active,
 .admin-panel-container .admin-submit-btn,
 .admin-panel-container .admin-submit-btn:hover,
 .admin-panel-container .admin-inline-btn,
 .admin-panel-container .admin-inline-btn:hover,
 .admin-panel-container .admin-panel-close-btn,
 .admin-panel-container .admin-panel-close-btn:hover {
 transform: none !important;
 }
 .admin-panel-container .admin-pwd-toggle,
 .admin-panel-container .admin-pwd-toggle:hover {
 transform: translateY(-50%) !important;
 }
 body.theme-light .admin-panel-container .admin-panel-close-btn:hover {
 background: none !important;
 color: #6B7280 !important;
 }
 body.theme-dark .admin-panel-container .admin-panel-close-btn:hover {
 background: none !important;
 color: #A9A9A9 !important;
 }
 body.theme-light .admin-panel-container .admin-submit-btn:hover:not(:disabled) {
 background: #6366F1 !important;
 color: #fff !important;
 }
 body.theme-dark .admin-panel-container .admin-submit-btn:hover:not(:disabled) {
 background: linear-gradient(135deg, rgba(175,185,255,1), rgba(130,145,255,1)) !important;
 color: #fff !important;
 }

 .admin-panel-container .admin-inline-btn.confirm:hover:not(:disabled) {
 background: #6366F1 !important;
 color: #fff !important;
 }
 body.theme-light .admin-panel-container .admin-inline-btn.confirm-delete:hover:not(:disabled) {
 background: var(--button-destructive-bg-light) !important;
 color: var(--button-destructive-text-light) !important;
 }
 body.theme-dark .admin-panel-container .admin-inline-btn.confirm-delete:hover:not(:disabled) {
 background: var(--button-destructive-bg-dark) !important;
 color: var(--button-destructive-text-dark) !important;
 }
 body.theme-dark .admin-panel-container .admin-user-actions .btn-action:hover:not(:disabled) {
 background: linear-gradient(135deg, rgba(175,185,255,1), rgba(130,145,255,1)) !important;
 color: #ffffff !important;
 }
 body.theme-dark .admin-inline-btn.cancel:hover:not(:disabled),
 body.theme-dark .admin-user-actions .btn-secondary:hover:not(:disabled) {
 background: linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035)), var(--surface-raised-2, #1e2836) !important;
 color: var(--text-strong, #ffffff) !important;
 border-color: rgba(255,255,255,0.18) !important;
 box-shadow: 0 12px 28px rgba(0,0,0,0.28), 0 0 0 1px rgba(255,255,255,0.06), inset 0 1px 0 rgba(255,255,255,0.12) !important;
 filter: none !important;
 transform: none !important;
 }
 body.theme-dark .admin-panel-container .admin-user-actions .btn-destructive:hover:not(:disabled) {
 background: linear-gradient(135deg, rgba(255, 95, 125, 1), rgba(215, 45, 85, 1)) !important;
 color: #fff5f7 !important;
 }
 .admin-panel-container .admin-delete-confirm-row {
 align-items: center !important;
 gap: 0.5rem !important;
 }
 .admin-panel-container .admin-delete-confirm-row .admin-inline-btn {
 appearance: none !important;
 -webkit-appearance: none !important;
 width: auto !important;
 min-width: 72px !important;
 height: 32px !important;
 min-height: 32px !important;
 max-height: 32px !important;
 padding: 0 12px 2px 12px !important;
 border-width: 1px !important;
 border-style: solid !important;
 border-radius: 10px !important;
 display: inline-grid !important;
 place-items: center !important;
 align-self: center !important;
 line-height: 1 !important;
 box-sizing: border-box !important;
 overflow: hidden !important;
 }
 .admin-panel-container .admin-delete-confirm-row .admin-delete-cancel-btn {
 min-width: 54px !important;
 }
 body.theme-dark .admin-panel-container .admin-delete-confirm-row .admin-delete-confirm-btn {
 background-clip: padding-box !important;
 background: linear-gradient(135deg, rgba(244, 63, 94, 1), rgba(190, 18, 60, 1)) !important;
 border-color: rgba(251, 113, 133, 0.26) !important;
 color: #fff5f7 !important;
 }
 body.theme-light .admin-panel-container .admin-delete-confirm-row .admin-delete-confirm-btn {
 background-clip: padding-box !important;
 background: var(--button-destructive-bg-light) !important;
 border-color: transparent !important;
 color: var(--button-destructive-text-light) !important;
 }
 .admin-panel-container .admin-input,
 .admin-panel-container .admin-dropdown-trigger,
 .admin-panel-container .role-selector-trigger,
 .admin-panel-container select.admin-select-global-arrow.admin-input,
 .admin-panel-container textarea.admin-input {
 border-radius: var(--app-input-radius, 16px) !important;
 }
 `}</style>
    </div>
  );

  return content;
};

export default memo(AdminPanel);

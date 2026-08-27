import React, { memo, useEffect, useRef, useState } from 'react';
import { NotificationItem } from '../types';

interface NotificationInboxProps {
 isOpen: boolean;
 isMobileViewport: boolean;
 mobileAnchorTop: number | null;
 mobileAnchorRight: number | null;
 sidebarWidth: number;
 items: NotificationItem[];
 unreadCount: number;
 isLoading: boolean;
 error: string | null;
 onClose: () => void;
 onMarkRead: (id: string) => Promise<void>;
 onMarkAllRead: () => Promise<void>;
}

const formatTime = (iso: string) => {
 const date = new Date(iso);
 return date.toLocaleString('id-ID', {
 day: '2-digit',
 month: 'short',
 hour: '2-digit',
 minute: '2-digit',
 });
};

const DOCK_ANIMATION_MS = 560;
const MESSAGE_COLLAPSE_THRESHOLD = 110;

const handleItemKeyDown = (
 event: React.KeyboardEvent<HTMLDivElement>,
 onActivate: () => void
) => {
 if (event.key === 'Enter' || event.key === ' ') {
 event.preventDefault();
 onActivate();
 }
};

const NotificationInbox: React.FC<NotificationInboxProps> = ({
 isOpen,
 isMobileViewport,
 mobileAnchorTop,
 mobileAnchorRight,
 sidebarWidth,
 items,
 unreadCount,
 isLoading,
 error,
 onClose,
 onMarkRead,
 onMarkAllRead,
}) => {
 const panelRef = useRef<HTMLDivElement | null>(null);
 const [shouldRender, setShouldRender] = useState(isOpen);
 const [isClosing, setIsClosing] = useState(false);
 const [hasDockEntered, setHasDockEntered] = useState(false);
 const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

 useEffect(() => {
 if (isOpen) {
 setShouldRender(true);
 setIsClosing(false);
 setHasDockEntered(false);
 const enterTimer = window.setTimeout(() => {
 setHasDockEntered(true);
 }, DOCK_ANIMATION_MS);
 return () => window.clearTimeout(enterTimer);
 }
 if (!shouldRender) {
 setHasDockEntered(false);
 return;
 }
 setIsClosing(true);
 const timer = window.setTimeout(() => {
 setExpandedIds(new Set());
 setShouldRender(false);
 setIsClosing(false);
 setHasDockEntered(false);
 }, DOCK_ANIMATION_MS);
 return () => window.clearTimeout(timer);
 }, [isOpen, shouldRender]);

 useEffect(() => {
 if (!shouldRender) return;

 const handlePointerDown = (event: MouseEvent) => {
 if (document.body.classList.contains('is-tab-restoring')) return;

 const panel = panelRef.current;
 if (!panel) return;
 const target = event.target as Node | null;
 if (!target) return;
 if (target instanceof Element && target.closest('[data-notification-trigger="true"]')) {
 return;
 }
 if (!panel.contains(target)) {
 onClose();
 }
 };

 document.addEventListener('mousedown', handlePointerDown, true);
 return () => {
 document.removeEventListener('mousedown', handlePointerDown, true);
 };
 }, [shouldRender, onClose]);

 if (!shouldRender) return null;

 const dockAnimationClass = isClosing
 ? 'animate-notification-dock-out'
 : hasDockEntered
 ? ''
 : 'animate-notification-dock-in';
 const dockShadowAnimationClass = isClosing
 ? 'animate-notification-shadow-out'
 : hasDockEntered
 ? ''
 : 'animate-notification-shadow-in';
 const toggleExpanded = (event: React.MouseEvent<HTMLButtonElement>, id: string, isRead: boolean) => {
 event.stopPropagation();
 setExpandedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) {
 next.delete(id);
 } else {
 next.add(id);
 // Tandai sebagai terbaca saat pertama kali di-expand
 if (!isRead) {
 onMarkRead(id);
 }
 }
 return next;
 });
 };
 const renderMessageWithLinks = (text: string): React.ReactNode => {
 const urlRegex = /(https?:\/\/[^\s,"'<>\)\]]+)/g;
 const parts = text.split(urlRegex);
 return parts.map((part, i) => {
 if (urlRegex.test(part)) {
 urlRegex.lastIndex = 0;
 return (
 <a
 key={i}
 href={part}
 target="_blank"
 rel="noopener noreferrer"
 className="notification-inline-link"
 onClick={(e) => e.stopPropagation()}
 >
 {part}
 <span className="notification-link-icon material-symbols-rounded" aria-hidden="true">open_in_new</span>
 </a>
 );
 }
 return part;
 });
 };

 const renderItems = () => items.map((item) => {
 const isExpanded = expandedIds.has(item.id);
 const canToggleMessage = item.message.length > MESSAGE_COLLAPSE_THRESHOLD || item.message.includes('\n');

 return (
 <div
 key={item.id}
 role="button"
 tabIndex={0}
 onClick={() => { if (!item.isRead) onMarkRead(item.id); }}
 onKeyDown={(event) => handleItemKeyDown(event, () => { if (!item.isRead) onMarkRead(item.id); })}
 className={`notification-inbox-item w-full text-left px-4 py-3 border-b rounded-none ${!item.isRead ? 'notification-unread-item is-unread' : ''}`}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0 flex-1">
 <div className="text-[13px] font-semibold text-gray-900 ">{item.title}</div>
 <p className={`notification-message text-[12px] text-gray-600 mt-0.5 whitespace-pre-wrap ${isExpanded ? 'is-expanded' : 'is-collapsed'}`}>
 {renderMessageWithLinks(item.message)}
 </p>
 {canToggleMessage && (
 <button
 type="button"
 className="notification-expand-btn"
 onClick={(event) => toggleExpanded(event, item.id, item.isRead)}
 aria-expanded={isExpanded}
 >
 {isExpanded ? 'Tutup pesan' : 'Lihat selengkapnya'}
 </button>
 )}
 <div className="text-[11px] text-gray-400 mt-1">{formatTime(item.createdAt)}</div>
 </div>
 {!item.isRead && <span className="mt-1 inline-block w-2 h-2 rounded-full bg-indigo-500" aria-hidden="true" />}
 </div>
 </div>
 );
 });
 const inboxStyles = (
 <style>{`
 .notification-message.is-collapsed {
 display: -webkit-box;
 -webkit-line-clamp: 2;
 -webkit-box-orient: vertical;
 overflow: hidden;
 }
 .notification-message.is-expanded {
 display: block;
 overflow: visible;
 }
 .notification-expand-btn {
 display: inline-flex;
 align-items: center;
 margin-top: 4px;
 padding: 0;
 border: 0;
 background: transparent;
 color: #818cf8;
 font-size: 11px;
 line-height: 1.2;
 font-weight: 500;
 cursor: pointer;
 border-radius: 9999px !important;
 }
 .notification-expand-btn:hover {
 color: #a5b4fc;
 text-decoration: underline;
 }
 .notification-expand-btn:focus-visible {
 outline: 1px solid #818cf8;
 outline-offset: 2px;
 }
 .notification-inline-link {
 display: inline-flex;
 align-items: center;
 gap: 2px;
 color: #6366f1;
 font-weight: 600;
 text-decoration: underline;
 text-decoration-color: rgba(99, 102, 241, 0.45);
 text-underline-offset: 2px;
 word-break: break-all;
 border-radius: 3px;
 transition: color 0.15s ease, text-decoration-color 0.15s ease, background 0.15s ease;
 padding: 0 2px;
 margin: 0 1px;
 }
 .notification-inline-link:hover {
 color: #4f46e5;
 text-decoration-color: rgba(79, 70, 229, 0.7);
 background: rgba(99, 102, 241, 0.09);
 }
 .notification-inline-link:focus-visible {
 outline: 1px solid #6366f1;
 outline-offset: 2px;
 }
 .notification-link-icon {
 font-size: 11px !important;
 line-height: 1;
 vertical-align: middle;
 opacity: 0.75;
 flex-shrink: 0;
 font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20;
 }
 body.theme-dark .notification-inline-link {
 color: #818cf8;
 text-decoration-color: rgba(129, 140, 248, 0.4);
 }
 body.theme-dark .notification-inline-link:hover {
 color: #a5b4fc;
 text-decoration-color: rgba(165, 180, 252, 0.65);
 background: rgba(129, 140, 248, 0.12);
 }
 .notification-unread-item,
 .notification-unread-item:hover,
 .notification-unread-item:focus-visible {
 border-radius: 0 !important;
 }
 .notification-unread-item {
 color: inherit;
 }
 .notification-unread-item .material-symbols-outlined,
 .notification-unread-item .text-indigo-500,
 .notification-unread-item .text-indigo-400 {
 color: inherit !important;
 }
 .notification-inbox-panel {
 background: #ffffff;
 border-color: #e5e7eb;
 }
 .notification-inbox-header {
 border-color: #e5e7eb;
 }
 .notification-inbox-item {
 border-color: #f3f4f6;
 }
 .notification-inbox-item:hover,
 .notification-inbox-item.is-unread {
 background: #f9fafb;
 }
 .notification-count-badge {
 display: inline-flex;
 align-items: center;
 justify-content: center;
 width: 15px;
 min-width: 15px;
 height: 15px;
 padding: 0;
 border-radius: 9999px;
 background: #6366f1;
 color: #ffffff;
 font-size: 0;
 line-height: 1;
 font-weight: 600;
 letter-spacing: -0.02em;
 }
 .notification-count-number {
 display: flex;
 align-items: center;
 justify-content: center;
 width: 100%;
 height: 100%;
 font-size: 7px;
 line-height: 1;
 font-weight: 600;
 transform: scale(0.72) translateY(-0.25px);
 transform-origin: center;
 }
 .notification-header-btn {
 background: #f3f4f6;
 color: #374151;
 border-radius: 12px !important;
 }
 .notification-mark-all-btn {
 display: inline-flex !important;
 align-items: center !important;
 justify-content: center !important;
 height: 28px !important;
 min-height: 28px !important;
 padding: 0 10px !important;
 border-radius: 12px !important;
 line-height: 1 !important;
 }
 .notification-mark-all-btn .notification-mark-all-label {
 position: relative;
 top: -1px;
 line-height: 1;
 }
 body .notification-inbox-panel button.notification-close-btn {
 width: 28px !important;
 height: 28px !important;
 min-width: 28px !important;
 min-height: 28px !important;
 padding: 0 !important;
 border-radius: 12px !important;
 display: inline-flex !important;
 align-items: center !important;
 justify-content: center !important;
 line-height: 1 !important;
 background-color: #f3f4f6 !important;
 }
 body .notification-inbox-panel button.notification-close-btn:hover,
 body .notification-inbox-panel button.notification-close-btn:active,
 body .notification-inbox-panel button.notification-close-btn:focus,
 body .notification-inbox-panel button.notification-close-btn:focus-visible {
 background-color: #e5e7eb !important;
 filter: none !important;
 }
 body.theme-dark .notification-inbox-panel button.notification-close-btn {
 background-color: #131a24 !important;
 }
 body.theme-dark .notification-inbox-panel button.notification-close-btn:hover,
 body.theme-dark .notification-inbox-panel button.notification-close-btn:active,
 body.theme-dark .notification-inbox-panel button.notification-close-btn:focus,
 body.theme-dark .notification-inbox-panel button.notification-close-btn:focus-visible {
 background-color: #1e293b !important;
 filter: none !important;
 }
 .notification-close-btn .material-symbols-outlined,
 .notification-close-btn .material-symbols-rounded {
 display: block;
 line-height: 1;
 font-size: 18px !important;
 }
 .notification-header-btn:hover,
 .notification-header-btn:focus,
 .notification-header-btn:active,
 .notification-header-btn:focus-visible {
 background: #e5e7eb !important;
 filter: none !important;
 }
 body.theme-dark .notification-inbox-panel {
 background: var(--surface-panel, #0f141d) !important;
 border-color: var(--border-soft, #222b38) !important;
 box-shadow: var(--editorial-shadow-soft, 0 22px 70px rgba(0,0,0,0.34)) !important;
 }
 body.theme-dark .notification-inbox-header {
 border-color: var(--border-muted, #18202a) !important;
 }
 body.theme-dark .notification-inbox-item {
 border-color: var(--border-muted, #18202a) !important;
 }
 body.theme-dark .notification-inbox-item:hover,
 body.theme-dark .notification-inbox-item.is-unread {
 background: var(--surface-raised, #18202c) !important;
 }
 body.theme-dark .notification-header-btn {
 background: #131a24 !important;
 color: var(--text-main, #f6f3ea) !important;
 }
 body.theme-dark .notification-header-btn:hover,
 body.theme-dark .notification-header-btn:focus,
 body.theme-dark .notification-header-btn:active,
 body.theme-dark .notification-header-btn:focus-visible {
 background: #1e293b !important;
 filter: none !important;
 }
 .notification-inbox-panel button:not(.notification-header-btn),
 .notification-inbox-panel button:not(.notification-header-btn) *,
 .notification-inbox-panel button:not(.notification-header-btn)::before,
 .notification-inbox-panel button:not(.notification-header-btn)::after,
 .notification-inbox-panel button:not(.notification-header-btn):hover,
 .notification-inbox-panel button:not(.notification-header-btn):hover *,
 .notification-inbox-panel button:not(.notification-header-btn):hover::before,
 .notification-inbox-panel button:not(.notification-header-btn):hover::after,
 .notification-inbox-panel button:not(.notification-header-btn):focus,
 .notification-inbox-panel button:not(.notification-header-btn):focus-visible,
 .notification-inbox-panel button:not(.notification-header-btn):active,
 .notification-inbox-panel .notification-expand-btn,
 .notification-inbox-panel .notification-expand-btn:hover {
 box-shadow: none !important;
 text-shadow: none !important;
 filter: none !important;
 transform: none !important;
 }
 .notification-expand-btn:hover {
 color: #818cf8 !important;
 text-decoration: none !important;
 }
 .notification-inbox-item .notification-inline-link,
 .notification-inbox-item.is-unread .notification-inline-link {
 color: #6366f1 !important;
 text-decoration: underline !important;
 }
 .notification-inbox-item .notification-inline-link:hover,
 .notification-inbox-item.is-unread .notification-inline-link:hover {
 color: #4f46e5 !important;
 background: rgba(99, 102, 241, 0.09) !important;
 }
 body.theme-dark .notification-inbox-item .notification-inline-link,
 body.theme-dark .notification-inbox-item.is-unread .notification-inline-link {
 color: #818cf8 !important;
 }
 body.theme-dark .notification-inbox-item .notification-inline-link:hover {
 color: #a5b4fc !important;
 background: rgba(129, 140, 248, 0.12) !important;
 }
 .notification-inbox-panel--dock {
 box-shadow: none !important;
 }
 body.theme-dark .notification-inbox-panel--dock {
 box-shadow: none !important;
 }
 .notification-dock-shadow {
 position: absolute;
 inset: 0;
 pointer-events: none;
 opacity: 1;
 transform: translateX(0);
 box-shadow: 0 24px 56px rgba(0, 0, 0, 0.18);
 will-change: transform, opacity;
 }
 body.theme-dark .notification-dock-shadow {
 box-shadow: var(--editorial-shadow-soft, 0 22px 70px rgba(0, 0, 0, 0.34));
 }
 @keyframes notificationShadowIn {
 from {
 transform: translateX(-100%);
 opacity: 0;
 }
 to {
 transform: translateX(0);
 opacity: 1;
 }
 }
 @keyframes notificationShadowOut {
 from {
 transform: translateX(0);
 opacity: 1;
 }
 to {
 transform: translateX(-100%);
 opacity: 0;
 }
 }
 .animate-notification-shadow-in {
 animation: notificationShadowIn var(--sidebar-motion-duration) var(--sidebar-motion-ease) forwards;
 }
 .animate-notification-shadow-out {
 animation: notificationShadowOut var(--sidebar-motion-duration) var(--sidebar-motion-ease) forwards;
 }
 `}</style>
 );

 if (isMobileViewport) {
 const mobileTop = typeof mobileAnchorTop === 'number'
 ? `${Math.max(12, Math.round(mobileAnchorTop + 10))}px`
 : '3.5rem';
 const mobileRight = typeof mobileAnchorRight === 'number'
 ? `${Math.max(16, Math.round(window.innerWidth - mobileAnchorRight))}px`
 : 'auto';

 return (
 <div className="fixed inset-0 z-[1200]" role="dialog" aria-modal="true" aria-label="Notification inbox">
 <div className="absolute inset-0 bg-black/35" />
 <div
 ref={panelRef}
 className="notification-inbox-panel absolute w-[320px] max-w-[calc(100vw-1rem)] max-h-[80vh] rounded-2xl border shadow-2xl flex flex-col overflow-hidden origin-top-left"
 style={{ top: mobileTop, right: mobileRight }}
 >
 <div className="notification-inbox-header px-4 py-3 border-b flex items-center justify-between gap-3">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined text-[19px]">notifications</span>
 <h3 className="text-sm font-semibold">Notifications</h3>
 {unreadCount > 0 && (
 <span className="notification-count-badge">
 <span className="notification-count-number">{unreadCount > 99 ? '99+' : unreadCount}</span>
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onMarkAllRead}
 className="notification-header-btn notification-mark-all-btn text-xs"
 disabled={unreadCount === 0}
 >
 <span className="notification-mark-all-label">Mark all read</span>
 </button>
 <button type="button" onClick={onClose} className="notification-header-btn notification-close-btn">
 <span className="material-symbols-outlined text-[18px]">close</span>
 </button>
 </div>
 </div>

 <div className="overflow-y-auto">
 {isLoading && items.length === 0 && (
 <div className="px-4 py-5 text-sm text-gray-500 ">Loading notifications...</div>
 )}
 {!isLoading && !error && items.length === 0 && (
 <div className="px-4 py-6 text-sm text-gray-500 ">Belum ada notifikasi.</div>
 )}
 {error && (
 <div className="px-4 py-4 text-sm text-red-500">{error}</div>
 )}
 {renderItems()}
 </div>
 </div>
 {inboxStyles}
 </div>
 );
 }

 return (
 <>
 {/* Wrapper to clip the panel animation exactly at the sidebar boundary */}
 <div
 className="fixed top-0 bottom-0 pointer-events-none"
 style={{
 left: 'var(--sidebar-w)',
 width: '360px',
 maxWidth: 'min(42vw,420px)',
 zIndex: 5,
 clipPath: 'inset(-100px -100px -100px 0)',
 transition: (hasDockEntered && !isClosing) ? 'left var(--sidebar-motion-duration) var(--sidebar-motion-ease)' : undefined
 }}
 >
 <div
 className={`notification-dock-shadow ${dockShadowAnimationClass}`}
 aria-hidden="true"
 />
 <div
 ref={panelRef}
 role="dialog"
 aria-modal="true"
 aria-label="Notification inbox"
 className={`notification-inbox-panel notification-inbox-panel--dock absolute inset-0 border-l flex flex-col overflow-hidden pointer-events-auto ${dockAnimationClass}`}
 >
 <div className="notification-inbox-header px-4 py-3 border-b flex items-center justify-between gap-3 h-[60px]">
 <div className="flex items-center gap-2">
 <span className="material-symbols-outlined text-[19px]">notifications</span>
 <h3 className="text-sm font-semibold">Notifications</h3>
 {unreadCount > 0 && (
 <span className="notification-count-badge">
 <span className="notification-count-number">{unreadCount > 99 ? '99+' : unreadCount}</span>
 </span>
 )}
 </div>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={onMarkAllRead}
 className="notification-header-btn notification-mark-all-btn text-xs"
 disabled={unreadCount === 0}
 >
 <span className="notification-mark-all-label">Mark all read</span>
 </button>
 <button type="button" onClick={onClose} className="notification-header-btn notification-close-btn" aria-label="Close notifications">
 <span className="material-symbols-outlined text-[18px]">close</span>
 </button>
 </div>
 </div>

 <div className="overflow-y-auto flex-1">
 {isLoading && items.length === 0 && (
 <div className="px-4 py-5 text-sm text-gray-500 ">Loading notifications...</div>
 )}
 {!isLoading && !error && items.length === 0 && (
 <div className="px-4 py-6 text-sm text-gray-500 ">Belum ada notifikasi.</div>
 )}
 {error && (
 <div className="px-4 py-4 text-sm text-red-500">{error}</div>
          )}
          {renderItems()}
        </div>
      </div>
      </div>
      {inboxStyles}
    </>
  );
};

export default memo(NotificationInbox);

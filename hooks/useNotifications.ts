import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthUser } from '../contexts/AuthContext';
import { NotificationItem } from '../types';
import {
 listMyNotifications,
 listMyUnreadCount,
 markAllNotificationsRead,
 markNotificationRead,
} from '../lib/notifications';

const POLL_MS_OPEN = 5000;
const POLL_MS_IDLE = 15000;

const isSystemErrorLogNotification = (notification: NotificationItem): boolean => {
 if (notification.kind !== 'error') return false;
 const sourceText = `${notification.title} ${notification.message} ${notification.createdBy}`.toLowerCase();
 return (
 notification.createdBy.toLowerCase() === 'system' ||
 sourceText.includes('error log') ||
 sourceText.includes('app error') ||
 sourceText.includes('application error') ||
 sourceText.includes('error aplikasi') ||
 sourceText.includes('riwayat error')
 );
};

const getSessionToken = (currentUser: AuthUser | null): string | null => {
 if (!currentUser) return null;
 if (currentUser.sessionToken) return currentUser.sessionToken;
 try {
 const raw = localStorage.getItem('auth_session');
 if (!raw) return null;
 const parsed = JSON.parse(raw) as { username?: string; sessionToken?: string };
 if ((parsed.username || '').toLowerCase() !== currentUser.username.toLowerCase()) return null;
 return parsed.sessionToken || null;
 } catch {
 return null;
 }
};

export const useNotifications = (currentUser: AuthUser | null, isPanelOpen: boolean) => {
 const [items, setItems] = useState<NotificationItem[]>([]);
 const [unreadCount, setUnreadCount] = useState(0);
 const [isLoading, setIsLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [isPageVisible, setIsPageVisible] = useState(() =>
 typeof document === 'undefined' ? true : document.visibilityState === 'visible'
 );

 const seenIdsRef = useRef<Set<string>>(new Set());
 const timerRef = useRef<number | null>(null);
 const inFlightRef = useRef(false);

 const sessionToken = useMemo(() => getSessionToken(currentUser), [currentUser]);

 const refresh = useCallback(async () => {
 if (!currentUser || !sessionToken || inFlightRef.current) return;
 inFlightRef.current = true;
 try {
 const [nextItems, nextUnreadCount] = await Promise.all([
 listMyNotifications(currentUser.username, sessionToken, 30),
 listMyUnreadCount(currentUser.username, sessionToken),
 ]);
 const visibleItems = nextItems.filter((item) => !isSystemErrorLogNotification(item));
 const hiddenUnreadCount = nextItems.filter((item) => isSystemErrorLogNotification(item) && !item.isRead).length;

 for (const notif of visibleItems) {
 if (!seenIdsRef.current.has(notif.id)) {
 seenIdsRef.current.add(notif.id);
 }
 }

 setItems(visibleItems);
 setUnreadCount(Math.max(0, nextUnreadCount - hiddenUnreadCount));
 setError(null);
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to load notifications';
 setError(message);
 } finally {
 inFlightRef.current = false;
 }
 }, [currentUser, sessionToken]);

 useEffect(() => {
 if (typeof document === 'undefined') return;

 const handleVisibilityChange = () => {
 setIsPageVisible(document.visibilityState === 'visible');
 };

 document.addEventListener('visibilitychange', handleVisibilityChange);
 return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
 }, []);

 useEffect(() => {
 if (!currentUser || !sessionToken) {
 setItems([]);
 setUnreadCount(0);
 setError(null);
 seenIdsRef.current.clear();
 return;
 }

 if (!isPageVisible) {
 if (timerRef.current !== null) {
 window.clearInterval(timerRef.current);
 timerRef.current = null;
 }
 return;
 }

 setIsLoading(true);
 refresh().finally(() => setIsLoading(false));

 const pollMs = isPanelOpen ? POLL_MS_OPEN : POLL_MS_IDLE;
 timerRef.current = window.setInterval(() => {
 refresh();
 }, pollMs);

 return () => {
 if (timerRef.current !== null) {
 window.clearInterval(timerRef.current);
 timerRef.current = null;
 }
 };
 }, [currentUser, sessionToken, refresh, isPanelOpen, isPageVisible]);

 const markRead = useCallback(
 async (id: string) => {
 if (!currentUser || !sessionToken) return;
 try {
 const ok = await markNotificationRead(currentUser.username, sessionToken, id);
 if (!ok) return;
 setItems((prev) =>
 prev.map((item) => (item.id === id ? { ...item, isRead: true, readAt: new Date().toISOString() } : item))
 );
 setUnreadCount((prev) => Math.max(0, prev - 1));
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to mark notification as read';
 setError(message);
 }
 },
 [currentUser, sessionToken]
 );

 const markAllRead = useCallback(async () => {
 if (!currentUser || !sessionToken) return;
 try {
 const updatedCount = await markAllNotificationsRead(currentUser.username, sessionToken);
 if (updatedCount <= 0) return;
 setItems((prev) =>
 prev.map((item) => (item.isRead ? item : { ...item, isRead: true, readAt: new Date().toISOString() }))
 );
 setUnreadCount(0);
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to mark all notifications as read';
      setError(message);
    }
  }, [currentUser, sessionToken]);

  return {
    items,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
  };
};

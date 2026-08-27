import {
  NotificationItem,
  NotificationKind,
  NotificationTarget,
  SendNotificationPayload,
  SentNotificationItem,
  UpdateSentNotificationPayload,
} from '../types';

const STORAGE_KEY_NOTIFICATIONS = 'app_notifications_local';

interface StoredNotification {
  id: string;
  dispatchId: string;
  title: string;
  message: string;
  kind: NotificationKind;
  target: NotificationTarget;
  recipientUsername: string;
  createdBy: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const loadStoredNotifications = (): StoredNotification[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_NOTIFICATIONS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[Notifications] Failed to load local notifications:', e);
  }
  return [];
};

const saveStoredNotifications = (notifications: StoredNotification[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_NOTIFICATIONS, JSON.stringify(notifications));
  } catch (e) {
    console.error('[Notifications] Failed to save local notifications:', e);
  }
};

export const sendNotification = async (
  payload: SendNotificationPayload
): Promise<{ success: boolean; insertedCount: number; error?: string }> => {
  try {
    const notifications = loadStoredNotifications();
    const dispatchId = `dispatch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const createdAt = new Date().toISOString();

    const newNotification: StoredNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dispatchId,
      title: payload.title,
      message: payload.message,
      kind: payload.kind ?? 'info',
      target: payload.target,
      recipientUsername: payload.target === 'all' ? 'all' : (payload.recipientUsername || ''),
      createdBy: payload.senderUsername,
      isRead: false,
      readAt: null,
      createdAt,
    };

    notifications.unshift(newNotification);
    saveStoredNotifications(notifications);

    return {
      success: true,
      insertedCount: 1,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal mengirim notifikasi';
    return { success: false, insertedCount: 0, error: message };
  }
};

export const listMyNotifications = async (
  username: string,
  _sessionToken?: string,
  limit = 20,
  beforeCreatedAt?: string
): Promise<NotificationItem[]> => {
  const notifications = loadStoredNotifications();
  const lowerUser = username.toLowerCase();

  let filtered = notifications.filter(
    (n) => n.recipientUsername === 'all' || n.recipientUsername.toLowerCase() === lowerUser
  );

  if (beforeCreatedAt) {
    const beforeTime = new Date(beforeCreatedAt).getTime();
    filtered = filtered.filter((n) => new Date(n.createdAt).getTime() < beforeTime);
  }

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return filtered.slice(0, limit).map((n) => ({
    id: n.id,
    title: n.title,
    message: n.message,
    kind: n.kind,
    recipientUsername: n.recipientUsername,
    createdBy: n.createdBy,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));
};

export const listMyUnreadCount = async (
  username: string,
  _sessionToken?: string
): Promise<number> => {
  const notifications = loadStoredNotifications();
  const lowerUser = username.toLowerCase();

  return notifications.filter(
    (n) => (n.recipientUsername === 'all' || n.recipientUsername.toLowerCase() === lowerUser) && !n.isRead
  ).length;
};

export const markNotificationRead = async (
  _username: string,
  _sessionToken: string,
  notificationId: string
): Promise<boolean> => {
  const notifications = loadStoredNotifications();
  let found = false;
  const updated = notifications.map((n) => {
    if (n.id === notificationId) {
      found = true;
      return { ...n, isRead: true, readAt: new Date().toISOString() };
    }
    return n;
  });

  if (found) {
    saveStoredNotifications(updated);
  }
  return true;
};

export const markAllNotificationsRead = async (
  username: string,
  _sessionToken: string
): Promise<number> => {
  const notifications = loadStoredNotifications();
  const lowerUser = username.toLowerCase();
  let updatedCount = 0;

  const updated = notifications.map((n) => {
    if ((n.recipientUsername === 'all' || n.recipientUsername.toLowerCase() === lowerUser) && !n.isRead) {
      updatedCount++;
      return { ...n, isRead: true, readAt: new Date().toISOString() };
    }
    return n;
  });

  saveStoredNotifications(updated);
  return updatedCount;
};

export const listSentNotifications = async (
  senderUsername: string,
  _senderSessionToken?: string,
  limit = 30,
  beforeCreatedAt?: string
): Promise<SentNotificationItem[]> => {
  const notifications = loadStoredNotifications();
  const lowerSender = senderUsername.toLowerCase();

  let sent = notifications.filter((n) => n.createdBy.toLowerCase() === lowerSender);

  if (beforeCreatedAt) {
    const beforeTime = new Date(beforeCreatedAt).getTime();
    sent = sent.filter((n) => new Date(n.createdAt).getTime() < beforeTime);
  }

  sent.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return sent.slice(0, limit).map((n) => ({
    dispatchId: n.dispatchId,
    title: n.title,
    message: n.message,
    kind: n.kind,
    createdBy: n.createdBy,
    createdAt: n.createdAt,
    recipientCount: 1,
    readCount: n.isRead ? 1 : 0,
    unreadCount: n.isRead ? 0 : 1,
  }));
};

export const updateSentNotification = async (
  payload: UpdateSentNotificationPayload
): Promise<{ success: boolean; updatedCount: number; error?: string }> => {
  try {
    const notifications = loadStoredNotifications();
    let updatedCount = 0;

    const updated = notifications.map((n) => {
      if (n.dispatchId === payload.dispatchId && n.createdBy.toLowerCase() === payload.senderUsername.toLowerCase()) {
        updatedCount++;
        return {
          ...n,
          title: payload.title ?? n.title,
          message: payload.message ?? n.message,
          kind: payload.kind ?? n.kind,
        };
      }
      return n;
    });

    saveStoredNotifications(updated);
    return { success: true, updatedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memperbarui notifikasi';
    return { success: false, updatedCount: 0, error: message };
  }
};

export const deleteSentNotification = async (
  senderUsername: string,
  _senderSessionToken: string,
  dispatchId: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
  try {
    const notifications = loadStoredNotifications();
    const filtered = notifications.filter(
      (n) => !(n.dispatchId === dispatchId && n.createdBy.toLowerCase() === senderUsername.toLowerCase())
    );
    const deletedCount = notifications.length - filtered.length;
    saveStoredNotifications(filtered);
    return { success: true, deletedCount };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal menghapus notifikasi';
    return { success: false, deletedCount: 0, error: message };
  }
};

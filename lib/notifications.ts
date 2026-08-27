import { supabase } from './supabaseClient';
import {
 NotificationItem,
 NotificationKind,
 NotificationTarget,
 SendNotificationPayload,
 SentNotificationItem,
 UpdateSentNotificationPayload,
} from '../types';

type RpcResponseObject = Record<string, unknown> | null;

const mapNotificationRow = (row: Record<string, unknown>): NotificationItem => ({
 id: String(row.id ?? ''),
 title: String(row.title ?? ''),
 message: String(row.message ?? ''),
 kind: (row.kind as NotificationKind) ?? 'info',
 recipientUsername: String(row.recipient_username ?? ''),
 createdBy: String(row.created_by ?? ''),
 isRead: Boolean(row.is_read),
 readAt: row.read_at ? String(row.read_at) : null,
 createdAt: String(row.created_at ?? new Date().toISOString()),
});

const mapSentNotificationRow = (row: Record<string, unknown>): SentNotificationItem => ({
 dispatchId: String(row.dispatch_id ?? ''),
 title: String(row.title ?? ''),
 message: String(row.message ?? ''),
 kind: (row.kind as NotificationKind) ?? 'info',
 createdBy: String(row.created_by ?? ''),
 createdAt: String(row.created_at ?? new Date().toISOString()),
 recipientCount: Number(row.recipient_count ?? 0),
 readCount: Number(row.read_count ?? 0),
 unreadCount: Number(row.unread_count ?? 0),
});

const normalizeRpcObject = (data: unknown): RpcResponseObject => {
 if (!data) return null;
 if (Array.isArray(data)) {
 const first = data[0];
 return first && typeof first === 'object' ? (first as Record<string, unknown>) : null;
 }
 return typeof data === 'object' ? (data as Record<string, unknown>) : null;
};

const isMissingFunctionError = (error: { code?: string; message?: string } | null): boolean => {
 if (!error) return false;
 return error.code === 'PGRST202' || /schema cache/i.test(error.message || '');
};

const callRpcWithFallback = async (
 fn: string,
 variants: Array<Record<string, unknown>>
): Promise<{ data: unknown; error: { code?: string; message?: string } | null }> => {
 let lastError: { code?: string; message?: string } | null = null;
 for (const params of variants) {
 const { data, error } = await supabase.rpc(fn, params);
 if (!error) return { data, error: null };
 lastError = { code: (error as any).code, message: error.message };
 if (!isMissingFunctionError(lastError)) break;
 }
 return { data: null, error: lastError };
};

export const sendNotification = async (payload: SendNotificationPayload): Promise<{ success: boolean; insertedCount: number; error?: string }> => {
 const { data, error } = await callRpcWithFallback('send_notification_v1', [
 {
 sender_username: payload.senderUsername,
 sender_session_token: payload.senderSessionToken,
 title: payload.title,
 message: payload.message,
 target: payload.target as NotificationTarget,
 recipient_username: payload.recipientUsername ?? null,
 kind: payload.kind ?? 'info',
 },
 {
 p_sender_username: payload.senderUsername,
 p_sender_session_token: payload.senderSessionToken,
 p_title: payload.title,
 p_message: payload.message,
 p_target: payload.target as NotificationTarget,
 p_recipient_username: payload.recipientUsername ?? null,
 p_kind: payload.kind ?? 'info',
 },
 ]);

 if (error) {
 return { success: false, insertedCount: 0, error: error.message };
 }

 const result = normalizeRpcObject(data);
 return {
 success: Boolean(result?.success),
 insertedCount: Number(result?.inserted_count ?? 0),
 error: typeof result?.error === 'string' ? result.error : undefined,
 };
};

export const listMyNotifications = async (
 username: string,
 sessionToken: string,
 limit = 20,
 beforeCreatedAt?: string
): Promise<NotificationItem[]> => {
 const { data, error } = await callRpcWithFallback('list_my_notifications_v1', [
 {
 username,
 session_token: sessionToken,
 limit_count: limit,
 before_created_at: beforeCreatedAt ?? null,
 },
 {
 session_token: sessionToken,
 username,
 limit_count: limit,
 before_created_at: beforeCreatedAt ?? null,
 },
 {
 username,
 session_token: sessionToken,
 limit_count: limit,
 },
 {
 username,
 session_token: sessionToken,
 },
 {
 username,
 session_token: sessionToken,
 limit: limit,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 p_limit_count: limit,
 p_before_created_at: beforeCreatedAt ?? null,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 p_limit_count: limit,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 },
 {
 p_session_token: sessionToken,
 p_username: username,
 },
 ]);

 if (error) {
 throw new Error(error.message);
 }
 if (!Array.isArray(data)) return [];
 return data.map((row) => mapNotificationRow(row as Record<string, unknown>));
};

export const listMyUnreadCount = async (username: string, sessionToken: string): Promise<number> => {
 const { data, error } = await callRpcWithFallback('list_my_unread_count_v1', [
 {
 username,
 session_token: sessionToken,
 },
 {
 session_token: sessionToken,
 username,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 },
 {
 p_session_token: sessionToken,
 p_username: username,
 },
 ]);
 if (error) throw new Error(error.message);
 const result = normalizeRpcObject(data);
 return Number(result?.unread_count ?? 0);
};

export const markNotificationRead = async (username: string, sessionToken: string, notificationId: string): Promise<boolean> => {
 const { data, error } = await callRpcWithFallback('mark_notification_read_v1', [
 {
 username,
 session_token: sessionToken,
 notification_id: notificationId,
 },
 {
 session_token: sessionToken,
 username,
 notification_id: notificationId,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 p_notification_id: notificationId,
 },
 ]);
 if (error) throw new Error(error.message);
 const result = normalizeRpcObject(data);
 return Boolean(result?.success);
};

export const markAllNotificationsRead = async (username: string, sessionToken: string): Promise<number> => {
 const { data, error } = await callRpcWithFallback('mark_all_notifications_read_v1', [
 {
 username,
 session_token: sessionToken,
 },
 {
 session_token: sessionToken,
 username,
 },
 {
 p_username: username,
 p_session_token: sessionToken,
 },
 ]);
 if (error) throw new Error(error.message);
 const result = normalizeRpcObject(data);
 return Number(result?.updated_count ?? 0);
};

export const listSentNotifications = async (
 senderUsername: string,
 senderSessionToken: string,
 limit = 30,
 beforeCreatedAt?: string
): Promise<SentNotificationItem[]> => {
 const { data, error } = await callRpcWithFallback('list_sent_notifications_v1', [
 {
 sender_username: senderUsername,
 sender_session_token: senderSessionToken,
 limit_count: limit,
 before_created_at: beforeCreatedAt ?? null,
 },
 {
 p_sender_username: senderUsername,
 p_sender_session_token: senderSessionToken,
 p_limit_count: limit,
 p_before_created_at: beforeCreatedAt ?? null,
 },
 {
 p_sender_username: senderUsername,
 p_sender_session_token: senderSessionToken,
 p_limit_count: limit,
 },
 {
 p_sender_username: senderUsername,
 p_sender_session_token: senderSessionToken,
 },
 ]);

 if (error) throw new Error(error.message);
 if (!Array.isArray(data)) return [];
 return data.map((row) => mapSentNotificationRow(row as Record<string, unknown>));
};

export const updateSentNotification = async (
 payload: UpdateSentNotificationPayload
): Promise<{ success: boolean; updatedCount: number; error?: string }> => {
 const { data, error } = await callRpcWithFallback('update_sent_notification_v1', [
 {
 sender_username: payload.senderUsername,
 sender_session_token: payload.senderSessionToken,
 dispatch_id: payload.dispatchId,
 title: payload.title,
 message: payload.message,
 kind: payload.kind,
 },
 {
 p_sender_username: payload.senderUsername,
 p_sender_session_token: payload.senderSessionToken,
 p_dispatch_id: payload.dispatchId,
 p_title: payload.title,
 p_message: payload.message,
 p_kind: payload.kind,
 },
 ]);

 if (error) return { success: false, updatedCount: 0, error: error.message };
 const result = normalizeRpcObject(data);
 return {
 success: Boolean(result?.success),
 updatedCount: Number(result?.updated_count ?? 0),
 error: typeof result?.error === 'string' ? result.error : undefined,
 };
};

export const deleteSentNotification = async (
 senderUsername: string,
 senderSessionToken: string,
 dispatchId: string
): Promise<{ success: boolean; deletedCount: number; error?: string }> => {
 const { data, error } = await callRpcWithFallback('delete_sent_notification_v1', [
 {
 sender_username: senderUsername,
 sender_session_token: senderSessionToken,
 dispatch_id: dispatchId,
 },
 {
 p_sender_username: senderUsername,
 p_sender_session_token: senderSessionToken,
 p_dispatch_id: dispatchId,
 },
 ]);

 if (error) return { success: false, deletedCount: 0, error: error.message };
 const result = normalizeRpcObject(data);
 return {
 success: Boolean(result?.success),
 deletedCount: Number(result?.deleted_count ?? 0),
 error: typeof result?.error === 'string' ? result.error : undefined,
  };
};

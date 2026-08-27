import type { AppErrorLog } from '../types';
import { supabase } from './supabaseClient';

const mapErrorLogRow = (row: Record<string, unknown>): AppErrorLog => ({
 id: String(row.id ?? ''),
 errorMessage: String(row.error_message ?? ''),
 aiModel: String(row.ai_model ?? ''),
 errorDetails: String(row.error_details ?? ''),
 username: String(row.username ?? ''),
 occurrences: Number(row.occurrences ?? 0),
 firstSeenAt: String(row.first_seen_at ?? ''),
 lastSeenAt: String(row.last_seen_at ?? ''),
 promptStyle: String(row.prompt_style ?? ''),
 origin: String(row.origin ?? 'web'),
});

export const logAppError = async (payload: {
 errorMessage: string;
 aiModel: string;
 errorDetails: string;
 username: string;
 sessionToken: string;
 promptStyle: string;
 origin?: string;
}): Promise<boolean> => {
 const { data, error } = await supabase.rpc('log_app_error_v1', {
 p_error_message: payload.errorMessage,
 p_ai_model: payload.aiModel,
 p_error_details: payload.errorDetails,
 p_username: payload.username,
 p_session_token: payload.sessionToken,
 p_prompt_style: payload.promptStyle,
 p_origin: payload.origin ?? 'web',
 });

 if (error) throw new Error(error.message);
 const result = Array.isArray(data) ? data[0] : data;
 return Boolean((result as Record<string, unknown> | null)?.success);
};

export const listAppErrorLogs = async (
 username: string,
 sessionToken: string,
 limit = 100
): Promise<AppErrorLog[]> => {
 const { data, error } = await supabase.rpc('list_app_errors_v1', {
 p_username: username,
 p_session_token: sessionToken,
 p_limit: limit,
 });

 if (error) throw new Error(error.message);
 if (!Array.isArray(data)) return [];
 return data.map((row) => mapErrorLogRow(row as Record<string, unknown>));
};

export const clearAllAppErrorLogs = async (
 username: string,
 sessionToken: string
): Promise<boolean> => {
 const { data, error } = await supabase.rpc('clear_all_app_errors_v1', {
 p_username: username,
 p_session_token: sessionToken,
 });

 if (error) throw new Error(error.message);
 const result = Array.isArray(data) ? data[0] : data;
 return Boolean((result as Record<string, unknown> | null)?.success);
};

export const deleteAppErrorLog = async (
 username: string,
 sessionToken: string,
 errorId: string
): Promise<boolean> => {
 const { data, error } = await supabase.rpc('delete_app_error_v1', {
    p_username: username,
    p_session_token: sessionToken,
    p_error_id: errorId,
  });

  if (error) throw new Error(error.message);
  const result = Array.isArray(data) ? data[0] : data;
  return Boolean((result as Record<string, unknown> | null)?.success);
};

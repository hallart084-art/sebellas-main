import type { AppErrorLog } from '../types';

const STORAGE_KEY_ERROR_LOGS = 'app_error_logs_local';

const loadStoredErrorLogs = (): AppErrorLog[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ERROR_LOGS);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('[ErrorLogs] Failed to load local error logs:', e);
  }
  return [];
};

const saveStoredErrorLogs = (logs: AppErrorLog[]) => {
  try {
    localStorage.setItem(STORAGE_KEY_ERROR_LOGS, JSON.stringify(logs));
  } catch (e) {
    console.error('[ErrorLogs] Failed to save local error logs:', e);
  }
};

export const logAppError = async (payload: {
  errorMessage: string;
  aiModel: string;
  errorDetails: string;
  username: string;
  sessionToken: string;
  promptStyle: string;
  origin?: string;
}): Promise<boolean> => {
  try {
    const logs = loadStoredErrorLogs();
    const now = new Date().toISOString();

    const existingIndex = logs.findIndex(
      (l) =>
        l.errorMessage === payload.errorMessage &&
        l.aiModel === payload.aiModel &&
        l.username.toLowerCase() === payload.username.toLowerCase()
    );

    if (existingIndex >= 0) {
      logs[existingIndex].occurrences = (logs[existingIndex].occurrences || 1) + 1;
      logs[existingIndex].lastSeenAt = now;
      logs[existingIndex].errorDetails = payload.errorDetails || logs[existingIndex].errorDetails;
    } else {
      const newLog: AppErrorLog = {
        id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        errorMessage: payload.errorMessage,
        aiModel: payload.aiModel,
        errorDetails: payload.errorDetails,
        username: payload.username,
        occurrences: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        promptStyle: payload.promptStyle,
        origin: payload.origin ?? 'web',
      };
      logs.unshift(newLog);
    }

    saveStoredErrorLogs(logs);
    return true;
  } catch (err) {
    console.error('[ErrorLogs] Failed to save error log:', err);
    return false;
  }
};

export const listAppErrorLogs = async (
  _username: string,
  _sessionToken: string,
  limit = 100
): Promise<AppErrorLog[]> => {
  const logs = loadStoredErrorLogs();
  logs.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
  return logs.slice(0, limit);
};

export const clearAllAppErrorLogs = async (
  _username: string,
  _sessionToken: string
): Promise<boolean> => {
  saveStoredErrorLogs([]);
  return true;
};

export const deleteAppErrorLog = async (
  _username: string,
  _sessionToken: string,
  errorId: string
): Promise<boolean> => {
  const logs = loadStoredErrorLogs();
  const filtered = logs.filter((l) => l.id !== errorId);
  saveStoredErrorLogs(filtered);
  return true;
};

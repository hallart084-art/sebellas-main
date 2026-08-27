import { useCallback, useEffect, useState } from 'react';
import type { AuthUser } from '../contexts/AuthContext';
import type { AppErrorLog } from '../types';
import {
 clearAllAppErrorLogs,
 deleteAppErrorLog,
 listAppErrorLogs,
} from '../lib/errorLogs';

const ERROR_LOGS_POLL_MS = 5000;

const getErrorLogSession = (currentUser: AuthUser | null): { username: string; sessionToken: string } | null => {
 if (!currentUser || !currentUser.sessionToken) return null;
 return {
 username: currentUser.username,
 sessionToken: currentUser.sessionToken,
 };
};

export const useErrorLogs = (currentUser: AuthUser | null, isActive: boolean) => {
 const [errorLogs, setErrorLogs] = useState<AppErrorLog[]>([]);
 const [isLoadingErrorLogs, setIsLoadingErrorLogs] = useState(false);
 const [isClearingErrorLogs, setIsClearingErrorLogs] = useState(false);
 const [deletingErrorLogId, setDeletingErrorLogId] = useState<string | null>(null);
 const [errorLogsError, setErrorLogsError] = useState<string | null>(null);

 const loadErrorLogs = useCallback(
 async (options?: { silent?: boolean }) => {
 const session = getErrorLogSession(currentUser);
 if (!session) return;

 const silent = Boolean(options?.silent);
 if (!silent) {
 setIsLoadingErrorLogs(true);
 }

 try {
 const logs = await listAppErrorLogs(session.username, session.sessionToken, 100);
 setErrorLogs(logs);
 setErrorLogsError(null);
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Gagal memuat error logs.';
 setErrorLogsError(message);
 } finally {
 if (!silent) {
 setIsLoadingErrorLogs(false);
 }
 }
 },
 [currentUser]
 );

 const clearErrorLogs = useCallback(async (): Promise<{ success: boolean; message: string }> => {
 const session = getErrorLogSession(currentUser);
 if (!session) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

 setIsClearingErrorLogs(true);
 try {
 const success = await clearAllAppErrorLogs(session.username, session.sessionToken);
 if (!success) return { success: false, message: 'Gagal menghapus semua error logs.' };
 setErrorLogs([]);
 setErrorLogsError(null);
 return { success: true, message: 'Semua error logs berhasil dihapus.' };
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Gagal menghapus semua error logs.';
 setErrorLogsError(message);
 return { success: false, message };
 } finally {
 setIsClearingErrorLogs(false);
 }
 }, [currentUser]);

 const deleteErrorLog = useCallback(
 async (id: string): Promise<{ success: boolean; message: string }> => {
 const session = getErrorLogSession(currentUser);
 if (!session) return { success: false, message: 'Sesi tidak valid. Silakan login ulang.' };

 setDeletingErrorLogId(id);
 try {
 const success = await deleteAppErrorLog(session.username, session.sessionToken, id);
 if (!success) return { success: false, message: 'Gagal menghapus error log.' };
 setErrorLogs((current) => current.filter((log) => log.id !== id));
 setErrorLogsError(null);
 return { success: true, message: 'Error log berhasil dihapus.' };
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Gagal menghapus error log.';
        setErrorLogsError(message);
        return { success: false, message };
      } finally {
        setDeletingErrorLogId(null);
      }
    },
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser) {
      setErrorLogs([]);
      setErrorLogsError(null);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isActive) return;
    loadErrorLogs();
  }, [isActive, loadErrorLogs]);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => {
      loadErrorLogs({ silent: true });
    }, ERROR_LOGS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [isActive, loadErrorLogs]);

  return {
    errorLogs,
    isLoadingErrorLogs,
    isClearingErrorLogs,
    deletingErrorLogId,
    errorLogsError,
    loadErrorLogs,
    clearErrorLogs,
    deleteErrorLog,
  };
};

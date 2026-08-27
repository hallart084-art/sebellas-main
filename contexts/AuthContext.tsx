import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
} from 'react';
import { hashPassword, generateUuid } from '../lib/crypto';
import { logAppError } from '../lib/errorLogs';

// --- Types ---
export interface AuthUser {
  id: string;
  username: string;
  passwordHash: string;
  role: 'superadmin' | 'admin' | 'user';
  isActive: boolean;
  sessionToken?: string | null;
  extSessionToken?: string | null;
  createdAt: number;
  createdBy: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; message: string }>;
  logout: () => void;
  createUser: (username: string, password: string, role?: 'admin' | 'user') => Promise<{ success: boolean; message: string }>;
  deleteUser: (username: string) => Promise<void>;
  updateUserAccount: (oldUsername: string, newUsername?: string, newPassword?: string, newRole?: 'user' | 'admin' | 'superadmin') => Promise<{ success: boolean; message: string }>;
  toggleUserActive: (username: string) => Promise<void>;
  resetUserDevice: (username: string) => Promise<void>;
  resetExtensionSession: (username: string) => Promise<void>;
  getAllUsers: () => AuthUser[];
  updateOwnAccount: (oldPassword: string, newUsername?: string, newPassword?: string) => Promise<{ success: boolean; message: string }>;
  logError: (message: string, aiModel: string, details: string, promptStyle?: string, origin?: string) => Promise<void>;
  onlineUsers: string[];
}

const DEFAULT_USER: AuthUser = {
  id: 'local-user',
  username: 'Sebellas',
  passwordHash: '',
  role: 'superadmin',
  isActive: true,
  createdAt: Date.now(),
  createdBy: 'system',
  sessionToken: 'local-session-token',
  extSessionToken: null,
};

// --- Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Provider ---
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(DEFAULT_USER);
  const [users, setUsers] = useState<AuthUser[]>([DEFAULT_USER]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>(['Sebellas']);

  useEffect(() => {
    // Ensure default user session is initialized in localStorage
    try {
      localStorage.setItem('auth_session', JSON.stringify({
        username: 'Sebellas',
        loginAt: Date.now(),
        sessionToken: 'local-session-token',
        role: 'superadmin',
      }));
      localStorage.setItem('device_id', 'local-device');
    } catch (e) {}
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (username: string, _password: string): Promise<{ success: boolean; message: string }> => {
      const user: AuthUser = {
        ...DEFAULT_USER,
        username: username.trim() || 'Sebellas',
      };
      setCurrentUser(user);
      return { success: true, message: 'Login berhasil.' };
    },
    []
  );

  const logout = useCallback(() => {
    // In no-login mode, keep default user active
    setCurrentUser(DEFAULT_USER);
  }, []);

  const createUser = useCallback(
    async (username: string, password: string, role: 'admin' | 'user' = 'user'): Promise<{ success: boolean; message: string }> => {
      const trimmed = username.trim();
      if (!trimmed) return { success: false, message: 'Username tidak boleh kosong.' };
      const hash = await hashPassword(password);
      const newUser: AuthUser = {
        id: generateUuid(),
        username: trimmed,
        passwordHash: hash,
        role,
        isActive: true,
        sessionToken: null,
        extSessionToken: null,
        createdAt: Date.now(),
        createdBy: currentUser?.username || 'system',
      };
      setUsers(prev => [...prev, newUser]);
      return { success: true, message: `Akun "${trimmed}" berhasil dibuat.` };
    },
    [currentUser]
  );

  const deleteUser = useCallback(async (username: string) => {
    setUsers(prev => prev.filter(u => u.username !== username));
  }, []);

  const updateUserAccount = useCallback(
    async (
      oldUsername: string,
      newUsername?: string,
      _newPassword?: string,
      newRole?: 'user' | 'admin' | 'superadmin'
    ): Promise<{ success: boolean; message: string }> => {
      setUsers(prev =>
        prev.map(u => {
          if (u.username === oldUsername) {
            return {
              ...u,
              username: newUsername?.trim() || u.username,
              role: newRole || u.role,
            };
          }
          return u;
        })
      );
      return { success: true, message: 'Akun berhasil diperbarui.' };
    },
    []
  );

  const toggleUserActive = useCallback(async (username: string) => {
    setUsers(prev =>
      prev.map(u => (u.username === username ? { ...u, isActive: !u.isActive } : u))
    );
  }, []);

  const resetUserDevice = useCallback(async (username: string) => {
    setUsers(prev =>
      prev.map(u => (u.username === username ? { ...u, sessionToken: null } : u))
    );
  }, []);

  const resetExtensionSession = useCallback(async (username: string) => {
    setUsers(prev =>
      prev.map(u => (u.username === username ? { ...u, extSessionToken: null } : u))
    );
  }, []);

  const getAllUsers = useCallback((): AuthUser[] => users, [users]);

  const updateOwnAccount = useCallback(
    async (_oldPassword: string, newUsername?: string, _newPassword?: string): Promise<{ success: boolean; message: string }> => {
      if (newUsername && newUsername.trim()) {
        const updated = { ...DEFAULT_USER, username: newUsername.trim() };
        setCurrentUser(updated);
      }
      return { success: true, message: 'Akun berhasil diperbarui.' };
    },
    []
  );

  const logError = useCallback(
    async (message: string, aiModel: string, details: string, promptStyle: string = '', origin: string = 'Web'): Promise<void> => {
      try {
        await logAppError({
          errorMessage: message,
          aiModel,
          errorDetails: details,
          username: currentUser?.username || 'Sebellas',
          sessionToken: 'local-session-token',
          promptStyle,
          origin,
        });
      } catch (err) {
        console.error('[Auth] Failed to log error:', err);
      }
    },
    [currentUser]
  );

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAdmin: true,
        isSuperAdmin: true,
        isLoading,
        login,
        logout,
        createUser,
        deleteUser,
        updateUserAccount,
        toggleUserActive,
        resetUserDevice,
        resetExtensionSession,
        getAllUsers,
        updateOwnAccount,
        logError,
        onlineUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// --- Hook ---
export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

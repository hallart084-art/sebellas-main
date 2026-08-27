
import React, {
 createContext,
 useState,
 useEffect,
 useContext,
 useCallback,
 ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { hashPassword } from '../lib/crypto';
import { logAppError } from '../lib/errorLogs';
import fpPromise from '@fingerprintjs/fingerprintjs';

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

// Supabase row shape (snake_case)
interface DbUser {
 id: string;
 username: string;
 password_hash: string;
 role: 'superadmin' | 'admin' | 'user';
 is_active: boolean;
 session_token?: string | null;
 ext_session_token?: string | null;
 created_at: string;
 created_by: string;
}

interface AuthSession {
 username: string;
 loginAt: number;
 sessionToken: string;
 role?: 'superadmin' | 'admin' | 'user';
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
 updateUserAccount: (oldUsername: string, newUsername?: string, newPassword?: string, newRole?: 'user' | 'admin' | 'superadmin') => Promise<{success: boolean; message: string}>;
 toggleUserActive: (username: string) => Promise<void>;
 resetUserDevice: (username: string) => Promise<void>;
 resetExtensionSession: (username: string) => Promise<void>;
 getAllUsers: () => AuthUser[];
 updateOwnAccount: (oldPassword: string, newUsername?: string, newPassword?: string) => Promise<{ success: boolean; message: string }>;
 logError: (message: string, aiModel: string, details: string, promptStyle?: string, origin?: string) => Promise<void>;
 onlineUsers: string[];
}

// --- Constants ---
const STORAGE_KEY_SESSION = 'auth_session';
const STORAGE_KEY_DEVICE = 'device_id';
const ADMIN_USERNAME = 'admin';
const ADMIN_DEFAULT_PASSWORD = 'Admin@Sebelas11';

// --- Context ---
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// --- Mapper: DB row → AuthUser ---
const mapDbUser = (row: DbUser): AuthUser => ({
 id: row.id,
 username: row.username,
 passwordHash: row.password_hash,
 role: row.role,
 isActive: row.is_active,
 sessionToken: row.session_token || null,
 extSessionToken: row.ext_session_token || null,
 createdAt: new Date(row.created_at).getTime(),
 createdBy: row.created_by,
});

// --- Provider ---
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [users, setUsers] = useState<AuthUser[]>([]);
 const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
 try {
 const sessionRaw = localStorage.getItem(STORAGE_KEY_SESSION);
 if (sessionRaw) {
 const session = JSON.parse(sessionRaw);
 return {
 username: session.username,
 role: session.role || 'user',
 isActive: true,
 id: '',
 passwordHash: '',
 createdAt: 0,
 createdBy: '',
 sessionToken: session.sessionToken
 };
 }
 } catch (e) {}
 return null;
 });
 const [isLoading, setIsLoading] = useState(() => {
 try {
 return !localStorage.getItem(STORAGE_KEY_SESSION);
 } catch (e) {
 return true;
 }
 });
 const [onlineUsers, setOnlineUsers] = useState<string[]>([]);

 // Fetch all users from Supabase
 const fetchUsers = useCallback(async (): Promise<AuthUser[]> => {
 const { data, error } = await supabase
 .from('auth_users')
 .select('*')
 .order('created_at', { ascending: true });

 if (error) {
 console.error('[Auth] Failed to fetch users:', error.message);
 return [];
 }
 return (data as DbUser[]).map(mapDbUser);
 }, []);

 // Bootstrap: seed admin if not exists & restore session
 useEffect(() => {
 const bootstrap = async () => {
 const hasSession = !!localStorage.getItem(STORAGE_KEY_SESSION);
 if (!hasSession) {
 setIsLoading(true);
 }

 // Check if ANY admin exists
 const { data: existingAdmins } = await supabase
 .from('auth_users')
 .select('id')
 .in('role', ['superadmin', 'admin'])
 .limit(1);

 if (!existingAdmins || existingAdmins.length === 0) {
 // Seed superadmin account
 const adminHash = await hashPassword(ADMIN_DEFAULT_PASSWORD);
 await supabase.from('auth_users').insert({
 username: ADMIN_USERNAME,
 password_hash: adminHash,
 role: 'superadmin',
 is_active: true,
 created_by: 'system',
 });
 }

 // Load all users into state
 const allUsers = await fetchUsers();
 setUsers(allUsers);

 // Ensure device ID exists using FingerprintJS
 let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE);
 if (!deviceId) {
 try {
 const fp = await fpPromise.load();
 const result = await fp.get();
 if (result.visitorId) {
 deviceId = result.visitorId;
 } else {
 deviceId = crypto.randomUUID();
 }
 } catch (err) {
 deviceId = crypto.randomUUID();
 }
 localStorage.setItem(STORAGE_KEY_DEVICE, deviceId);
 }

 // Restore session from localStorage
 try {
 const sessionRaw = localStorage.getItem(STORAGE_KEY_SESSION);
 if (sessionRaw) {
 const session: AuthSession = JSON.parse(sessionRaw);
 const sessionUser = allUsers.find(
 u => u.username.toLowerCase() === session.username.toLowerCase()
 );

 if (allUsers.length === 0) {
 // Kemungkinan besar network error saat fetchUsers, jangan log out user secara paksa
 // Kita anggap user valid sementara sampai fetch berikutnya
 setCurrentUser({ username: session.username, role: 'user', isActive: true, id: '', passwordHash: '', createdAt: 0, createdBy: '', sessionToken: session.sessionToken });
 setIsLoading(false);
 return;
 }
 
 if (sessionUser && sessionUser.isActive) {
 // SINGLE DEVICE CHECK:
 if (sessionUser.sessionToken === deviceId) {
 setCurrentUser(sessionUser);
 } else {
 // Token mismatch = user locked to another device or reset
 console.warn('[Auth] Device ID mismatch. Logging out.');
 localStorage.removeItem(STORAGE_KEY_SESSION);
 }
 } else {
 localStorage.removeItem(STORAGE_KEY_SESSION);
 }
 }
 } catch {
 localStorage.removeItem(STORAGE_KEY_SESSION);
 }

 setIsLoading(false);
 };

 bootstrap();
 }, [fetchUsers]);

 // Window focus listener to re-validate session (kicks user out immediately if they return to tab after logging in elsewhere)
 useEffect(() => {
 const handleFocus = async () => {
 if (!currentUser) return;
 
 const sessionRaw = localStorage.getItem(STORAGE_KEY_SESSION);
 if (!sessionRaw) {
 setCurrentUser(null);
 return;
 }

 try {
 const session: AuthSession = JSON.parse(sessionRaw);
 
 let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE);

 // Fetch specific user to get latest token
 const { data } = await supabase
 .from('auth_users')
 .select('session_token, is_active')
 .eq('username', currentUser.username)
 .maybeSingle();

 if (!data || !data.is_active || data.session_token !== deviceId) {
 console.warn('[Auth] Token changed in DB. Logging out current device.');
 localStorage.removeItem(STORAGE_KEY_SESSION);
 setCurrentUser(null);
 }
 } catch (e) {}
 };

 window.addEventListener('focus', handleFocus);
 return () => window.removeEventListener('focus', handleFocus);
 }, [currentUser]);

 // Handle Supabase Presence for Realtime Online Users
 useEffect(() => {
    if (!currentUser?.username) {
      setOnlineUsers([]);
      return;
    }

    const channel = supabase.channel('online-users', {
      config: {
        presence: {
          key: currentUser.username,
        },
      },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const users = Object.keys(state);
      setOnlineUsers(users);
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      setOnlineUsers(prev => {
        const joined = newPresences.map((p: any) => p.user);
        const updated = new Set([...prev, ...joined]);
        return Array.from(updated);
      });
    });

    channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
      setOnlineUsers(prev => {
        const left = new Set(leftPresences.map((p: any) => p.user));
        return prev.filter(u => !left.has(u));
      });
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ user: currentUser.username, online_at: new Date().toISOString() });
      }
    });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.username]);

 // Re-sync current user from fresh user list
 const syncCurrentUser = useCallback((freshUsers: AuthUser[]) => {
 setCurrentUser(prev => {
 if (!prev) return null;
 return freshUsers.find(u => u.username === prev.username) ?? null;
 });
 }, []);

 // --- login ---
 const login = useCallback(
 async (username: string, password: string): Promise<{ success: boolean; message: string }> => {
 const trimmed = username.trim();

 // Always re-fetch from Supabase for up-to-date status
 const { data, error } = await supabase
 .from('auth_users')
 .select('*')
 .eq('username', trimmed)
 .maybeSingle();

 if (error) {
 return { success: false, message: 'Gagal terhubung ke server. Coba lagi.' };
 }
 if (!data) {
 return { success: false, message: 'Username tidak ditemukan.' };
 }

 const user = mapDbUser(data as DbUser);

 if (!user.isActive) {
 return { success: false, message: 'Akun ini telah dinonaktifkan. Hubungi admin.' };
 }

 // Ensure local device ID exists
 let deviceId = localStorage.getItem(STORAGE_KEY_DEVICE);
 try {
 const fp = await fpPromise.load();
 const result = await fp.get();
 if (result.visitorId) {
 deviceId = result.visitorId;
 localStorage.setItem(STORAGE_KEY_DEVICE, deviceId);
 }
 } catch (err) {
 console.error('[Auth] Failed to generate fingerprint during login:', err);
 if (!deviceId) {
 deviceId = crypto.randomUUID();
 localStorage.setItem(STORAGE_KEY_DEVICE, deviceId);
 }
 }

 const inputHash = await hashPassword(password);
 if (inputHash !== user.passwordHash) {
 return { success: false, message: 'Password salah.' };
 }

 // DEVICE LOCK CHECK
 if (user.sessionToken && user.sessionToken !== deviceId) {
 return { success: false, message: 'Akun ini sedang terhubung di perangkat lain. Hubungi admin untuk mereset perangkat.' };
 }

 // Set DB session_token to this device ID if not already locked
 if (!user.sessionToken) {
 await supabase
 .from('auth_users')
 .update({ session_token: deviceId })
 .eq('username', user.username);
 }

 // Refresh full user list and store session
 const allUsers = await fetchUsers();
 setUsers(allUsers);

 const session: AuthSession = { username: user.username, loginAt: Date.now(), sessionToken: deviceId, role: user.role };
 localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
 setCurrentUser({ ...user, sessionToken: deviceId });
 return { success: true, message: 'Login berhasil.' };
 },
 [fetchUsers]
 );

 // --- logout ---
 const logout = useCallback(async () => {
 if (currentUser) {
 await supabase
 .from('auth_users')
 .update({ session_token: null })
 .eq('username', currentUser.username);
 }
 localStorage.removeItem(STORAGE_KEY_SESSION);
 setCurrentUser(null);
 }, [currentUser]);

 // --- createUser ---
 const createUser = useCallback(
 async (username: string, password: string, role: 'admin' | 'user' = 'user'): Promise<{ success: boolean; message: string }> => {
 if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif.' };

 if (role === 'admin' && currentUser.role !== 'superadmin') {
 return { success: false, message: 'Akses ditolak. Hanya Superadmin yang dapat membuat Admin.' };
 }

 const trimmed = username.trim();
 if (!trimmed) return { success: false, message: 'Username tidak boleh kosong.' };
 if (trimmed.length < 3) return { success: false, message: 'Username minimal 3 karakter.' };
 if (password.length < 6) return { success: false, message: 'Password minimal 6 karakter.' };

 // Check duplicate (case-insensitive)
 const { data: existing } = await supabase
 .from('auth_users')
 .select('id')
 .ilike('username', trimmed)
 .maybeSingle();

 if (existing) return { success: false, message: 'Username sudah digunakan.' };

 const passwordHash = await hashPassword(password);
 const { error } = await supabase.from('auth_users').insert({
 username: trimmed,
 password_hash: passwordHash,
 role: role,
 is_active: true,
 created_by: currentUser.username,
 });

 if (error) return { success: false, message: 'Gagal membuat akun: ' + error.message };

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 return { success: true, message: `Akun "${trimmed}" berhasil dibuat.` };
 },
 [currentUser, fetchUsers]
 );

 // --- deleteUser ---
 const deleteUser = useCallback(
 async (username: string) => {
 const target = users.find(u => u.username === username);
 if (!target || !currentUser) return;
 
 if (target.role === 'superadmin') return;
 if (target.role === 'admin' && currentUser.role !== 'superadmin') return;

 await supabase.from('auth_users').delete().eq('username', username);
 const allUsers = await fetchUsers();
 setUsers(allUsers);
 syncCurrentUser(allUsers);
 },
 [users, currentUser, fetchUsers, syncCurrentUser]
 );

 // --- updateUserAccount ---
 const updateUserAccount = useCallback(
 async (oldUsername: string, newUsername?: string, newPassword?: string, newRole?: 'user' | 'admin' | 'superadmin'): Promise<{ success: boolean; message: string }> => {
 const target = users.find(u => u.username === oldUsername);
 if (!target || !currentUser) return { success: false, message: 'Pengguna tidak ditemukan.' };
 
 if (target.role === 'superadmin' && currentUser.role !== 'superadmin') return { success: false, message: 'Akses ditolak.' };
 if (target.role === 'admin' && currentUser.role !== 'superadmin') {
 return { success: false, message: 'Akses ditolak.' };
 }

 const updates: any = {};
 
 if (newUsername && newUsername !== oldUsername) {
 const trimmedNew = newUsername.trim();
 if (trimmedNew === '') return { success: false, message: 'Username tidak valid.' };
 
 // Check if exists
 const { data: existing } = await supabase
 .from('auth_users')
 .select('id')
 .ilike('username', trimmedNew)
 .maybeSingle();
 
 if (existing && existing.id !== target.id) {
 return { success: false, message: 'Username sudah digunakan oleh akun lain.' };
 }
 updates.username = trimmedNew;
 }
 
 if (newPassword && newPassword.length > 0) {
 if (newPassword.length < 6) return { success: false, message: 'Password minimal 6 karakter.' };
 updates.password_hash = await hashPassword(newPassword);
 }
 
 if (newRole && newRole !== target.role) {
 if (currentUser.role !== 'superadmin') {
 return { success: false, message: 'Hanya superadmin yang dapat mengubah role.' };
 }
 if (newRole === 'superadmin') {
 return { success: false, message: 'Tidak dapat menambahkan superadmin baru.' };
 }
 updates.role = newRole;
 }
 
 if (Object.keys(updates).length === 0) {
 return { success: true, message: 'Tidak ada perubahan.' };
 }

 const { error } = await supabase
 .from('auth_users')
 .update(updates)
 .eq('username', oldUsername);

 if (error) {
 return { success: false, message: 'Gagal memperbarui akun: ' + error.message };
 }

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 syncCurrentUser(allUsers);
 return { success: true, message: 'Akun berhasil diperbarui.' };
 },
 [users, currentUser, fetchUsers, syncCurrentUser]
 );

 // --- toggleUserActive ---
 const toggleUserActive = useCallback(
 async (username: string) => {
 const target = users.find(u => u.username === username);
 if (!target || !currentUser) return;

 if (target.role === 'superadmin') return;
 if (target.role === 'admin' && currentUser.role !== 'superadmin') return;

 await supabase
 .from('auth_users')
 .update({ is_active: !target.isActive })
 .eq('username', username);

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 syncCurrentUser(allUsers);
 },
 [users, currentUser, fetchUsers, syncCurrentUser]
 );

 // --- resetUserDevice ---
 const resetUserDevice = useCallback(
 async (username: string) => {
 const target = users.find(u => u.username === username);
 if (!target || !currentUser) return;

 if (target.role === 'superadmin' && currentUser.role !== 'superadmin') return;
 if (target.role === 'admin' && currentUser.role !== 'superadmin') return;

 await supabase
 .from('auth_users')
 .update({ session_token: null })
 .eq('username', username);

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 syncCurrentUser(allUsers);
 },
 [users, currentUser, fetchUsers, syncCurrentUser]
 );

 // --- resetExtensionSession ---
 const resetExtensionSession = useCallback(
 async (username: string) => {
 const target = users.find(u => u.username === username);
 if (!target || !currentUser) return;

 if (target.role === 'superadmin' && currentUser.role !== 'superadmin') return;
 if (target.role === 'admin' && currentUser.role !== 'superadmin') return;

 await supabase
 .from('auth_users')
 .update({ ext_session_token: null })
 .eq('username', username);

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 syncCurrentUser(allUsers);
 },
 [users, currentUser, fetchUsers, syncCurrentUser]
 );

 // --- getAllUsers ---
 const getAllUsers = useCallback((): AuthUser[] => users, [users]);

 // --- updateOwnAccount ---
 const updateOwnAccount = useCallback(
 async (oldPassword: string, newUsername?: string, newPassword?: string): Promise<{ success: boolean; message: string }> => {
 if (!currentUser) return { success: false, message: 'Tidak ada sesi aktif.' };

 if (!newUsername && !newPassword) {
 return { success: false, message: 'Tidak ada perubahan.' };
 }

 const oldHash = await hashPassword(oldPassword);
 if (oldHash !== currentUser.passwordHash) {
 return { success: false, message: 'Password lama salah.' };
 }

 const updates: any = {};
 
 if (newUsername && newUsername !== currentUser.username) {
 const trimmedNew = newUsername.trim();
 if (trimmedNew === '') return { success: false, message: 'Username tidak valid.' };
 
 const { data: existing } = await supabase
 .from('auth_users')
 .select('id')
 .ilike('username', trimmedNew)
 .maybeSingle();
 
 if (existing && existing.id !== currentUser.id) {
 return { success: false, message: 'Username sudah digunakan oleh akun lain.' };
 }
 updates.username = trimmedNew;
 }
 
 let newHash = currentUser.passwordHash;
 if (newPassword && newPassword.length > 0) {
 if (newPassword.length < 6) return { success: false, message: 'Password baru minimal 6 karakter.' };
 newHash = await hashPassword(newPassword);
 updates.password_hash = newHash;
 }

 if (Object.keys(updates).length === 0) {
 return { success: true, message: 'Tidak ada perubahan.' };
 }

 const { error } = await supabase
 .from('auth_users')
 .update(updates)
 .eq('id', currentUser.id);

 if (error) return { success: false, message: 'Gagal memperbarui akun: ' + error.message };

 const allUsers = await fetchUsers();
 setUsers(allUsers);
 const updatedSessionUser = allUsers.find(u => u.id === currentUser.id) || null;
 setCurrentUser(updatedSessionUser);
 
 // Update session storage if username changed
 if (updates.username && updatedSessionUser) {
 const sessionRaw = localStorage.getItem(STORAGE_KEY_SESSION);
 if (sessionRaw) {
 const session: AuthSession = JSON.parse(sessionRaw);
 session.username = updatedSessionUser.username;
 session.role = updatedSessionUser.role;
 localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
 }
 }

 return { success: true, message: 'Akun berhasil diperbarui.' };
 },
 [currentUser, fetchUsers]
 );

 // --- logError ---
 const logError = useCallback(
 async (message: string, aiModel: string, details: string, promptStyle: string = '', origin: string = 'Web'): Promise<void> => {
 if (!currentUser || !currentUser.sessionToken) return;
 try {
 await logAppError({
 errorMessage: message,
 aiModel,
 errorDetails: details,
 username: currentUser.username,
 sessionToken: currentUser.sessionToken,
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
 isAdmin: currentUser?.role === 'admin' || currentUser?.role === 'superadmin',
 isSuperAdmin: currentUser?.role === 'superadmin',
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






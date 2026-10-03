import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, apiRequest, jsonBody, profileAvatarUrl } from '../lib/api';
import type { AuthContextType, RegisterFormData, User } from '../types/auth';

type ApiUser = {
  id: number;
  email: string;
  username: string;
  display_name?: string | null;
  role: string;
};

type ApiProfile = ApiUser & {
  phone?: string | null;
  avatar_path?: string | null;
  province?: string | null;
  district?: string | null;
  city?: string | null;
  education_class?: string | null;
  faculty?: string | null;
  competition?: string | null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function toUser(value: ApiUser | ApiProfile, current?: User | null): User {
  const avatarPath = 'avatar_path' in value ? value.avatar_path : current?.profile_picture;
  return {
    id: String(value.id),
    name: value.display_name || value.username,
    username: value.username,
    email: value.email,
    phNo: 'phone' in value ? value.phone || '' : current?.phNo || '',
    province: 'province' in value ? value.province || '' : current?.province || '',
    district: 'district' in value ? value.district || '' : current?.district || '',
    city: 'city' in value ? value.city || '' : current?.city || '',
    class: 'education_class' in value ? value.education_class || '' : current?.class || '',
    faculty: 'faculty' in value ? value.faculty || '' : current?.faculty || '',
    competition: 'competition' in value ? value.competition || '' : current?.competition || '',
    role: value.role || current?.role || 'student',
    profile_picture: avatarPath
      ? (/^(https?:|data:|blob:)/i.test(avatarPath) ? avatarPath : profileAvatarUrl(avatarPath))
      : null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiRequest<{ user: ApiUser }>('/auth/me')
      .then(async ({ user: account }) => {
        const baseUser = toUser(account);
        try {
          const { profile } = await apiRequest<{ profile: ApiProfile }>('/profile');
          if (active) setUser(toUser(profile, baseUser));
        } catch {
          if (active) setUser(baseUser);
        }
      })
      .catch((error) => {
        if (!(error instanceof ApiError) || error.status !== 401) console.error('Session restore failed', error);
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (identifier: string, password: string) => {
    if (!identifier.trim() || !password) return false;
    try {
      const result = await apiRequest<{ user: ApiUser }>('/auth/login', {
        method: 'POST',
        body: jsonBody({ login: identifier.trim(), password }),
      });
      const baseUser = toUser(result.user);
      try {
        const { profile } = await apiRequest<{ profile: ApiProfile }>('/profile');
        setUser(toUser(profile, baseUser));
      } catch {
        setUser(baseUser);
      }
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return false;
      throw error;
    }
  };

  const googleLogin = async () => ({
    success: false,
    status: 'unavailable',
    message: 'Google sign-in is not configured yet.',
  });

  const register = async (data: RegisterFormData, profilePhoto?: File | null) => {
    const result = await apiRequest<{
      user: ApiUser;
      verification?: { debug_code?: string } | null;
    }>('/auth/register', {
      method: 'POST',
      body: jsonBody({
        display_name: data.name.trim(),
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        phone: data.phNo.trim(),
        province: data.province,
        district: data.district,
        city: data.city,
        class: data.class,
        faculty: data.faculty,
        competition: data.competition,
      }),
    });

    let photoSaved = !profilePhoto;
    if (profilePhoto) {
      try {
        const body = new FormData();
        body.append('avatar', profilePhoto, profilePhoto.name || 'profile.jpg');
        await apiRequest<{ profile: ApiProfile }>('/profile/avatar', { method: 'POST', body });
        photoSaved = true;
      } catch (error) {
        console.error('Profile photo upload failed after account creation', error);
      }
    }
    // Keep the new account signed out until email verification and an explicit sign-in.
    if (result.verification?.debug_code) sessionStorage.setItem('nl_verification_debug_code', result.verification.debug_code);
    else sessionStorage.removeItem('nl_verification_debug_code');
    return { photoSaved };
  };

  const logout = async () => {
    try {
      await apiRequest<{ message: string }>('/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;
    const next = { ...user, ...userData };
    const result = await apiRequest<{ profile: ApiProfile }>('/profile', {
      method: 'PATCH',
      body: jsonBody({
        display_name: next.name,
        username: next.username,
        phone: next.phNo,
        province: next.province,
        district: next.district,
        city: next.city,
        education_class: next.class,
        faculty: next.faculty,
        competition: next.competition,
      }),
    });
    setUser({ ...next, ...toUser(result.profile, next) });
  };

  const uploadAvatar = async (file: File) => {
    const body = new FormData();
    body.append('avatar', file, file.name || 'profile.jpg');
    const { profile } = await apiRequest<{ profile: ApiProfile }>('/profile/avatar', { method: 'POST', body });
    setUser((current) => current ? toUser(profile, current) : current);
  };

  const removeAvatar = async () => {
    const { profile } = await apiRequest<{ profile: ApiProfile }>('/profile/avatar', { method: 'DELETE' });
    setUser((current) => current ? toUser(profile, current) : current);
  };

  const deleteAccount = async (password: string) => {
    await apiRequest<{ deleted: boolean }>('/profile', {
      method: 'DELETE',
      body: jsonBody({ password }),
    });
    setUser(null);
  };

  if (loading) return <div className="auth-screen grid min-h-[100dvh] place-items-center"><div className="text-center" role="status"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700 dark:border-white/10 dark:border-t-brand-300" /><p className="mt-4 font-display text-xs font-semibold text-ink-500 dark:text-ink-400">Opening your workspace…</p></div></div>;

  return <AuthContext.Provider value={{ user, token: user ? 'cookie-session' : null, login, googleLogin, register, logout, updateUser, uploadAvatar, removeAvatar, deleteAccount, isAuthenticated: !!user }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

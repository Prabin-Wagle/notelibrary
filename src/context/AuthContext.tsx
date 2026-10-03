import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { api, apiMessage } from '../lib/api';
import { AuthContextType, User } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadSession = useCallback(async () => {
    try {
      const response = await api.get('/admin/auth/me');
      setUser(response.data.data.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (location.pathname === '/login') {
      setIsLoading(false);
      return;
    }
    loadSession();
    const unauthorized = () => setUser(null);
    window.addEventListener('admin:unauthorized', unauthorized);
    return () => window.removeEventListener('admin:unauthorized', unauthorized);
  }, [loadSession, location.pathname]);

  const login = useCallback(async (loginValue: string, password: string) => {
    try {
      const response = await api.post('/admin/auth/login', { email: loginValue, password });
      setUser(response.data.data.user);
    } catch (error) {
      throw new Error(apiMessage(error, 'Unable to sign in.'));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/admin/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    token: user ? 'http-only-cookie' : null,
    login,
    logout,
    isAuthenticated: Boolean(user),
    isLoading,
  }), [user, login, logout, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

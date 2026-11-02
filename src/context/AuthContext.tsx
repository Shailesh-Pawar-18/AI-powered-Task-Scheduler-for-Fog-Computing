import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { login as apiLogin, setToken, getToken } from '../api/client';

interface AuthValue {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTok] = useState<string | null>(getToken());

  useEffect(() => {
    const onLogout = () => { setToken(null); setTok(null); };
    window.addEventListener('auth:logout', onLogout);
    return () => window.removeEventListener('auth:logout', onLogout);
  }, []);

  const value = useMemo<AuthValue>(() => ({
    isAuthenticated: !!token,
    login: async (u, p) => {
      await apiLogin(u, p);
      setTok(getToken());
    },
    logout: () => {
      setToken(null);
      setTok(null);
    },
  }), [token]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

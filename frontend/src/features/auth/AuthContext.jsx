import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  currentUserRequest,
  loginRequest,
  logoutRequest,
} from './authApi.js';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const requestVersion = useRef(0);

  const refreshUser = useCallback(async () => {
    const version = ++requestVersion.current;
    setStatus('loading');
    try {
      const currentUser = await currentUserRequest();
      if (requestVersion.current !== version) return currentUser;
      setUser(currentUser);
      setStatus(currentUser ? 'authenticated' : 'unauthenticated');
      return currentUser;
    } catch {
      if (requestVersion.current === version) {
        setUser(null);
        setStatus('unauthenticated');
      }
      return null;
    }
  }, []);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(async (credentials) => {
    const version = ++requestVersion.current;
    const result = await loginRequest(credentials);
    if (result.status !== 200 || !result.user) {
      return { user: null, status: result.status };
    }
    if (requestVersion.current === version) {
      setUser(result.user);
      setStatus('authenticated');
    }
    return { user: result.user, status: result.status };
  }, []);

  const logout = useCallback(async () => {
    await logoutRequest();
    ++requestVersion.current;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  currentUserRequest,
  loginRequest,
  logoutRequest,
  SESSION_ENDED_EVENT,
} from './authApi.js';

// Tabs of the same browser share the session cookie, so they share sign-in
// and sign-out too: no tab keeps showing the previous account's data.
// One channel object per tab sends and receives: a channel never receives its
// own messages, so only the other tabs react.
const AUTH_CHANNEL = 'focusmind-auth';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

/** The auth context, or null outside an AuthProvider (isolated component tests). */
export function useOptionalAuth() {
  return useContext(AuthContext);
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading');
  const requestVersion = useRef(0);
  const channelRef = useRef(null);
  const broadcast = useCallback((message) => {
    try {
      channelRef.current?.postMessage(message);
    } catch {
      // Other tabs still notice on their next request (401).
    }
  }, []);

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

  // Forget the signed-in user locally: protected pages unmount at once.
  const endSession = useCallback(() => {
    ++requestVersion.current;
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  useEffect(() => {
    const onSessionEnded = () => endSession();
    // Back/Forward can restore a frozen page (bfcache): ask the server again.
    const onPageShow = (event) => { if (event.persisted) void refreshUser(); };
    window.addEventListener(SESSION_ENDED_EVENT, onSessionEnded);
    window.addEventListener('pageshow', onPageShow);
    let channel = null;
    try {
      channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(AUTH_CHANNEL) : null;
      channelRef.current = channel;
      if (channel) channel.onmessage = (event) => {
        if (event.data === 'logout') endSession();
        else if (event.data === 'login') void refreshUser();
      };
    } catch {
      channel = null;
    }
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, onSessionEnded);
      window.removeEventListener('pageshow', onPageShow);
      channel?.close();
      channelRef.current = null;
    };
  }, [endSession, refreshUser]);

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
    broadcast('login');
    return { user: result.user, status: result.status };
  }, [broadcast]);

  const logout = useCallback(async () => {
    try {
      await logoutRequest(); // revokes the token on the server and clears the cookie
    } finally {
      // Even if the request failed, nothing private stays on screen.
      endSession();
      broadcast('logout');
    }
  }, [broadcast, endSession]);

  return (
    <AuthContext.Provider value={{ user, status, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

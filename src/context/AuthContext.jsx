import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_user')); } catch { return null; }
  });
  const [wings, setWings] = useState(() => {
    try { return JSON.parse(localStorage.getItem('nexus_wings')) || []; } catch { return []; }
  });
  const [activeWing, setActiveWing] = useState(() => {
    const wings = JSON.parse(localStorage.getItem('nexus_wings') || '[]');
    return wings[0] || null;
  });

  // Refresh wings from server on mount (handles stale localStorage)
  useEffect(() => {
    if (!localStorage.getItem('nexus_token')) return;
    api.get('/auth/me').then(({ data }) => {
      const fresh = data.wings || [];
      localStorage.setItem('nexus_wings', JSON.stringify(fresh));
      setWings(fresh);
      setActiveWing((prev) => prev || fresh[0] || null);
    }).catch(() => {});
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('nexus_token', data.token);
    localStorage.setItem('nexus_user', JSON.stringify(data.user));
    localStorage.setItem('nexus_wings', JSON.stringify(data.wings));
    setUser(data.user);
    setWings(data.wings);
    setActiveWing(data.wings[0] || null);
    return data;
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('nexus_user', JSON.stringify(next));
      return next;
    });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    localStorage.removeItem('nexus_wings');
    setUser(null);
    setWings([]);
    setActiveWing(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, wings, activeWing, setActiveWing, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

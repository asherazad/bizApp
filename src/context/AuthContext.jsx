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
  const [activeWing, setActiveWingState] = useState(() => {
    try {
      const w = JSON.parse(localStorage.getItem('nexus_wings') || '[]');
      const saved = JSON.parse(localStorage.getItem('nexus_active_wing') || 'null');
      if (saved && w.find(x => x.id === saved.id)) return saved;
      return w[0] || null;
    } catch { return null; }
  });

  const setActiveWing = useCallback((wing) => {
    if (wing) localStorage.setItem('nexus_active_wing', JSON.stringify(wing));
    else      localStorage.removeItem('nexus_active_wing');
    setActiveWingState(wing);
  }, []);

  // Refresh wings from server on mount (handles stale localStorage)
  useEffect(() => {
    if (!localStorage.getItem('nexus_token')) return;
    api.get('/auth/me').then(({ data }) => {
      const fresh = data.wings || [];
      localStorage.setItem('nexus_wings', JSON.stringify(fresh));
      setWings(fresh);
      setActiveWingState(prev => {
        if (prev && fresh.find(x => x.id === prev.id)) return prev;
        try {
          const saved = JSON.parse(localStorage.getItem('nexus_active_wing') || 'null');
          if (saved && fresh.find(x => x.id === saved.id)) return saved;
        } catch {}
        return fresh[0] || null;
      });
    }).catch(() => {});
  }, []);

  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('nexus_token', data.token);
    localStorage.setItem('nexus_user', JSON.stringify(data.user));
    localStorage.setItem('nexus_wings', JSON.stringify(data.wings));
    setUser(data.user);
    setWings(data.wings);
    // restore previously selected wing if it still exists, otherwise first wing
    const saved = (() => { try { return JSON.parse(localStorage.getItem('nexus_active_wing') || 'null'); } catch { return null; } })();
    const wing  = (saved && data.wings.find(x => x.id === saved.id)) ? saved : (data.wings[0] || null);
    setActiveWing(wing);
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
    localStorage.removeItem('nexus_active_wing');
    setUser(null);
    setWings([]);
    setActiveWingState(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, wings, activeWing, setActiveWing, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

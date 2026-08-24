import { createContext, useState, useEffect } from 'react';
import API from '../api/axios.js';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsEmailVerification, setNeedsEmailVerification] = useState(false);

  // PHASE 1 §4 — Try to load the user from the httpOnly cookie on mount.
  useEffect(() => {
    let cancelled = false;
    const verify = async () => {
      try {
        const res = await API.get('/user/profile');
        if (!cancelled) setUser(res.data.profile);
      } catch (err) {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    verify();

    const onExpired = () => setUser(null);
    const onNeedsVerification = () => setNeedsEmailVerification(true);

    window.addEventListener('crypnight:auth-expired', onExpired);
    window.addEventListener(
      'crypnight:needs-verification',
      onNeedsVerification
    );

    return () => {
      cancelled = true;
      window.removeEventListener('crypnight:auth-expired', onExpired);
      window.removeEventListener(
        'crypnight:needs-verification',
        onNeedsVerification
      );
    };
  }, []);

  const login = (userObj) => {
    setUser(userObj);
    setNeedsEmailVerification(false);
  };

  const logout = async () => {
    try {
      await API.post('/auth/logout');
    } catch (err) {
      // ignore — cookie is cleared server-side regardless
    }
    setUser(null);
    setNeedsEmailVerification(false);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, loading, needsEmailVerification }}
    >
      {children}
    </AuthContext.Provider>
  );
};

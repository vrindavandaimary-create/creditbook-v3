/**
 * AuthContext.js  (REPLACE: frontend/src/context/AuthContext.js)
 *
 * Only change from original:
 *   logout() also calls clearAllCache() to wipe the IndexedDB cache
 *   so a different user on the same device never sees stale data.
 *   Every other line is identical to the original.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';
import { clearAllCache } from '../utils/offlineDB';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('cb3_token') || null);
  const [user,  setUser]  = useState(() => {
    try { return JSON.parse(localStorage.getItem('cb3_user') || 'null'); }
    catch { return null; }
  });
  const [ready, setReady] = useState(false);

  useEffect(() => { setReady(true); }, []);

  const persist = (tok, usr) => {
    setToken(tok); setUser(usr);
    localStorage.setItem('cb3_token', tok);
    localStorage.setItem('cb3_user', JSON.stringify(usr));
  };

  const verifyOtp = async (phone, otp) => {
    const r = await authAPI.verifyOtp(phone, otp);
    persist(r.data.token, r.data.user);
    return r.data;
  };

  const verifyRegisterOtp = async (phone, otp) => {
    const r = await authAPI.verifyRegisterOtp(phone, otp);
    persist(r.data.token, r.data.user);
    return r.data;
  };

  // UPDATED: clears IndexedDB cache on logout
  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cb3_token');
    localStorage.removeItem('cb3_user');
    clearAllCache().catch(() => {}); // silent — don't block the logout
  };

  const updateUser = (u) => {
    setUser(u);
    localStorage.setItem('cb3_user', JSON.stringify(u));
  };

  return (
    <Ctx.Provider value={{ token, user, ready, verifyOtp, verifyRegisterOtp, logout, updateUser }}>
      {ready ? children : null}
    </Ctx.Provider>
  );
}

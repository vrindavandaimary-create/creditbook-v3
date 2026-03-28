import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../api';

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

  const logout = () => {
    setToken(null); setUser(null);
    localStorage.removeItem('cb3_token');
    localStorage.removeItem('cb3_user');
  };

  const updateUser = (u) => {
    setUser(u);
    localStorage.setItem('cb3_user', JSON.stringify(u));
  };

  return (
    <Ctx.Provider value={{ token, user, ready, verifyOtp, logout, updateUser }}>
      {ready ? children : null}
    </Ctx.Provider>
  );
}

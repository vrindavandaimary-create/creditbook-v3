/**
 * App.js  (REPLACE: frontend/src/App.js)
 *
 * Fixes vs first draft:
 *  1. AppLayout does NOT accept an onLogout prop — logout lives in More.js
 *     which calls useAuth().logout() directly. AppLayout call is unchanged.
 *  2. Offline banner has correct top offset so it doesn't overlap content.
 *  3. getQueueCount imported at top level (not dynamic import) — simpler.
 *  4. All original routes preserved exactly.
 */

import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import AppLayout   from './components/layout/AppLayout';
import Calculator  from './components/Calculator';
import ChatBot     from './components/ChatBot';
import Login       from './pages/auth/Login';
import Register    from './pages/auth/Register';
import Dashboard   from './pages/Dashboard';
import Parties     from './pages/parties/Parties';
import AddParty    from './pages/parties/AddParty';
import PartyDetail from './pages/parties/PartyDetail';
import Reports     from './pages/Reports';
import More        from './pages/More';
import Billing     from './pages/billing/Billing';
import Profile     from './pages/Profile';

import { initConnectivityListeners, syncQueue } from './utils/syncManager';
import { getQueueCount } from './utils/offlineDB';

/* ── Route guards (UNCHANGED from original) ── */
function Private({ children }) {
  const { token } = useAuth();
  return token ? children : <Navigate to="/login" replace />;
}
function Public({ children }) {
  const { token } = useAuth();
  return !token ? children : <Navigate to="/" replace />;
}
function FloatingUI() {
  const { token } = useAuth();
  if (!token) return null;
  return <><Calculator /><ChatBot /></>;
}

/* ── Offline banner ── */
const BANNER_H = 36; // px

function OfflineBanner({ isOnline, pendingCount }) {
  if (isOnline) return null;
  return (
    <div style={{
      position:        'fixed',
      top:             0,
      left:            0,
      right:           0,
      height:          BANNER_H,
      zIndex:          9999,
      background:      '#e53935',
      color:           '#fff',
      display:         'flex',
      alignItems:      'center',
      justifyContent:  'center',
      gap:             6,
      fontSize:        13,
      fontWeight:      700,
      fontFamily:      "'Plus Jakarta Sans', sans-serif",
      padding:         '0 16px',
    }}>
      📴 Offline
      {pendingCount > 0
        ? ` · ${pendingCount} action${pendingCount !== 1 ? 's' : ''} pending sync`
        : ' · Showing cached data'}
    </div>
  );
}

/* ── Inner shell (needs AuthContext, so lives inside AuthProvider) ── */
function AppShell() {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  /* On first load, replay any queue left from a previous offline session */
  useEffect(() => {
    if (navigator.onLine) {
      syncQueue()
        .then(result => {
          if (result.synced > 0) {
            toast.success(
              `✅ ${result.synced} offline action${result.synced !== 1 ? 's' : ''} synced!`
            );
          }
        })
        .catch(() => {});
    }
  }, []);

  /* Wire up online/offline listeners for the lifetime of the app */
  useEffect(() => {
    const cleanup = initConnectivityListeners(async (online, syncResult) => {
      setIsOnline(online);

      if (online) {
        if (syncResult?.synced > 0) {
          toast.success(`✅ Back online! ${syncResult.synced} action${syncResult.synced !== 1 ? 's' : ''} synced.`);
        } else {
          toast.success('✅ Back online!');
        }
        setPendingCount(0);
      } else {
        toast.error('📴 You are offline. Changes will be saved locally.');
        const count = await getQueueCount().catch(() => 0);
        setPendingCount(count);
      }
    });
    return cleanup;
  }, []);

  return (
    <>
      <OfflineBanner isOnline={isOnline} pendingCount={pendingCount} />

      {/*
        Push the entire app down by the banner height when offline,
        so content is never hidden behind the fixed banner.
      */}
      <div style={{ paddingTop: isOnline ? 0 : BANNER_H }}>
        <Routes>
          <Route path="/login"    element={<Public><Login /></Public>} />
          <Route path="/register" element={<Public><Register /></Public>} />

          {/* AppLayout called EXACTLY as in the original — no extra props */}
          <Route path="/" element={<Private><AppLayout /></Private>}>
            <Route index                element={<Dashboard />} />
            <Route path="parties"       element={<Parties />} />
            <Route path="parties/add"   element={<AddParty />} />
            <Route path="parties/:id"   element={<PartyDetail />} />
            <Route path="reports"       element={<Reports />} />
            <Route path="more"          element={<More />} />
            <Route path="more/billing"  element={<Billing />} />
            <Route path="more/profile"  element={<Profile />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <FloatingUI />
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 2800,
            style: {
              borderRadius: '12px',
              fontFamily:   "'Plus Jakarta Sans', sans-serif",
              fontSize:     '14px',
              fontWeight:   '600',
              maxWidth:     '340px',
            },
            success: { iconTheme: { primary: '#1a9e5c', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#e53935', secondary: '#fff' } },
          }}
        />
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  );
}

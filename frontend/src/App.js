/**
 * App.js  –  frontend/src/App.js
 *
 * Added: calls syncAllToCache() on mount (after queue sync) and after
 * reconnect so IndexedDB always has a fresh copy of all data.
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
import { syncAllToCache } from './utils/dataSync';

/* ── Route guards ── */
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
const BANNER_H = 36;

function OfflineBanner({ isOnline, pendingCount }) {
  if (isOnline) return null;
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: BANNER_H,
      zIndex: 9999, background: '#e53935', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 6, fontSize: 13, fontWeight: 700,
      fontFamily: "'Plus Jakarta Sans', sans-serif", padding: '0 16px',
    }}>
      📴 Offline
      {pendingCount > 0
        ? ` · ${pendingCount} action${pendingCount !== 1 ? 's' : ''} pending sync`
        : ' · Showing downloaded data'}
    </div>
  );
}

/* ── Inner shell ── */
function AppShell() {
  const [isOnline,     setIsOnline]     = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const { token } = useAuth();

  /* On first load: replay queue then download all data to IndexedDB */
  useEffect(() => {
    if (!navigator.onLine || !token) return;
    syncQueue()
      .then(result => {
        if (result.synced > 0) {
          toast.success(`✅ ${result.synced} offline action${result.synced !== 1 ? 's' : ''} synced!`);
        }
        // Always refresh the cache after startup sync
        return syncAllToCache();
      })
      .catch(() => {});
  }, [token]);

  /* Online/offline event listeners */
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
        // Re-download all data now that we're back online
        syncAllToCache().catch(() => {});
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
      <div style={{ paddingTop: isOnline ? 0 : BANNER_H }}>
        <Routes>
          <Route path="/login"    element={<Public><Login /></Public>} />
          <Route path="/register" element={<Public><Register /></Public>} />
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
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontSize: '14px', fontWeight: '600', maxWidth: '340px',
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

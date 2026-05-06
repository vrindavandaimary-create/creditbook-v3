import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useOffline } from '../../offline/useOffline';

const NAV = [
  { path:'/', label:'Home', icon: a => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round">
      <path d="M3 12L12 3l9 9"/><path d="M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9"/>
    </svg>
  )},
  { path:'/parties', label:'Parties', icon: a => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round">
      <circle cx="9" cy="7" r="4"/><path d="M2 21v-2a7 7 0 0114 0v2"/>
      <circle cx="19" cy="7" r="3"/><path d="M22 21v-1a5 5 0 00-4-4.9"/>
    </svg>
  )},
  { path:'/reports', label:'Analytics', icon: a => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round">
      <path d="M18 20V10M12 20V4M6 20v-6"/>
    </svg>
  )},
  { path:'/more', label:'More', icon: a => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a?2.5:2} strokeLinecap="round">
      <circle cx="12" cy="5" r="1" fill="currentColor"/>
      <circle cx="12" cy="12" r="1" fill="currentColor"/>
      <circle cx="12" cy="19" r="1" fill="currentColor"/>
    </svg>
  )},
];

export default function AppLayout() {
  const navigate     = useNavigate();
  const { pathname } = useLocation();
  const isActive     = p => p==='/' ? pathname==='/' : pathname.startsWith(p);
  const { isOnline, syncing, pendingCount } = useOffline();

  return (
    <div style={{ maxWidth:'var(--maxw)', margin:'0 auto', minHeight:'100vh', background:'var(--bg)', position:'relative' }}>

      {/* ── Offline / Sync Banner ── */}
      {(!isOnline || syncing || pendingCount > 0) && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '100%',
          maxWidth: 'var(--maxw)',
          zIndex: 999,
          background: syncing ? '#1a4fd6' : !isOnline ? '#e53935' : '#f57c00',
          color: 'white',
          textAlign: 'center',
          padding: '7px 16px',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: .3,
        }}>
          {syncing
            ? '☁️  Syncing changes…'
            : !isOnline
              ? `📴  Offline mode${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`
              : `🕐  ${pendingCount} change${pendingCount>1?'s':''} waiting to sync`}
        </div>
      )}

      <div style={{ paddingTop: (!isOnline || syncing || pendingCount > 0) ? 32 : 0 }}>
        <Outlet />
      </div>

      <nav className="bottom-nav" style={{ height:'var(--nav-h)' }}>
        {NAV.map(item => {
          const active = isActive(item.path);
          return (
            <button key={item.path} className={`nav-item${active?' active':''}`} onClick={() => navigate(item.path)}>
              {item.icon(active)}{item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

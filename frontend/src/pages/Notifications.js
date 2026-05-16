/**
 * Notifications.js  –  frontend/src/pages/Notifications.js
 *
 * Full notification center page.
 * Two tabs:
 *   1. Alerts  — all in-app notifications (read / unread / delete)
 *   2. Reminders — manage all active reminders (snooze / dismiss)
 *
 * Inspired by KhataBook / OkCredit alert centers.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { notificationAPI, reminderAPI } from '../api';

/* ── helpers ── */
const timeAgo = (d) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days === 1 ? 'Yesterday' : `${days} days ago`;
};

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : '—';

const TYPE_COLORS = {
  reminder_due:      { bg: '#fff7e6', border: '#f59e0b', icon: '⏰' },
  payment_received:  { bg: '#e6faf0', border: '#1a9e5c', icon: '💚' },
  balance_settled:   { bg: '#e6faf0', border: '#1a9e5c', icon: '✅' },
  balance_milestone: { bg: '#fff0f0', border: '#e53935', icon: '⚠️' },
  large_transaction: { bg: '#f0f4ff', border: '#1a4fd6', icon: '💰' },
  recurring_checkin: { bg: '#f5f0ff', border: '#7c3aed', icon: '📅' },
};

const REMINDER_TYPE_LABELS = {
  payment_due:       { icon: '📅', label: 'Payment Due' },
  follow_up:         { icon: '🔔', label: 'Follow-Up' },
  balance_milestone: { icon: '⚠️', label: 'Balance Alert' },
  recurring:         { icon: '🔁', label: 'Recurring' },
};

/* ─────────────────────────────────────
   Notification card
───────────────────────────────────── */
function NotifCard({ n, onRead, onDelete, onClick }) {
  const theme = TYPE_COLORS[n.type] || { bg: '#f9f9f9', border: '#ddd', icon: '🔔' };
  return (
    <div
      onClick={() => onClick(n)}
      style={{
        display: 'flex', gap: 12, padding: '14px 16px',
        background: n.isRead ? '#fff' : theme.bg,
        borderLeft: `4px solid ${n.isRead ? '#e0e0e0' : theme.border}`,
        borderBottom: '1px solid #f0f0f0',
        cursor: 'pointer', transition: 'background .15s',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
        background: n.isRead ? '#f5f5f5' : theme.bg,
        border: `1.5px solid ${n.isRead ? '#e0e0e0' : theme.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
      }}>
        {n.icon || theme.icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: n.isRead ? 500 : 700,
          color: '#1a1d2e', lineHeight: 1.35,
        }}>{n.title}</div>
        {n.body && (
          <div style={{ fontSize: 12, color: '#888', marginTop: 3, lineHeight: 1.4 }}>
            {n.body}
          </div>
        )}
        <div style={{ fontSize: 11, color: '#bbb', marginTop: 5 }}>
          {timeAgo(n.createdAt)}
          {n.partyId?.name && <span> · {n.partyId.name}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {!n.isRead && (
          <button onClick={e => { e.stopPropagation(); onRead(n._id); }} style={smallBtn('#1a4fd6')}>
            ✓
          </button>
        )}
        <button onClick={e => { e.stopPropagation(); onDelete(n._id); }} style={smallBtn('#e53935')}>
          ×
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────
   Reminder card
───────────────────────────────────── */
function ReminderCard({ r, onSnooze, onDismiss }) {
  const meta = REMINDER_TYPE_LABELS[r.type] || { icon: '🔔', label: r.type };
  const isOverdue = r.dueDate && new Date(r.dueDate) < new Date();
  return (
    <div style={{
      padding: '14px 16px', borderBottom: '1px solid #f0f0f0',
      background: isOverdue ? '#fff5f5' : '#fff',
      borderLeft: `4px solid ${isOverdue ? '#e53935' : '#1a4fd6'}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: isOverdue ? '#fff0f0' : '#f0f4ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1d2e' }}>{r.title}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
              background: isOverdue ? '#e53935' : '#e8ecff',
              color: isOverdue ? '#fff' : '#1a4fd6',
              textTransform: 'uppercase', letterSpacing: '.3px',
            }}>{meta.label}</span>
          </div>

          {r.partyId?.name && (
            <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>
              Party: <strong>{r.partyId.name}</strong>
              {r.partyId.balance != null && (
                <span style={{ color: r.partyId.balance > 0 ? '#e53935' : '#1a9e5c', marginLeft: 6 }}>
                  ₹{Math.abs(r.partyId.balance).toLocaleString('en-IN')} {r.partyId.balance > 0 ? 'due' : 'advance'}
                </span>
              )}
            </div>
          )}

          <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
            {r.type === 'payment_due'       && `Due: ${fmtDate(r.dueDate)}${isOverdue ? ' 🚨 Overdue' : ''}`}
            {r.type === 'follow_up'         && `Fire after ${r.followUpDays} day${r.followUpDays !== 1 ? 's' : ''} of inactivity`}
            {r.type === 'balance_milestone' && `Threshold: ₹${Number(r.thresholdAmount).toLocaleString('en-IN')}`}
            {r.type === 'recurring'         && `${r.recurringUnit === 'weekly' ? 'Every week' : 'Every month'}`}
          </div>

          {r.isSnoozed && r.snoozeUntil && (
            <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 3 }}>
              😴 Snoozed until {fmtDate(r.snoozeUntil)}
            </div>
          )}

          {r.message && (
            <div style={{ fontSize: 12, color: '#888', marginTop: 4, fontStyle: 'italic' }}>
              "{r.message}"
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingLeft: 50 }}>
        <SnoozeDropdown onSnooze={hrs => onSnooze(r._id, hrs)} />
        <button onClick={() => onDismiss(r._id)} style={{
          flex: 1, padding: '8px 0', borderRadius: 8,
          border: '1.5px solid #e0e0e0', background: '#fafafa',
          color: '#e53935', fontWeight: 700, fontSize: 12, cursor: 'pointer',
        }}>✕ Dismiss</button>
      </div>
    </div>
  );
}

function SnoozeDropdown({ onSnooze }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: '1 hour',  hours: 1 },
    { label: '3 hours', hours: 3 },
    { label: '1 day',   hours: 24 },
    { label: '3 days',  hours: 72 },
    { label: '1 week',  hours: 168 },
  ];
  return (
    <div style={{ position: 'relative', flex: 1 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '8px 0', borderRadius: 8,
        border: '1.5px solid #1a4fd6', background: '#f0f4ff',
        color: '#1a4fd6', fontWeight: 700, fontSize: 12, cursor: 'pointer',
      }}>😴 Snooze ▾</button>
      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 4px)', left: 0,
          background: '#fff', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.14)',
          zIndex: 10, overflow: 'hidden', minWidth: 120, border: '1px solid #e8ecff',
        }}>
          {options.map(o => (
            <button key={o.hours} onClick={() => { onSnooze(o.hours); setOpen(false); }} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 14px', border: 'none', background: 'none',
              fontSize: 13, cursor: 'pointer', color: '#333',
            }}>{o.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────
   Main Page
───────────────────────────────────── */
export default function Notifications() {
  const navigate  = useNavigate();
  const [tab, setTab]         = useState('alerts');
  const [notifs, setNotifs]   = useState([]);
  const [reminders, setReminders] = useState([]);
  const [unread, setUnread]   = useState(0);
  const [loading, setLoading] = useState(true);

  const loadAlerts = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 100 });
      if (res.data?.success) {
        setNotifs(res.data.data);
        setUnread(res.data.unreadCount || 0);
      }
    } catch (_) {}
  }, []);

  const loadReminders = useCallback(async () => {
    try {
      const res = await reminderAPI.getAll({ active: true });
      if (res.data?.success) setReminders(res.data.data);
    } catch (_) {}
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAlerts(), loadReminders()]).finally(() => setLoading(false));
  }, [loadAlerts, loadReminders]);

  const handleRead = async (id) => {
    await notificationAPI.markRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnread(c => Math.max(0, c - 1));
  };

  const handleDeleteNotif = async (id) => {
    const wasUnread = notifs.find(n => n._id === id && !n.isRead);
    await notificationAPI.delete(id).catch(() => {});
    setNotifs(prev => prev.filter(n => n._id !== id));
    if (wasUnread) setUnread(c => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnread(0);
    toast.success('All marked as read');
  };

  const handleClearRead = async () => {
    await notificationAPI.clearRead().catch(() => {});
    setNotifs(prev => prev.filter(n => !n.isRead));
    toast.success('Cleared read notifications');
  };

  const handleClickNotif = (n) => {
    if (!n.isRead) handleRead(n._id);
    if (n.partyId?._id) navigate(`/parties/${n.partyId._id}`);
  };

  const handleSnooze = async (id, hours) => {
    await reminderAPI.snooze(id, hours).catch(() => {});
    toast.success(`😴 Snoozed for ${hours < 24 ? hours + 'h' : hours / 24 + 'd'}`);
    loadReminders();
  };

  const handleDismiss = async (id) => {
    await reminderAPI.dismiss(id).catch(() => {});
    toast.success('Reminder dismissed');
    setReminders(prev => prev.filter(r => r._id !== id));
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '16px 16px 0', marginBottom: 16,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 20, color: '#555', padding: '4px 8px 4px 0',
        }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1a1d2e', flex: 1 }}>
          Notifications
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, margin: '0 16px 16px', borderRadius: 12, background: '#f0f0f0', padding: 4 }}>
        {[
          { key: 'alerts',    label: `Alerts${unread > 0 ? ` (${unread})` : ''}` },
          { key: 'reminders', label: `Reminders${reminders.length > 0 ? ` (${reminders.length})` : ''}` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '9px 0', borderRadius: 10, border: 'none',
            background: tab === t.key ? '#fff' : 'transparent',
            fontWeight: tab === t.key ? 800 : 600,
            color: tab === t.key ? '#1a4fd6' : '#888',
            fontSize: 14, cursor: 'pointer',
            boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}>{t.label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: '#aaa' }}>Loading…</div>
      )}

      {/* ALERTS TAB */}
      {!loading && tab === 'alerts' && (
        <div>
          {notifs.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '0 16px 10px' }}>
              {unread > 0 && (
                <button onClick={handleMarkAll} style={actionBtn('#1a4fd6')}>
                  ✓ Mark all read
                </button>
              )}
              <button onClick={handleClearRead} style={actionBtn('#888')}>
                🗑 Clear read
              </button>
            </div>
          )}
          <div style={{ borderRadius: 16, overflow: 'hidden', margin: '0 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {notifs.length === 0 ? (
              <EmptyState icon="🔔" title="No alerts yet" desc="Notifications about payments, balances and reminders will appear here." />
            ) : (
              notifs.map(n => (
                <NotifCard key={n._id} n={n}
                  onRead={handleRead} onDelete={handleDeleteNotif} onClick={handleClickNotif} />
              ))
            )}
          </div>
        </div>
      )}

      {/* REMINDERS TAB */}
      {!loading && tab === 'reminders' && (
        <div>
          <div style={{ borderRadius: 16, overflow: 'hidden', margin: '0 16px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {reminders.length === 0 ? (
              <EmptyState icon="⏰" title="No active reminders"
                desc="Open a party and tap 'Set Reminder' to schedule payment follow-ups, due date alerts, and more." />
            ) : (
              reminders.map(r => (
                <ReminderCard key={r._id} r={r}
                  onSnooze={handleSnooze} onDismiss={handleDismiss} />
              ))
            )}
          </div>
        </div>
      )}

      <div style={{ height: 40 }} />
    </div>
  );
}

function EmptyState({ icon, title, desc }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center', background: '#fff' }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#333', marginBottom: 8 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>{desc}</div>
    </div>
  );
}

const smallBtn = (color) => ({
  width: 26, height: 26, borderRadius: '50%', border: `1.5px solid ${color}`,
  background: 'none', color, fontWeight: 800, fontSize: 14, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
});

const actionBtn = (color) => ({
  padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${color}`,
  background: 'none', color, fontWeight: 700, fontSize: 12, cursor: 'pointer',
});

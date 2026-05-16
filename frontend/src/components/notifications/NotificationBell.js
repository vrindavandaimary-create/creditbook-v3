/**
 * NotificationBell.js
 *
 * A compact bell icon with an unread-count badge.
 * Clicking opens a dropdown drawer showing recent notifications.
 * Inspired by KhataBook's in-app alert center.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationAPI, reminderAPI } from '../../api';

const POLL_INTERVAL_MS = 60_000; // refresh every 60 seconds

export default function NotificationBell() {
  const [open,        setOpen]        = useState(false);
  const [notifs,      setNotifs]      = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading,     setLoading]     = useState(false);
  const dropRef  = useRef(null);
  const navigate = useNavigate();

  /* Fetch notifications only (no reminder check — that runs once on mount below) */
  const fetchNotifs = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll({ limit: 30 });
      if (res.data?.success) {
        setNotifs(res.data.data);
        setUnreadCount(res.data.unreadCount || 0);
      }
    } catch (_) {}
  }, []);

  /* On mount: fire reminder check ONCE, then start polling for notifications */
  useEffect(() => {
    reminderAPI.check().catch(() => {}); // single check on app load
    fetchNotifs();
    const t = setInterval(fetchNotifs, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [fetchNotifs]);

  /* Close on outside click */
  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = async () => {
    setOpen(o => !o);
    if (!open) {
      setLoading(true);
      await fetchNotifs();
      setLoading(false);
    }
  };

  const handleMarkRead = async (id) => {
    await notificationAPI.markRead(id).catch(() => {});
    setNotifs(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
    setUnreadCount(c => Math.max(0, c - 1));
  };

  const handleMarkAll = async () => {
    await notificationAPI.markAllRead().catch(() => {});
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    await notificationAPI.delete(id).catch(() => {});
    setNotifs(prev => prev.filter(n => n._id !== id));
    const wasUnread = notifs.find(n => n._id === id && !n.isRead);
    if (wasUnread) setUnreadCount(c => Math.max(0, c - 1));
  };

  const goToParty = (n) => {
    if (n.partyId?._id) {
      handleMarkRead(n._id);
      navigate(`/parties/${n.partyId._id}`);
      setOpen(false);
    }
  };

  const timeAgo = (d) => {
    const diff = Date.now() - new Date(d).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div ref={dropRef} style={{ position: 'relative', display: 'inline-block' }}>
      {/* Bell Button */}
      <button
        onClick={handleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', padding: '6px', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.2s',
        }}
        aria-label="Notifications"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke={unreadCount > 0 ? '#1a4fd6' : '#666'} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: 2, right: 2,
            background: '#e53935', color: '#fff',
            borderRadius: '50%', width: 16, height: 16,
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, border: '2px solid #fff',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: 320, maxHeight: 420,
          background: '#fff', borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          overflow: 'hidden', zIndex: 1000,
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          border: '1px solid #e8ecff',
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px', borderBottom: '1px solid #f0f0f0',
          }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#1a1d2e' }}>
              Notifications {unreadCount > 0 && (
                <span style={{
                  background: '#1a4fd6', color: '#fff',
                  borderRadius: 999, padding: '1px 7px', fontSize: 11, marginLeft: 6,
                }}>{unreadCount}</span>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {unreadCount > 0 && (
                <button onClick={handleMarkAll} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: '#1a4fd6', fontWeight: 600, padding: '2px 6px',
                }}>Mark all read</button>
              )}
              <button onClick={() => { setOpen(false); navigate('/notifications'); }} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: '#888', fontWeight: 600, padding: '2px 6px',
              }}>See all</button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', maxHeight: 340 }}>
            {loading && (
              <div style={{ padding: 20, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                Loading…
              </div>
            )}
            {!loading && notifs.length === 0 && (
              <div style={{ padding: '28px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🔔</div>
                <div style={{ color: '#aaa', fontSize: 13 }}>No notifications yet</div>
              </div>
            )}
            {!loading && notifs.map(n => (
              <div
                key={n._id}
                onClick={() => goToParty(n)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px',
                  background: n.isRead ? '#fff' : '#f0f4ff',
                  borderBottom: '1px solid #f5f5f5',
                  cursor: n.partyId ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: n.isRead ? '#f5f5f5' : '#e8ecff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, flexShrink: 0,
                }}>
                  {n.icon || '🔔'}
                </div>
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: n.isRead ? 500 : 700,
                    color: '#1a1d2e', lineHeight: 1.3,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {n.title}
                  </div>
                  {n.body && (
                    <div style={{
                      fontSize: 12, color: '#888', marginTop: 2,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.body}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: '#bbb', marginTop: 3 }}>
                    {timeAgo(n.createdAt)}
                    {n.partyId?.name && <span> · {n.partyId.name}</span>}
                  </div>
                </div>
                {/* Delete */}
                <button
                  onClick={(e) => handleDelete(n._id, e)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#ccc', fontSize: 15, padding: '0 2px', flexShrink: 0,
                    lineHeight: 1,
                  }}
                  title="Dismiss"
                >×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * ReminderModal.js
 *
 * Modal for creating a new reminder for a specific party.
 * Supports all four types: payment_due, follow_up, balance_milestone, recurring.
 * Inspired by KhataBook's "Set Reminder" flow and OkCredit's payment nudge feature.
 */

import React, { useState } from 'react';
import { reminderAPI } from '../../api';
import toast from 'react-hot-toast';

const TYPES = [
  { value: 'payment_due',       label: '📅 Payment Due',       desc: 'Alert when a due date is approaching' },
  { value: 'follow_up',         label: '🔔 Follow-Up',          desc: 'Remind after days of no activity' },
  { value: 'balance_milestone', label: '⚠️ Balance Alert',      desc: 'Alert when balance crosses a threshold' },
  { value: 'recurring',         label: '🔁 Recurring Check-in', desc: 'Weekly or monthly nudge' },
];

export default function ReminderModal({ party, onClose, onCreated }) {
  const [type,       setType]       = useState('payment_due');
  const [title,      setTitle]      = useState('');
  const [message,    setMessage]    = useState('');
  const [dueDate,    setDueDate]    = useState('');
  const [followUpDays, setFollowUpDays] = useState(7);
  const [threshold,  setThreshold]  = useState('');
  const [recurring,  setRecurring]  = useState('weekly');
  const [saving,     setSaving]     = useState(false);

  /* Auto-fill title when type changes */
  const handleTypeChange = (t) => {
    setType(t);
    const defaults = {
      payment_due:       `Payment due – ${party.name}`,
      follow_up:         `Follow up with ${party.name}`,
      balance_milestone: `Balance alert – ${party.name}`,
      recurring:         `Check-in with ${party.name}`,
    };
    setTitle(defaults[t] || '');
  };

  const handleSave = async () => {
    if (!title.trim()) return toast.error('Title is required.');
    setSaving(true);
    try {
      const payload = {
        partyId: party._id, type, title: title.trim(), message: message.trim(),
        ...(type === 'payment_due'       && { dueDate }),
        ...(type === 'follow_up'         && { followUpDays: Number(followUpDays) }),
        ...(type === 'balance_milestone' && { thresholdAmount: Number(threshold) }),
        ...(type === 'recurring'         && { recurringUnit: recurring }),
      };
      const res = await reminderAPI.create(payload);
      if (res.data?.success) {
        toast.success('✅ Reminder set!');
        onCreated?.(res.data.data);
        onClose();
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to set reminder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.45)', display: 'flex',
      alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '20px 20px 0 0',
          width: '100%', maxWidth: 480, padding: '24px 20px 32px',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          maxHeight: '90vh', overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{ width: 40, height: 4, background: '#e0e0e0', borderRadius: 2, margin: '0 auto 20px' }} />

        <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1a1d2e', marginBottom: 4 }}>
          Set Reminder
        </h2>
        <p style={{ fontSize: 13, color: '#888', marginBottom: 20 }}>
          For <strong>{party.name}</strong> · Balance: ₹{Math.abs(party.balance || 0).toLocaleString('en-IN')}
          {(party.balance || 0) > 0 ? ' Due' : (party.balance || 0) < 0 ? ' Advance' : ' (Settled)'}
        </p>

        {/* Type Selector */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          {TYPES.map(t => (
            <button key={t.value} onClick={() => handleTypeChange(t.value)} style={{
              padding: '10px 12px', borderRadius: 12, textAlign: 'left',
              border: `2px solid ${type === t.value ? '#1a4fd6' : '#e8e8e8'}`,
              background: type === t.value ? '#f0f4ff' : '#fafafa',
              cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: type === t.value ? '#1a4fd6' : '#333' }}>
                {t.label}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.desc}</div>
            </button>
          ))}
        </div>

        {/* Title */}
        <label style={labelStyle}>Title</label>
        <input value={title} onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Collect payment from Ramesh" style={inputStyle} />

        {/* Type-specific fields */}
        {type === 'payment_due' && (
          <>
            <label style={labelStyle}>Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inputStyle} />
          </>
        )}
        {type === 'follow_up' && (
          <>
            <label style={labelStyle}>Days of inactivity before reminding</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {[3, 7, 14, 30].map(d => (
                <button key={d} onClick={() => setFollowUpDays(d)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 10,
                  border: `2px solid ${followUpDays === d ? '#1a4fd6' : '#e8e8e8'}`,
                  background: followUpDays === d ? '#1a4fd6' : '#fafafa',
                  color: followUpDays === d ? '#fff' : '#555',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}>{d}d</button>
              ))}
            </div>
          </>
        )}
        {type === 'balance_milestone' && (
          <>
            <label style={labelStyle}>Alert when balance exceeds (₹)</label>
            <input type="number" value={threshold} onChange={e => setThreshold(e.target.value)}
              placeholder="e.g. 5000" style={inputStyle} min={1} />
          </>
        )}
        {type === 'recurring' && (
          <>
            <label style={labelStyle}>Frequency</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {['weekly', 'monthly'].map(u => (
                <button key={u} onClick={() => setRecurring(u)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 10,
                  border: `2px solid ${recurring === u ? '#1a4fd6' : '#e8e8e8'}`,
                  background: recurring === u ? '#1a4fd6' : '#fafafa',
                  color: recurring === u ? '#fff' : '#555',
                  fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}>{u}</button>
              ))}
            </div>
          </>
        )}

        {/* Optional note */}
        <label style={labelStyle}>Note (optional)</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Extra context for this reminder…"
          rows={2} style={{ ...inputStyle, resize: 'none' }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '14px 0', borderRadius: 12,
            border: '1.5px solid #e0e0e0', background: '#fafafa',
            fontWeight: 700, fontSize: 15, cursor: 'pointer', color: '#555',
          }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '14px 0', borderRadius: 12,
            border: 'none', background: saving ? '#ccc' : '#1a4fd6',
            color: '#fff', fontWeight: 800, fontSize: 15, cursor: saving ? 'not-allowed' : 'pointer',
          }}>
            {saving ? 'Saving…' : '🔔 Set Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 700,
  color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px',
};
const inputStyle = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1.5px solid #e0e0e0', fontSize: 14, outline: 'none',
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  marginBottom: 16, boxSizing: 'border-box', color: '#1a1d2e',
};

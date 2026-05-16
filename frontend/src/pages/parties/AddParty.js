/**
 * AddParty.js  –  frontend/src/pages/parties/AddParty.js
 *
 * FIXES:
 *  1. When offline, partyAPI.create() returns { queued:true } with NO _id.
 *     Old: navigate(`/parties/${r.data.data._id}`) → CRASH (undefined)
 *     New: check r.data.queued → navigate to /parties list instead.
 *
 *  2. categoryAPI.getAll() is served from IndexedDB cache when offline
 *     (client.js handles this transparently), so categories still appear.
 *     If there's no cache at all, the "No categories yet" message shows.
 *
 *  3. Offline banner is shown so the user knows they're working offline.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { partyAPI, categoryAPI } from '../../api';

export default function AddParty() {
  const navigate = useNavigate();
  const [sp]     = useSearchParams();
  const initCat  = sp.get('cat') || '';

  const [form,       setForm]       = useState({ name:'', categoryId:initCat, phone:'', address:'', notes:'' });
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [isOffline,  setIsOffline]  = useState(!navigator.onLine);

  /* ── Track connectivity ── */
  useEffect(() => {
    const goOn  = () => setIsOffline(false);
    const goOff = () => setIsOffline(true);
    window.addEventListener('online',  goOn);
    window.addEventListener('offline', goOff);
    return () => {
      window.removeEventListener('online',  goOn);
      window.removeEventListener('offline', goOff);
    };
  }, []);

  /* ── Load categories (cache served by client.js when offline) ── */
  useEffect(() => {
    categoryAPI.getAll()
      .then(r => setCategories(r.data.data || []))
      .catch(() => {}); // silent – cache miss or truly no categories
  }, []);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.categoryId)  return toast.error('Please select a category');
    setLoading(true);
    try {
      const r = await partyAPI.create(form);

      if (r.data?.queued) {
        /* ── OFFLINE PATH ──────────────────────────────────────────
           No real MongoDB _id exists yet — it will be created when
           the queue syncs. Go back to the parties list so the user
           doesn't land on a broken detail page.
        ─────────────────────────────────────────────────────────── */
        toast.success('Party saved offline — will sync when connected.');
        navigate('/parties', { replace: true });
      } else {
        /* ── ONLINE PATH ── */
        toast.success('Party added!');
        navigate(`/parties/${r.data.data._id}`, { replace: true });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add party');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh' }}>
      <div className="grad-blue" style={{ padding:'16px 16px 24px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Add Party</h2>
        </div>
        <p style={{ opacity:.7, fontSize:13, marginTop:4 }}>Add a person or business you deal with</p>
      </div>

      {isOffline && (
        <div style={{
          background:'#fff8e1', borderBottom:'1px solid #ffe082',
          padding:'8px 16px', fontSize:12, color:'#7a5c00',
          display:'flex', alignItems:'center', gap:6,
        }}>
          <span>📶</span> You are offline — party will sync when you reconnect.
        </div>
      )}

      <form onSubmit={submit} style={{ padding:16 }}>
        <div className="field">
          <label>Category *</label>
          <select value={form.categoryId} onChange={set('categoryId')} style={{ fontSize:15, background:'transparent' }}>
            <option value="">Select category…</option>
            {categories.map(c => (
              <option key={c._id} value={c._id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Name *</label>
          <input placeholder="Full name or business name" value={form.name} onChange={set('name')} autoFocus/>
        </div>
        <div className="field">
          <label>Phone</label>
          <input type="tel" placeholder="Mobile number" value={form.phone} onChange={set('phone')} inputMode="numeric"/>
        </div>
        <div className="field">
          <label>Address</label>
          <input placeholder="Address (optional)" value={form.address} onChange={set('address')}/>
        </div>
        <div className="field">
          <label>Notes</label>
          <textarea rows={3} placeholder="Any notes…" value={form.notes} onChange={set('notes')}/>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-full"
          style={{ padding:15, marginTop:6 }}
          disabled={loading}
        >
          {loading ? 'Adding…' : isOffline ? 'Save Offline' : 'Add Party'}
        </button>

        {categories.length === 0 && (
          <p style={{ textAlign:'center', marginTop:14, fontSize:13, color:'var(--text3)' }}>
            No categories yet.{' '}
            <button
              type="button"
              onClick={() => navigate('/')}
              style={{ color:'var(--blue)', fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}
            >
              Go to Home to add one →
            </button>
          </p>
        )}
      </form>
    </div>
  );
}

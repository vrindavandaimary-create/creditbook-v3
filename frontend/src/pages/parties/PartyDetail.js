import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { partyAPI, txAPI, categoryAPI } from '../../api';
import { fmt, avatarLetter, avatarColor, todayStr } from '../../utils/helpers';

const fmtTime = d => new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12:true }).toUpperCase();
const fmtDay  = d => {
  const date = new Date(d);
  const today = new Date(); today.setHours(0,0,0,0);
  const yest  = new Date(today); yest.setDate(today.getDate()-1);
  if (date >= today) return 'Today';
  if (date >= yest)  return 'Yesterday';
  return date.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
};
const dayKey = d => new Date(d).toDateString();

/* ─────────────────────────────────────────
   NUMPAD — clean, no operators
───────────────────────────────────────── */
function Numpad({ value, onChange }) {
  const press = v => {
    if (v === 'del') { onChange(value.slice(0, -1)); return; }
    if (v === '.' && value.includes('.')) return;
    if (value.includes('.') && value.split('.')[1]?.length >= 2) return;
    if (value === '0' && v !== '.') { onChange(v); return; }
    if (value.length >= 10) return;
    onChange(value + v);
  };

  /* 3 cols of digits + 1 col for backspace only — clean OkCredit style */
  const rows = [
    ['1','2','3'],
    ['4','5','6'],
    ['7','8','9'],
    ['.','0','del'],
  ];

  return (
    <div style={{ background:'#f7f7f7', borderTop:'1px solid #e8e8e8' }}>
      {rows.map((row, ri) => (
        <div key={ri} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', borderBottom: ri < rows.length-1 ? '1px solid #e8e8e8':'' }}>
          {row.map(k => {
            const isDel = k === 'del';
            return (
              <button key={k}
                onPointerDown={e => { e.preventDefault(); press(k); }}
                style={{
                  padding: '20px 0',
                  fontSize: isDel ? 20 : 24,
                  fontWeight: isDel ? 400 : 500,
                  fontFamily: 'inherit',
                  background: isDel ? '#fff0f0' : 'white',
                  color: isDel ? '#e53935' : '#1a1d2e',
                  border: 'none',
                  borderRight: '1px solid #e8e8e8',
                  cursor: 'pointer',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  transition: 'background .1s',
                }}>
                {isDel ? '⌫' : k}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   ADD TRANSACTION SCREEN — OkCredit style
───────────────────────────────────────── */
function AddTxScreen({ party, type, onClose, onSaved, navigate, partyId }) {
  const [amount,  setAmount]  = useState('');
  const [note,    setNote]    = useState('');
  const [date,    setDate]    = useState(todayStr());
  const [saving,  setSaving]  = useState(false);
  const dateInputRef = useRef(null);

  const isGot  = type === 'got';
  const accent = isGot ? '#1a9e5c' : '#e53935';

  const fmtDisplayDate = d => new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' });

  const confirm = async () => {
    const n = parseFloat(amount);
    if (!n || n <= 0 || isNaN(n)) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await txAPI.add({ partyId: party._id, type, amount: n, note, date });
      toast.success('Entry saved!');
      onSaved();
    } catch(err) {
      toast.error(err.response?.data?.message || 'Failed');
      setSaving(false);
    }
  };

  const goCreateBill = () => {
    onClose();
    navigate(`/more/billing?party=${partyId}`);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'white', zIndex:500, display:'flex', flexDirection:'column', maxWidth:'var(--maxw)', margin:'0 auto' }}>

      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid #eee', display:'flex', alignItems:'center', gap:12, background:'white' }}>
        <button onClick={onClose} style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#555' }}>←</button>
        <div style={{ flex:1, minWidth:0 }}>
          <h3 style={{ fontWeight:800, fontSize:17, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{party.name}</h3>
          <p style={{ fontSize:12, marginTop:2, fontWeight:600,
            color: party.balance === 0 ? '#888' : party.balance > 0 ? '#e53935' : '#1a9e5c' }}>
            {party.balance === 0 ? 'Settled' : `₹${fmt(Math.abs(party.balance),0)} ${party.balance > 0 ? 'Due' : 'Advance'}`}
          </p>
        </div>
        {/* Type indicator */}
        <div style={{ background: isGot ? '#e8f5e9' : '#ffebee', borderRadius:50, padding:'4px 12px' }}>
          <p style={{ fontSize:12, fontWeight:700, color:accent }}>{isGot ? 'Received' : 'Given'}</p>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex:1, overflowY:'auto', padding:'32px 20px 12px', display:'flex', flexDirection:'column', alignItems:'center' }}>

        {/* Amount display */}
        <div style={{ textAlign:'center', marginBottom:32, width:'100%' }}>
          <p style={{ fontSize:56, fontWeight:700, color: amount ? '#1a1d2e' : '#c8c8c8', lineHeight:1, letterSpacing:-2, fontFamily:'inherit' }}>
            ₹{amount || '0'}
          </p>
          <div style={{ height:2.5, background: accent, borderRadius:2, marginTop:10, width:'70%', margin:'10px auto 0' }}/>
        </div>

        {/* Note field */}
        <div style={{ width:'100%', maxWidth:400, background:'#f5f5f5', borderRadius:16, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, marginBottom:12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <input placeholder="Add notes (optional)" value={note} onChange={e => setNote(e.target.value)}
            style={{ flex:1, background:'none', border:'none', fontSize:15, color:'#333', fontFamily:'inherit', outline:'none' }}/>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/>
          </svg>
        </div>

        {/* Date field */}
        <div onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
          style={{ width:'100%', maxWidth:400, background:'#f5f5f5', borderRadius:16, padding:'14px 18px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', position:'relative' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:11, color:'#aaa', marginBottom:2 }}>Bill Date</p>
            <p style={{ fontSize:15, fontWeight:600, color:'#333' }}>{fmtDisplayDate(date)}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#bbb" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
          <input ref={dateInputRef} type="date" value={date} max={todayStr()}
            onChange={e => setDate(e.target.value)}
            style={{ position:'absolute', opacity:0, width:'100%', height:'100%', top:0, left:0, cursor:'pointer' }}/>
        </div>
      </div>

      {/* Action buttons — Create Bill | Confirm */}
      <div style={{ padding:'12px 16px', display:'flex', gap:10, borderTop:'1px solid #eee', background:'white' }}>
        <button onClick={goCreateBill}
          style={{ flex:1, padding:'14px', borderRadius:50, border:'1.5px solid #ddd', background:'white', fontSize:13, fontWeight:700, color:'#555', fontFamily:'inherit', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
          </svg>
          Create Bill
        </button>
        <button onClick={confirm} disabled={saving || !amount}
          style={{ flex:2, padding:'14px', borderRadius:50, border:'none', background: !amount ? '#e0e0e0' : accent, color: !amount ? '#aaa' : 'white', fontSize:16, fontWeight:800, fontFamily:'inherit', cursor: !amount ? 'not-allowed' : 'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, transition:'background .2s' }}>
          {!saving && <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
          {saving ? 'Saving…' : 'Confirm'}
        </button>
      </div>

      {/* Numpad */}
      <Numpad value={amount} onChange={setAmount}/>
    </div>
  );
}

/* ═════════════════════════════════════════
   MAIN PARTY DETAIL
═════════════════════════════════════════ */
export default function PartyDetail() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [party,      setParty]      = useState(null);
  const [txs,        setTxs]        = useState([]);
  const [cats,       setCats]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [showAddTx,  setShowAddTx]  = useState(null);
  const [showMenu,   setShowMenu]   = useState(false);
  const [showEdit,   setShowEdit]   = useState(false);
  const [showDel,    setShowDel]    = useState(false);
  const [editForm,   setEditForm]   = useState({});
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [delTxId,    setDelTxId]    = useState(null);
  const [deletingTx, setDeletingTx] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, cR] = await Promise.all([partyAPI.getOne(id), categoryAPI.getAll()]);
      setParty(r.data.data.party);
      setTxs(r.data.data.transactions || []);
      setCats(cR.data.data || []);
    } catch { toast.error('Failed to load'); navigate(-1); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const delTx = async () => {
    setDeletingTx(true);
    try { await txAPI.delete(delTxId); toast.success('Entry deleted'); setDelTxId(null); load(); }
    catch { toast.error('Failed'); }
    finally { setDeletingTx(false); }
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) return toast.error('Name required');
    setSaving(true);
    try { await partyAPI.update(id, editForm); toast.success('Updated!'); setShowEdit(false); load(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const delParty = async () => {
    setDeleting(true);
    try { await partyAPI.delete(id); toast.success('Deleted'); navigate('/parties', { replace:true }); }
    catch { toast.error('Failed'); setDeleting(false); }
  };

  if (loading) return <div className="spinner"><div className="spin"/></div>;
  if (!party) return null;

  /* Group txs by day — sorted oldest → newest */
  const groups = [];
  const seen   = {};
  const sorted = [...txs].sort((a,b) => new Date(a.date)-new Date(b.date));
  sorted.forEach(tx => {
    const dk = dayKey(tx.date);
    if (!seen[dk]) { seen[dk] = true; groups.push({ day:dk, label:fmtDay(tx.date), txs:[] }); }
    groups[groups.length-1].txs.push(tx);
  });

  const cat = party.categoryId;

  return (
    <div style={{ background:'#f2f2f2', minHeight:'100vh', display:'flex', flexDirection:'column' }}>

      {/* ── Header ── */}
      <div style={{ background:'white', borderBottom:'1px solid #eee', padding:'12px 16px', display:'flex', alignItems:'center', gap:12, position:'sticky', top:0, zIndex:100 }}>
        <button onClick={() => navigate(-1)}
          style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#444', flexShrink:0 }}>
          ←
        </button>
        <div style={{ width:40, height:40, borderRadius:'50%', background:avatarColor(party.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:18, flexShrink:0 }}>
          {avatarLetter(party.name)}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <h2 style={{ fontSize:17, fontWeight:800, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{party.name}</h2>
          <p style={{ fontSize:11, color:'#aaa', marginTop:1 }}>View Profile</p>
        </div>
        {/* Options button */}
        <button onClick={() => { setShowMenu(true); setEditForm({ name:party.name, categoryId:cat?._id||'', phone:party.phone||'', address:party.address||'', notes:party.notes||'' }); }}
          style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="5" r="1" fill="#555"/><circle cx="12" cy="12" r="1" fill="#555"/><circle cx="12" cy="19" r="1" fill="#555"/>
          </svg>
        </button>
        {party.phone && (
          <a href={`tel:${party.phone}`}
            style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', display:'flex', alignItems:'center', justifyContent:'center', textDecoration:'none', flexShrink:0 }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.68A2 2 0 012 .89h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </a>
        )}
      </div>

      {/* ── Transaction list ── */}
      <div style={{ flex:1, overflowY:'auto', paddingBottom:160 }}>
        {groups.length === 0 ? (
          <div style={{ textAlign:'center', padding:'80px 20px' }}>
            <div style={{ fontSize:52, marginBottom:14 }}>📋</div>
            <p style={{ fontWeight:700, fontSize:17, color:'#333' }}>No entries yet</p>
            <p style={{ fontSize:13, color:'#999', marginTop:6 }}>Tap Received or Given below to add</p>
          </div>
        ) : groups.map(group => (
          <div key={group.day}>
            {/* Date separator */}
            <div style={{ display:'flex', justifyContent:'center', padding:'14px 0 6px' }}>
              <span style={{ background:'#78909c', color:'white', borderRadius:20, padding:'3px 14px', fontSize:11, fontWeight:600 }}>
                {group.label}
              </span>
            </div>

            {/* Bubbles
                ── RECEIVED (got) = LEFT side, DOWN arrow (money coming down to you)
                ── GIVEN (gave)   = RIGHT side, UP arrow (money going up from you) */}
            {group.txs.map(tx => {
              const isGot = tx.type === 'got';
              /* LEFT = received, RIGHT = given */
              return (
                <div key={tx._id}
                  style={{ display:'flex', flexDirection:'column', alignItems: isGot ? 'flex-start' : 'flex-end', padding:'4px 14px' }}>

                  <div onClick={() => setDelTxId(tx._id)}
                    style={{
                      background: 'white',
                      borderRadius: isGot ? '16px 16px 16px 4px' : '16px 16px 4px 16px',
                      border: '1px solid #e8e8e8',
                      padding: '10px 14px',
                      maxWidth: '72%',
                      cursor: 'pointer',
                      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
                    }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      {/* Arrow icon */}
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: isGot ? '#e8f5e9' : '#f5f5f5',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke={isGot ? '#1a9e5c' : '#666'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          {isGot
                            /* DOWN arrow = received */
                            ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
                            /* UP arrow = given */
                            : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
                          }
                        </svg>
                      </div>
                      {/* Amount */}
                      <p style={{ fontSize:22, fontWeight:800, color:'#1a1d2e', letterSpacing:-0.5 }}>
                        ₹{fmt(tx.amount,0)}
                      </p>
                      {/* Time */}
                      <p style={{ fontSize:11, color:'#bbb', marginLeft:2, whiteSpace:'nowrap' }}>
                        {fmtTime(tx.date)}
                      </p>
                      {/* Checkmark */}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#b0bec5" strokeWidth="2.5" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                    {tx.note && (
                      <p style={{ fontSize:12, color:'#999', marginTop:5, marginLeft:38 }}>{tx.note}</p>
                    )}
                  </div>

                  {/* Balance after */}
                  <p style={{ fontSize:11, color:'#aaa', marginTop:4,
                    paddingLeft: isGot ? 4 : 0, paddingRight: isGot ? 0 : 4 }}>
                    ₹{fmt(Math.abs(tx.balanceAfter || 0), 0)} Due
                  </p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ── Bottom bar ── */}
      <div style={{ position:'fixed', bottom:'var(--nav-h)', left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'var(--maxw)', background:'white', borderTop:'1px solid #eee', zIndex:200 }}>
        {/* Balance due */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 18px 8px', borderBottom:'1px solid #f5f5f5' }}>
          <p style={{ fontSize:14, color:'#666', fontWeight:500 }}>Balance Due</p>
          <p style={{ fontSize:16, fontWeight:800, display:'flex', alignItems:'center', gap:4,
            color: party.balance === 0 ? '#1a9e5c' : party.balance > 0 ? '#e53935' : '#1a9e5c' }}>
            {party.balance === 0 ? 'Settled ✓' : `₹${fmt(Math.abs(party.balance), 0)}`}
            {party.balance !== 0 && (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            )}
          </p>
        </div>

        {/* Received | Given buttons */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
          <button onClick={() => setShowAddTx('got')}
            style={{ padding:'16px 0', background:'white', border:'none', borderRight:'1px solid #f0f0f0', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a9e5c" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
            <span style={{ fontSize:15, fontWeight:800, color:'#1a9e5c' }}>Received</span>
          </button>
          <button onClick={() => setShowAddTx('gave')}
            style={{ padding:'16px 0', background:'white', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#e53935" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
            </svg>
            <span style={{ fontSize:15, fontWeight:800, color:'#e53935' }}>Given</span>
          </button>
        </div>
      </div>

      {/* ── Add transaction ── */}
      {showAddTx && (
        <AddTxScreen party={party} type={showAddTx} partyId={id} navigate={navigate}
          onClose={() => setShowAddTx(null)}
          onSaved={() => { setShowAddTx(null); load(); }}/>
      )}

      {/* ── Delete tx confirm ── */}
      {delTxId && (
        <div className="overlay" onClick={() => !deletingTx && setDelTxId(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete this entry?</h3>
            <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>This will reverse the balance change.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setDelTxId(null)} disabled={deletingTx}>Cancel</button>
              <button className="btn btn-red btn-full" onClick={delTx} disabled={deletingTx}>{deletingTx ? 'Deleting…' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Options menu ── */}
      {showMenu && (
        <div className="overlay" onClick={() => setShowMenu(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:16 }}>{party.name}</h3>
            <button className="btn btn-ghost btn-full" style={{ marginBottom:10 }}
              onClick={() => { setShowMenu(false); setShowEdit(true); }}>✏️ &nbsp;Edit Party</button>
            <button className="btn btn-full" style={{ marginBottom:10, background:'var(--blue-lt)', color:'var(--blue)' }}
              onClick={() => { setShowMenu(false); navigate(`/more/billing?party=${id}`); }}>🧾 &nbsp;Create Bill</button>
            <button className="btn btn-full" style={{ marginBottom:10, background:'var(--red-lt)', color:'var(--red)' }}
              onClick={() => { setShowMenu(false); setShowDel(true); }}>🗑️ &nbsp;Delete Party</button>
            <button className="btn btn-ghost btn-full" onClick={() => setShowMenu(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* ── Edit party ── */}
      {showEdit && (
        <div className="overlay" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight:'88vh', overflowY:'auto' }}>
            <h3 style={{ fontWeight:800, marginBottom:16 }}>Edit Party</h3>
            <div className="field">
              <label>Category *</label>
              <select value={editForm.categoryId} onChange={e => setEditForm(f=>({...f,categoryId:e.target.value}))} style={{ fontSize:15, background:'transparent' }}>
                <option value="">Select…</option>
                {cats.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
            {['name','phone','address','notes'].map(k => (
              <div className="field" key={k}>
                <label>{k.charAt(0).toUpperCase()+k.slice(1)}{k==='name'?' *':''}</label>
                {k==='notes'
                  ? <textarea rows={2} value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/>
                  : <input value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/>}
              </div>
            ))}
            <div style={{ display:'flex', gap:10, marginTop:8 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn btn-primary btn-full" onClick={saveEdit} disabled={saving}>{saving?'Saving…':'Save'}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete party confirm ── */}
      {showDel && (
        <div className="overlay" onClick={() => setShowDel(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete {party.name}?</h3>
            <p style={{ color:'var(--text2)', fontSize:13, marginBottom:20 }}>Permanently deletes this party and all their transactions.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setShowDel(false)}>Cancel</button>
              <button className="btn btn-red btn-full" onClick={delParty} disabled={deleting}>{deleting?'Deleting…':'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

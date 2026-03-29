import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { partyAPI, txAPI, categoryAPI } from '../../api';
import { fmt, fmtDateTime, todayStr, avatarLetter, avatarColor, balanceClass } from '../../utils/helpers';

export default function PartyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [party,    setParty]    = useState(null);
  const [txs,      setTxs]      = useState([]);
  const [cats,     setCats]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDel,  setShowDel]  = useState(false);
  const [showAddTx, setShowAddTx] = useState(null); // 'gave'|'got'
  const [editForm, setEditForm] = useState({});
  const [txForm,   setTxForm]   = useState({ amount:'', note:'', date:todayStr() });
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, cR] = await Promise.all([
        partyAPI.getOne(id),
        categoryAPI.getAll(),
      ]);
      setParty(r.data.data.party);
      setTxs(r.data.data.transactions || []);
      setCats(cR.data.data || []);
    } catch { toast.error('Failed to load'); navigate(-1); }
    finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { load(); }, [load]);

  const addTx = async e => {
    e.preventDefault();
    const n = parseFloat(txForm.amount);
    if (!n || n <= 0 || isNaN(n)) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      await txAPI.add({ partyId:id, type:showAddTx, amount:n, note:txForm.note, date:txForm.date });
      toast.success('Entry saved!');
      setShowAddTx(null);
      setTxForm({ amount:'', note:'', date:todayStr() });
      load();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const delTx = async txId => {
    if (!window.confirm('Delete this entry?')) return;
    try { await txAPI.delete(txId); toast.success('Deleted'); load(); }
    catch { toast.error('Failed'); }
  };

  const saveEdit = async () => {
    if (!editForm.name?.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      await partyAPI.update(id, editForm);
      toast.success('Updated!');
      setShowEdit(false);
      load();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const delParty = async () => {
    setDeleting(true);
    try {
      await partyAPI.delete(id);
      toast.success('Party deleted');
      navigate('/parties', { replace:true });
    } catch { toast.error('Failed'); setDeleting(false); }
  };

  if (loading) return <div className="spinner"><div className="spin"/></div>;
  if (!party) return null;

  const isGot = showAddTx === 'got';
  const cat   = party.categoryId;

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>
      {/* Header */}
      <div className="grad-blue" style={{ padding:'16px 16px 20px', color:'white' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
          <button className="back-btn" onClick={()=>navigate(-1)}>←</button>
          <div className="avatar av-sm" style={{ background: avatarColor(party.name) }}>{avatarLetter(party.name)}</div>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ fontSize:18, fontWeight:800, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{party.name}</h2>
            <p style={{ opacity:.7, fontSize:12, marginTop:2 }}>
              {cat && <span style={{ background:'rgba(255,255,255,.2)', borderRadius:8, padding:'1px 8px', marginRight:6 }}>{cat.icon} {cat.name}</span>}
              {party.phone || ''}
            </p>
          </div>
          <button onClick={() => { setShowMenu(true); setEditForm({ name:party.name, categoryId:cat?._id||'', phone:party.phone||'', address:party.address||'', notes:party.notes||'' }); }}
            style={{ background:'rgba(255,255,255,.15)', borderRadius:10, padding:'7px 11px', color:'white', fontSize:18 }}>⋮</button>
        </div>

        {/* Balance */}
        <div style={{ background:'rgba(255,255,255,.13)', borderRadius:14, padding:'14px 16px', textAlign:'center' }}>
          <p style={{ opacity:.75, fontSize:12, marginBottom:4 }}>{party.balance>0?'You will get':party.balance<0?'You will give':'All settled ✅'}</p>
          <p style={{ fontSize:32, fontWeight:800 }}>₹{fmt(Math.abs(party.balance),2)}</p>
        </div>
      </div>

      {/* Transactions */}
      <div style={{ padding:'14px 14px 0' }}>
        {txs.length === 0 ? (
          <div className="empty"><div className="ico">📋</div><h3>No entries yet</h3><p>Use buttons below to record transactions</p></div>
        ) : (
          <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
            {txs.map(tx => (
              <div key={tx._id} className="tx-item">
                <div style={{ flex:1, minWidth:0 }}>
                  <p className="tx-date">{fmtDateTime(tx.date)}</p>
                  {tx.note && <p className="tx-note">{tx.note}</p>}
                  <p style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>Balance: ₹{fmt(tx.balanceAfter||0,2)}</p>
                </div>
                <div style={{ textAlign:'right', marginLeft:10, flexShrink:0 }}>
                  <p className={tx.type==='got'?'amt-pos':'amt-neg'} style={{ fontSize:16 }}>
                    {tx.type==='got'?'+':'-'}₹{fmt(tx.amount,2)}
                  </p>
                  <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{tx.type==='got'?'You received':'You gave'}</p>
                  <button onClick={()=>delTx(tx._id)} style={{ fontSize:10, color:'var(--red)', marginTop:4, padding:'2px 6px', borderRadius:4, background:'var(--bg)', border:'none', cursor:'pointer' }}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom action bar */}
      <div style={{ position:'fixed', bottom:'var(--nav-h)', left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'var(--maxw)', padding:'10px 14px', display:'flex', gap:10, background:'white', borderTop:'1px solid var(--border)', zIndex:200 }}>
        <button className="btn btn-red btn-full" onClick={() => setShowAddTx('gave')}>YOU GAVE ₹</button>
        <button className="btn btn-green btn-full" onClick={() => setShowAddTx('got')}>YOU GOT ₹</button>
      </div>

      {/* Add Transaction Sheet */}
      {showAddTx && (
        <div className="overlay" onClick={() => setShowAddTx(null)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:4, color: isGot?'var(--green-dk)':'var(--red)' }}>
              {isGot ? `You received from ${party.name}` : `You gave to ${party.name}`}
            </h3>
            <p style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>Balance: ₹{fmt(Math.abs(party.balance),2)} ({party.balance>0?'to get':party.balance<0?'to give':'settled'})</p>
            <form onSubmit={addTx}>
              <div className="card" style={{ padding:'14px 18px', marginBottom:12, display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:28, fontWeight:800, color: isGot?'var(--green)':'var(--red)' }}>₹</span>
                <input type="number" inputMode="decimal" placeholder="0.00" value={txForm.amount}
                  onChange={e=>setTxForm(f=>({...f,amount:e.target.value}))} autoFocus min="0.01" step="0.01"
                  style={{ flex:1, fontSize:32, fontWeight:800, color: isGot?'var(--green)':'var(--red)', background:'transparent', border:'none' }}/>
              </div>
              <div className="field"><label>Note (optional)</label><input placeholder="Items, bill no., description…" value={txForm.note} onChange={e=>setTxForm(f=>({...f,note:e.target.value}))}/></div>
              <div className="field"><label>Date</label><input type="date" value={txForm.date} onChange={e=>setTxForm(f=>({...f,date:e.target.value}))} max={todayStr()}/></div>
              <div style={{ display:'flex', gap:10 }}>
                <button type="button" className="btn btn-ghost btn-full" onClick={()=>setShowAddTx(null)}>Cancel</button>
                <button type="submit" className={`btn btn-full ${isGot?'btn-green':'btn-red'}`} disabled={saving}>{saving?'Saving…':'SAVE'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Options menu */}
      {showMenu && (
        <div className="overlay" onClick={() => setShowMenu(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:16 }}>{party.name}</h3>
            <button className="btn btn-ghost btn-full" style={{ marginBottom:10, justifyContent:'flex-start', gap:12 }} onClick={() => { setShowMenu(false); setShowEdit(true); }}>✏️ Edit Party</button>
            <button className="btn btn-full" style={{ marginBottom:10, justifyContent:'flex-start', gap:12, background:'var(--blue-lt)', color:'var(--blue)' }} onClick={() => { setShowMenu(false); navigate(`/more/billing?party=${id}`); }}>🧾 Create Bill</button>
            <button className="btn btn-full" style={{ marginBottom:10, justifyContent:'flex-start', gap:12, background:'var(--red-lt)', color:'var(--red)' }} onClick={() => { setShowMenu(false); setShowDel(true); }}>🗑️ Delete Party</button>
            <button className="btn btn-ghost btn-full" onClick={() => setShowMenu(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Edit sheet */}
      {showEdit && (
        <div className="overlay" onClick={() => setShowEdit(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()} style={{ maxHeight:'85vh', overflowY:'auto' }}>
            <h3 style={{ fontWeight:800, marginBottom:16 }}>Edit Party</h3>
            <div className="field">
              <label>Category *</label>
              <select value={editForm.categoryId} onChange={e=>setEditForm(f=>({...f,categoryId:e.target.value}))} style={{ fontSize:15, background:'transparent' }}>
                <option value="">Select…</option>
                {cats.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            {['name','phone','address','notes'].map(k => (
              <div className="field" key={k}>
                <label>{k.charAt(0).toUpperCase()+k.slice(1)}{k==='name'?' *':''}</label>
                {k==='notes' ? <textarea rows={2} value={editForm[k]||''} onChange={e=>setEditForm(f=>({...f,[k]:e.target.value}))}/>
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

      {/* Delete confirm */}
      {showDel && (
        <div className="overlay" onClick={() => setShowDel(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete {party.name}?</h3>
            <p style={{ color:'var(--text2)', fontSize:14, marginBottom:20 }}>This permanently deletes this party and all their transactions.</p>
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

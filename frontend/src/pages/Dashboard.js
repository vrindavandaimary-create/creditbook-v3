import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashAPI, categoryAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate, avatarColor, avatarLetter, balanceClass } from '../utils/helpers';

const ICON_OPTIONS = ['👥','🏪','🤝','👨‍👩‍👧','💼','🏢','👷','🌟','💰','📦','🎯','🏠'];
const COLOR_OPTIONS = ['#1a4fd6','#1a9e5c','#e53935','#f57c00','#7b1fa2','#0097a7','#c62828','#558b2f','#ad1457','#283593'];

function CategoryFormSheet({ onClose, onDone, existing }) {
  const [name,  setName]  = useState(existing?.name  || '');
  const [color, setColor] = useState(existing?.color || COLOR_OPTIONS[0]);
  const [icon,  setIcon]  = useState(existing?.icon  || ICON_OPTIONS[0]);
  const [saving, setSaving] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      if (existing) {
        await categoryAPI.update(existing._id, { name: name.trim(), color, icon });
        toast.success('Category renamed!');
      } else {
        await categoryAPI.create({ name: name.trim(), color, icon });
        toast.success('Category created!');
      }
      onDone();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontWeight:800, marginBottom:16 }}>{existing ? 'Rename Category' : 'New Category'}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>Category Name *</label>
            <input placeholder="e.g. Customers, Suppliers, Friends…" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          </div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>Icon</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:14 }}>
            {ICON_OPTIONS.map(ic => (
              <button key={ic} type="button" onClick={()=>setIcon(ic)} style={{
                width:38, height:38, borderRadius:10, fontSize:20, border:`2px solid ${ic===icon?'var(--blue)':'var(--border)'}`,
                background: ic===icon?'var(--blue-lt)':'white', cursor:'pointer'
              }}>{ic}</button>
            ))}
          </div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>Color</p>
          <div style={{ display:'flex', gap:8, marginBottom:18 }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} type="button" onClick={()=>setColor(c)} style={{
                width:28, height:28, borderRadius:'50%', background:c, border:`3px solid ${c===color?'var(--text)':'transparent'}`,
                cursor:'pointer', flexShrink:0
              }}/>
            ))}
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button type="button" className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary btn-full" disabled={saving}>{saving?'Saving…':'Save'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteCategorySheet({ cat, otherCategories, onClose, onDone }) {
  const [action, setAction] = useState('delete_parties');
  const [moveId, setMoveId] = useState(otherCategories[0]?._id || '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      await categoryAPI.delete(cat._id, { action, moveToCategoryId: action==='move_parties'?moveId:undefined });
      toast.success('Category deleted!');
      onDone();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); setLoading(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete "{cat.name}"?</h3>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>This category has <b>{cat.partyCount}</b> parties.</p>
        {cat.partyCount > 0 && (
          <>
            <p style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:10 }}>What to do with parties?</p>
            <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${action==='delete_parties'?'var(--red)':'var(--border)'}`, marginBottom:8, cursor:'pointer', background: action==='delete_parties'?'var(--red-lt)':'white' }}>
              <input type="radio" value="delete_parties" checked={action==='delete_parties'} onChange={()=>setAction('delete_parties')} style={{ accentColor:'var(--red)' }}/>
              <span style={{ fontSize:14, fontWeight:600 }}>Delete all parties & transactions</span>
            </label>
            {otherCategories.length > 0 && (
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${action==='move_parties'?'var(--blue)':'var(--border)'}`, marginBottom:14, cursor:'pointer', background: action==='move_parties'?'var(--blue-lt)':'white' }}>
                <input type="radio" value="move_parties" checked={action==='move_parties'} onChange={()=>setAction('move_parties')} style={{ accentColor:'var(--blue)' }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>Move parties to another category</span>
                  {action==='move_parties' && (
                    <select value={moveId} onChange={e=>setMoveId(e.target.value)} style={{ display:'block', marginTop:6, fontSize:13, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'white', width:'100%' }}>
                      {otherCategories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
                    </select>
                  )}
                </div>
              </label>
            )}
          </>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-ghost btn-full" onClick={onClose}>Cancel</button>
          <button className="btn btn-red btn-full" onClick={submit} disabled={loading}>{loading?'Deleting…':'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat,     setEditCat]     = useState(null);
  const [deleteCat,   setDeleteCat]   = useState(null);
  const [showAddParty, setShowAddParty] = useState(null); // categoryId

  const load = useCallback(async () => {
    try { const r = await dashAPI.get(); setData(r.data.data); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="spinner"><div className="spin"/></div>;

  const d = data || { grouped:[], totalToGet:0, totalToGive:0, partyCount:0, recentTransactions:[] };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:80 }}>
      {/* Header */}
      <div className="grad-blue" style={{ padding:'20px 16px 24px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14 }}>
          <div>
            <p style={{ opacity:.7, fontSize:12, marginBottom:2 }}>👋 Hello,</p>
            <h2 style={{ fontSize:22, fontWeight:800, margin:0 }}>{user?.name}</h2>
            <p style={{ opacity:.65, fontSize:12, marginTop:3 }}>💳 {user?.businessName}</p>
          </div>
          <div style={{ background:'rgba(255,255,255,.14)', borderRadius:10, padding:'8px 12px', textAlign:'right' }}>
            <p style={{ fontSize:10, opacity:.7 }}>Net Balance</p>
            <p style={{ fontSize:16, fontWeight:800, color: (d.totalToGet-d.totalToGive)>=0?'#4ade80':'#f87171' }}>
              {(d.totalToGet-d.totalToGive)>=0?'+':''}₹{fmt(d.totalToGet-d.totalToGive,0)}
            </p>
          </div>
        </div>

        {/* Summary row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:11, opacity:.7, marginBottom:3 }}>💰 You will GET</p>
            <p style={{ fontSize:20, fontWeight:800, color:'#4ade80' }}>₹{fmt(d.totalToGet,0)}</p>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:11, opacity:.7, marginBottom:3 }}>💸 You will GIVE</p>
            <p style={{ fontSize:20, fontWeight:800, color:'#f87171' }}>₹{fmt(d.totalToGive,0)}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>
        {/* Categories header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <p className="sec-title" style={{ margin:0 }}>📂 Categories ({d.grouped.length})</p>
          <button onClick={() => setShowCatForm(true)} style={{ background:'var(--blue-lt)', color:'var(--blue)', border:'none', borderRadius:50, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add Category
          </button>
        </div>

        {d.grouped.length === 0 ? (
          <div className="empty" style={{ paddingTop:32 }}>
            <div className="ico">📂</div>
            <h3>No categories yet</h3>
            <p>Start by adding a category like "Customers" or "Suppliers"</p>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowCatForm(true)}>+ Add Category</button>
          </div>
        ) : (
          d.grouped.map(({ category: cat, parties, toGet, toGive }) => (
            <div key={cat._id} className="card" style={{ marginBottom:16, overflow:'hidden' }}>
              {/* Category header */}
              <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:cat.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                  {cat.icon}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontWeight:800, fontSize:15 }}>{cat.name}</p>
                  <p style={{ fontSize:11, color:'var(--text3)' }}>{parties.length} parties</p>
                </div>
                <div style={{ textAlign:'right', marginRight:8 }}>
                  {toGet>0  && <p style={{ fontSize:12, fontWeight:700, color:'var(--red)' }}>GET ₹{fmt(toGet,0)}</p>}
                  {toGive>0 && <p style={{ fontSize:12, fontWeight:700, color:'var(--blue)' }}>GIVE ₹{fmt(toGive,0)}</p>}
                </div>
                {/* Category actions */}
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => { setEditCat(cat); }} title="Edit" style={{ width:28, height:28, borderRadius:8, background:'var(--bg)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'none' }}>✏️</button>
                  <button onClick={() => setDeleteCat({ ...cat, partyCount: parties.length })} title="Delete" style={{ width:28, height:28, borderRadius:8, background:'var(--red-lt)', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', border:'none' }}>🗑️</button>
                </div>
              </div>

              {/* Party list */}
              {parties.length === 0 ? (
                <div style={{ padding:'16px', textAlign:'center', color:'var(--text3)', fontSize:13 }}>
                  No parties in this category.
                  <button onClick={() => navigate(`/parties/add?cat=${cat._id}`)} style={{ display:'block', margin:'8px auto 0', color:'var(--blue)', fontWeight:700, fontSize:13, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Add Party</button>
                </div>
              ) : (
                <>
                  {parties.slice(0,5).map(p => (
                    <div key={p._id} onClick={() => navigate(`/parties/${p._id}`)}
                      style={{ padding:'11px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
                      <div className="avatar av-sm" style={{ background: avatarColor(p.name) }}>{avatarLetter(p.name)}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                        {p.phone && <p style={{ fontSize:11, color:'var(--text3)' }}>{p.phone}</p>}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p className={balanceClass(p.balance)} style={{ fontSize:14 }}>₹{fmt(Math.abs(p.balance),0)}</p>
                        <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{p.balance>0?'to get':p.balance<0?'to give':'settled'}</p>
                      </div>
                    </div>
                  ))}
                  {parties.length > 5 && (
                    <button onClick={() => navigate(`/parties?cat=${cat._id}`)} style={{ width:'100%', padding:'10px', fontSize:13, fontWeight:700, color:'var(--blue)', background:'var(--blue-lt)', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
                      View all {parties.length} parties →
                    </button>
                  )}
                </>
              )}

              {/* Add party button per category */}
              <button onClick={() => navigate(`/parties/add?cat=${cat._id}`)}
                style={{ width:'100%', padding:'10px', fontSize:12, fontWeight:700, color:'var(--text3)', background:'var(--bg)', border:'none', borderTop:'1px solid var(--border)', cursor:'pointer', fontFamily:'inherit' }}>
                + Add Party to {cat.name}
              </button>
            </div>
          ))
        )}

        {/* Recent Transactions */}
        {d.recentTransactions?.length > 0 && (
          <>
            <p className="sec-title" style={{ marginTop:4 }}>Recent Transactions</p>
            <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
              {d.recentTransactions.slice(0,6).map(tx => (
                <div key={tx._id} className="tx-item">
                  <div style={{ flex:1 }}>
                    <p style={{ fontWeight:700, fontSize:14 }}>{tx.partyId?.name||'—'}</p>
                    <p className="tx-date">{fmtDate(tx.date)}</p>
                    {tx.note && <p className="tx-note">{tx.note}</p>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p className={tx.type==='got'?'amt-pos':'amt-neg'} style={{ fontSize:15 }}>
                      {tx.type==='got'?'+':'-'}₹{fmt(tx.amount,2)}
                    </p>
                    <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{tx.type==='got'?'Received':'Given'}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Sheets */}
      {(showCatForm || editCat) && (
        <CategoryFormSheet
          existing={editCat}
          onClose={() => { setShowCatForm(false); setEditCat(null); }}
          onDone={() => { setShowCatForm(false); setEditCat(null); load(); }}
        />
      )}
      {deleteCat && (
        <DeleteCategorySheet
          cat={deleteCat}
          otherCategories={d.grouped.map(g=>g.category).filter(c=>c._id!==deleteCat._id)}
          onClose={() => setDeleteCat(null)}
          onDone={() => { setDeleteCat(null); load(); }}
        />
      )}
    </div>
  );
}

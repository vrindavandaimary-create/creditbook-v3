import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashAPI, categoryAPI, partyAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate, avatarColor, avatarLetter, balanceClass } from '../utils/helpers';

const COLOR_OPTIONS = ['#1a4fd6','#1a9e5c','#e53935','#f57c00','#7b1fa2','#0097a7','#c62828','#558b2f','#ad1457','#283593'];

/* ── Category form sheet ── */
function CategoryFormSheet({ onClose, onDone, existing }) {
  const [name,   setName]   = useState(existing?.name  || '');
  const [color,  setColor]  = useState(existing?.color || COLOR_OPTIONS[0]);
  const [icon,   setIcon]   = useState(existing?.icon  || '👥');
  const [saving, setSaving] = useState(false);

  const submit = async e => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      if (existing) {
        await categoryAPI.update(existing._id, { name: name.trim(), color, icon });
        toast.success('Category updated!');
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
        <h3 style={{ fontWeight:800, marginBottom:16 }}>{existing ? 'Edit Category' : 'New Category'}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>Category Name *</label>
            <input placeholder="e.g. Customers, Suppliers…" value={name} onChange={e => setName(e.target.value)} autoFocus />
          </div>

          <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>Color</p>
          <div style={{ display:'flex', gap:8, marginBottom:18, flexWrap:'wrap' }}>
            {COLOR_OPTIONS.map(c => (
              <button key={c} type="button" onClick={() => setColor(c)} style={{
                width:28, height:28, borderRadius:'50%', background:c,
                border:`3px solid ${c===color?'var(--text)':'transparent'}`, cursor:'pointer', flexShrink:0
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

/* ── Delete category sheet ── */
function DeleteCategorySheet({ cat, otherCategories, onClose, onDone }) {
  const [action,  setAction]  = useState('delete_parties');
  const [moveId,  setMoveId]  = useState(otherCategories[0]?._id || '');
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
              <input type="radio" checked={action==='delete_parties'} onChange={() => setAction('delete_parties')} style={{ accentColor:'var(--red)' }}/>
              <span style={{ fontSize:14, fontWeight:600 }}>Delete all parties & transactions</span>
            </label>
            {otherCategories.length > 0 && (
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${action==='move_parties'?'var(--blue)':'var(--border)'}`, marginBottom:14, cursor:'pointer', background: action==='move_parties'?'var(--blue-lt)':'white' }}>
                <input type="radio" checked={action==='move_parties'} onChange={() => setAction('move_parties')} style={{ accentColor:'var(--blue)' }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>Move to another category</span>
                  {action==='move_parties' && (
                    <select value={moveId} onChange={e => setMoveId(e.target.value)}
                      style={{ display:'block', marginTop:6, fontSize:13, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'white', width:'100%' }}>
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

/* ── Category Parties Sheet — shown when user taps a category ── */
function CategoryPartiesSheet({ cat, onClose, navigate }) {
  const [parties,    setParties]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () => {
    partyAPI.getAll({ categoryId: cat._id })
      .then(r => setParties(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [cat._id]);

  const deleteParty = async (party) => {
    try {
      await partyAPI.delete(party._id);
      toast.success(`${party.name} deleted`);
      setConfirmDel(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const toGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const toGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

  return (
    <>
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}
        style={{ maxHeight:'82vh', display:'flex', flexDirection:'column', padding:0, overflow:'hidden' }}>

        {/* Sheet header */}
        <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
            <div style={{ width:42, height:42, borderRadius:12, background:cat.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
              {cat.icon}
            </div>
            <div style={{ flex:1 }}>
              <h3 style={{ fontWeight:800, fontSize:17, margin:0 }}>{cat.name}</h3>
              <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{parties.length} parties</p>
            </div>
            <button onClick={onClose} style={{ background:'var(--bg)', border:'none', borderRadius:50, width:30, height:30, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)' }}>×</button>
          </div>
          {/* Balance summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'var(--red-lt)', borderRadius:10, padding:'8px 12px' }}>
              <p style={{ fontSize:10, color:'var(--red)', fontWeight:700, marginBottom:2 }}>💰 TO GET</p>
              <p style={{ fontSize:16, fontWeight:800, color:'var(--red)' }}>₹{fmt(toGet,0)}</p>
            </div>
            <div style={{ background:'var(--blue-lt)', borderRadius:10, padding:'8px 12px' }}>
              <p style={{ fontSize:10, color:'var(--blue)', fontWeight:700, marginBottom:2 }}>💸 TO GIVE</p>
              <p style={{ fontSize:16, fontWeight:800, color:'var(--blue)' }}>₹{fmt(toGive,0)}</p>
            </div>
          </div>
        </div>

        {/* Party list */}
        <div style={{ flex:1, overflowY:'auto' }}>
          {loading ? (
            <div className="spinner"><div className="spin"/></div>
          ) : parties.length === 0 ? (
            <div className="empty" style={{ paddingTop:32 }}>
              <div className="ico"></div>
              <h3>No parties yet</h3>
              <p>Add a party to this category</p>
            </div>
          ) : (
            parties.map(p => (
              <div key={p._id}
                style={{ padding:'13px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, background:'white' }}>
                {/* Main row → navigate */}
                <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, cursor:'pointer' }}
                  onClick={() => { onClose(); navigate(`/parties/${p._id}`); }}>
                  <div className="avatar av-sm" style={{ background: avatarColor(p.name) }}>{avatarLetter(p.name)}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                    {p.phone && <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{p.phone}</p>}
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p className={balanceClass(p.balance)} style={{ fontSize:15 }}>₹{fmt(Math.abs(p.balance),0)}</p>
                    <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{p.balance>0?'to get':p.balance<0?'to give':'settled'}</p>
                  </div>
                </div>
                {/* Delete button */}
                <button
                  onClick={e => { e.stopPropagation(); setConfirmDel(p); }}
                  style={{ flexShrink:0, width:32, height:32, borderRadius:8, background:'var(--red-lt)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>

        {/* Add party button */}
        <div style={{ padding:'12px 18px', borderTop:'1px solid var(--border)', flexShrink:0 }}>
          <button className="btn btn-primary btn-full"
            onClick={() => { onClose(); navigate(`/parties/add?cat=${cat._id}`); }}>
            + Add Party to {cat.name}
          </button>
        </div>
      </div>
    </div>

    {/* Delete confirm sheet */}
    {confirmDel && (
      <div className="overlay" onClick={() => setConfirmDel(null)}>
        <div className="sheet" onClick={e => e.stopPropagation()}>
          <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete "{confirmDel.name}"?</h3>
          <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>
            This permanently deletes this party and all their transactions.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button className="btn btn-ghost btn-full" onClick={() => setConfirmDel(null)}>Cancel</button>
            <button className="btn btn-red btn-full" onClick={() => deleteParty(confirmDel)}>Delete</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

/* ── Main Dashboard ── */
export default function Dashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat,     setEditCat]     = useState(null);
  const [deleteCat,   setDeleteCat]   = useState(null);
  const [viewCat,     setViewCat]     = useState(null); // category whose parties to show

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
            <p style={{ fontSize:16, fontWeight:800, color:(d.totalToGet-d.totalToGive)>=0?'#4ade80':'#f87171' }}>
              {(d.totalToGet-d.totalToGive)>=0?'+':''}₹{fmt(d.totalToGet-d.totalToGive,0)}
            </p>
          </div>
        </div>
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
          <button onClick={() => setShowCatForm(true)}
            style={{ background:'var(--blue-lt)', color:'var(--blue)', border:'none', borderRadius:50, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add
          </button>
        </div>

        {d.grouped.length === 0 ? (
          <div className="empty" style={{ paddingTop:32 }}>
            <div className="ico">📂</div>
            <h3>No categories yet</h3>
            <p>Start by creating a category like "Customers"</p>
            <button className="btn btn-primary" style={{ marginTop:16 }} onClick={() => setShowCatForm(true)}>+ Add Category</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {d.grouped.map(({ category: cat, parties, toGet, toGive }) => (
              <div key={cat._id} className="card"
                onClick={() => setViewCat(cat)}
                style={{ padding:'14px', cursor:'pointer', position:'relative', overflow:'hidden', transition:'transform .15s, box-shadow .15s' }}
                onMouseDown={e => e.currentTarget.style.transform='scale(.97)'}
                onMouseUp={e => e.currentTarget.style.transform='scale(1)'}
                onTouchStart={e => e.currentTarget.style.transform='scale(.97)'}
                onTouchEnd={e => e.currentTarget.style.transform='scale(1)'}
              >
                {/* Color accent bar */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:4, background:cat.color, borderRadius:'16px 16px 0 0' }}/>

                {/* Icon + actions row */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8, marginTop:4 }}>
                  <div style={{ width:40, height:40, borderRadius:12, background:cat.color+'22', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>
                    {cat.icon}
                  </div>
                  {/* edit/delete */}
                  <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setEditCat(cat)}
                      style={{ width:26, height:26, borderRadius:8, background:'var(--bg)', fontSize:12, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✏️</button>
                    <button onClick={() => setDeleteCat({ ...cat, partyCount: parties.length })}
                      style={{ width:26, height:26, borderRadius:8, background:'var(--red-lt)', fontSize:12, border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>🗑️</button>
                  </div>
                </div>

                {/* Name + count */}
                <p style={{ fontWeight:800, fontSize:15, marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</p>
                <p style={{ fontSize:11, color:'var(--text3)', marginBottom:10 }}>{parties.length} {parties.length===1?'party':'parties'}</p>

                {/* Balance summary */}
                {toGet > 0 && (
                  <p style={{ fontSize:12, fontWeight:700, color:'var(--red)', marginBottom:2 }}>
                    GET ₹{fmt(toGet,0)}
                  </p>
                )}
                {toGive > 0 && (
                  <p style={{ fontSize:12, fontWeight:700, color:'var(--blue)' }}>
                    GIVE ₹{fmt(toGive,0)}
                  </p>
                )}
                {toGet === 0 && toGive === 0 && (
                  <p style={{ fontSize:12, color:'var(--text4)' }}>All settled ✅</p>
                )}

                {/* Tap hint */}
                <p style={{ fontSize:10, color:'var(--text4)', marginTop:8 }}>Tap to view parties →</p>
              </div>
            ))}
          </div>
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
      {viewCat && (
        <CategoryPartiesSheet
          cat={viewCat}
          onClose={() => setViewCat(null)}
          navigate={navigate}
        />
      )}
    </div>
  );
}

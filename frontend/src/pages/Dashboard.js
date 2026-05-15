import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { dashAPI, categoryAPI, partyAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { fmt, fmtDate, avatarColor, avatarLetter } from '../utils/helpers';

const COLOR_OPTIONS = ['#1a4fd6','#1a9e5c','#e53935','#f57c00','#7b1fa2','#0097a7','#c62828','#558b2f','#ad1457','#283593'];

/* ─── Category Form Sheet ─── */
function CategoryFormSheet({ onClose, onDone, existing }) {
  const [name,   setName]   = useState(existing?.name  || '');
  const [color,  setColor]  = useState(existing?.color || COLOR_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      existing
        ? await categoryAPI.update(existing._id, { name:name.trim(), color })
        : await categoryAPI.create({ name:name.trim(), color });
      toast.success(existing ? 'Category updated!' : 'Category created!');
      onDone();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontWeight:800, marginBottom:16 }}>{existing?'Edit Category':'New Category'}</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label>Category Name *</label>
            <input placeholder="e.g. Customers, Suppliers…" value={name} onChange={e=>setName(e.target.value)} autoFocus/>
          </div>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>Color</p>
          <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
            {COLOR_OPTIONS.map(c=>(
              <button key={c} type="button" onClick={()=>setColor(c)}
                style={{ width:30, height:30, borderRadius:'50%', background:c, border:`3px solid ${c===color?'#1a1d2e':'transparent'}`, cursor:'pointer' }}/>
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

/* ─── Delete Category Sheet ─── */
function DeleteCategorySheet({ cat, otherCategories, onClose, onDone }) {
  const [action,  setAction]  = useState('delete_parties');
  const [moveId,  setMoveId]  = useState(otherCategories[0]?._id || '');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setLoading(true);
    try {
      await categoryAPI.delete(cat._id, { action, moveToCategoryId:action==='move_parties'?moveId:undefined });
      toast.success('Category deleted!'); onDone();
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); setLoading(false); }
  };
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete "{cat.name}"?</h3>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>
          This category has <b>{cat.partyCount}</b> {cat.partyCount===1?'party':'parties'}.
        </p>
        {cat.partyCount > 0 && (
          <>
            <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${action==='delete_parties'?'var(--red)':'var(--border)'}`, marginBottom:8, cursor:'pointer', background:action==='delete_parties'?'var(--red-lt)':'white' }}>
              <input type="radio" checked={action==='delete_parties'} onChange={()=>setAction('delete_parties')} style={{ accentColor:'var(--red)' }}/>
              <span style={{ fontSize:14, fontWeight:600 }}>Delete all parties & transactions</span>
            </label>
            {otherCategories.length > 0 && (
              <label style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderRadius:10, border:`1.5px solid ${action==='move_parties'?'var(--blue)':'var(--border)'}`, marginBottom:14, cursor:'pointer', background:action==='move_parties'?'var(--blue-lt)':'white' }}>
                <input type="radio" checked={action==='move_parties'} onChange={()=>setAction('move_parties')} style={{ accentColor:'var(--blue)' }}/>
                <div style={{ flex:1 }}>
                  <span style={{ fontSize:14, fontWeight:600 }}>Move to another category</span>
                  {action==='move_parties' && (
                    <select value={moveId} onChange={e=>setMoveId(e.target.value)}
                      style={{ display:'block', marginTop:6, fontSize:13, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'white', width:'100%' }}>
                      {otherCategories.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                  )}
                </div>
              </label>
            )}
          </>
        )}
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-ghost btn-full" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="btn btn-red btn-full" onClick={submit} disabled={loading}>{loading?'Deleting…':'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Three-dot Menu ─── */
function ThreeDotMenu({ cat, parties, onEdit, onDelete, onClose }) {
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>

          <div>
            <p style={{ fontWeight:800, fontSize:16 }}>{cat.name}</p>
            <p style={{ fontSize:12, color:'#999' }}>{parties} {parties===1?'party':'parties'}</p>
          </div>
        </div>
        <button onClick={onEdit}
          style={{ width:'100%', padding:'13px 16px', marginBottom:8, borderRadius:12, border:'1.5px solid #e8ecf0', background:'white', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'#333' }}>
          <span style={{ width:32, height:32, borderRadius:8, background:'#e8eeff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✏️</span>
          Edit Category
        </button>
        <button onClick={onDelete}
          style={{ width:'100%', padding:'13px 16px', marginBottom:8, borderRadius:12, border:'1.5px solid #ffebee', background:'#fff5f5', display:'flex', alignItems:'center', gap:12, cursor:'pointer', fontFamily:'inherit', fontSize:14, fontWeight:600, color:'#e53935' }}>
          <span style={{ width:32, height:32, borderRadius:8, background:'#ffebee', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🗑️</span>
          Delete Category
        </button>
        <button onClick={onClose}
          style={{ width:'100%', padding:'13px', borderRadius:12, border:'1px solid #eee', background:'white', fontSize:14, fontWeight:600, color:'#888', cursor:'pointer', fontFamily:'inherit' }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ─── Category Detail Page ─── */
function CategoryDetailPage({ cat, onBack, onEdit, onDelete, navigate }) {
  const [parties,    setParties]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState('');
  const [confirmDel, setConfirmDel] = useState(null);
  const [deleting,   setDeleting]   = useState(false);
  const [showMenu,   setShowMenu]   = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    partyAPI.getAll({ categoryId:cat._id })
      .then(r => setParties(r.data.data || []))
      .catch(() => toast.error('Failed to load'))
      .finally(() => setLoading(false));
  }, [cat._id]);

  useEffect(() => { load(); }, [load]);

  const deleteParty = async party => {
    setDeleting(true);
    try { await partyAPI.delete(party._id); toast.success(`${party.name} deleted`); setConfirmDel(null); load(); }
    catch { toast.error('Failed'); }
    finally { setDeleting(false); }
  };

  const filtered = search.trim()
    ? parties.filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    : parties;

  const toGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const toGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);
  const net    = toGet - toGive;

  /* Show only the relevant side — OkCredit style */
  const showBothSides = toGet > 0 && toGive > 0;

  return (
    <div style={{ background:'#f5f7fa', minHeight:'100vh', paddingBottom:90 }}>

      {/* Header */}
      <div style={{ background:'white', padding:'0 16px', borderBottom:'1px solid #eee', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={onBack}
            style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#555', cursor:'pointer', flexShrink:0 }}>←</button>
          <h2 style={{ flex:1, fontSize:17, fontWeight:800, margin:0 }}>{cat.name}</h2>
          <button onClick={() => setShowMenu(true)}
            style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
            </svg>
          </button>
        </div>
      </div>

      <div style={{ padding:'14px 16px 0' }}>

        {/* Summary card — compact, OkCredit style */}
        <div style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:14, boxShadow:'0 1px 6px rgba(0,0,0,.06)' }}>
          
          {showBothSides && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'#e6f9f0', borderRadius:10, padding:'8px 12px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#1a9e5c', marginBottom:2 }}>YOU WILL GET</p>
                <p style={{ fontSize:16, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(toGet,0)}</p>
              </div>
              <div style={{ background:'#fff0f0', borderRadius:10, padding:'8px 12px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#e53935', marginBottom:2 }}>YOU WILL GIVE</p>
                <p style={{ fontSize:16, fontWeight:800, color:'#e53935' }}>₹{fmt(toGive,0)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ background:'white', border:'1.5px solid #e8ecf0', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input placeholder="Search parties…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ flex:1, fontSize:14, background:'none', border:'none', color:'#333', outline:'none' }}/>
        </div>

        <p style={{ fontSize:11, fontWeight:700, color:'#aaa', textTransform:'uppercase', letterSpacing:.8, marginBottom:8 }}>
          {filtered.length} {filtered.length===1?'party':'parties'}
        </p>

        {loading ? <div className="spinner"><div className="spin"/></div>
          : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🤝</div>
              <p style={{ fontWeight:700, fontSize:16, color:'#333' }}>No parties yet</p>
              <p style={{ fontSize:13, color:'#999', marginTop:6 }}>Add a party to this category</p>
            </div>
          ) : (
            <div style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,.06)', marginBottom:16 }}>
              {filtered.map((p, i) => (
                <div key={p._id}
                  style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:i<filtered.length-1?'1px solid #f5f5f5':'none', cursor:'pointer' }}
                  onClick={() => navigate(`/parties/${p._id}`)}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:avatarColor(p.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:17, flexShrink:0 }}>
                    {avatarLetter(p.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize:12, color:'#999', marginTop:2 }}>
                      {p.balance===0 ? 'Settled' : p.balance>0 ? 'will give you' : 'you will give'}
                    </p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:16, fontWeight:800, color:p.balance>0?'#e53935':p.balance<0?'#1a9e5c':'#888' }}>
                      {p.balance===0 ? '₹0' : `₹${fmt(Math.abs(p.balance),0)}`}
                    </p>
                    <p style={{ fontSize:11, fontWeight:600, marginTop:2, color:p.balance>0?'#e53935':p.balance<0?'#1a9e5c':'#888' }}>
                      {p.balance>0?'Due':p.balance<0?'Advance':'Settled'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      <button className="fab fab-blue" onClick={() => navigate(`/parties/add?cat=${cat._id}`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Add Party
      </button>

      {showMenu && (
        <ThreeDotMenu
          cat={cat}
          parties={parties.length}
          onEdit={() => { setShowMenu(false); onEdit(cat); }}
          onDelete={() => { setShowMenu(false); onDelete({ ...cat, partyCount:parties.length }); }}
          onClose={() => setShowMenu(false)}
        />
      )}

      {confirmDel && (
        <div className="overlay" onClick={() => !deleting && setConfirmDel(null)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete "{confirmDel.name}"?</h3>
            <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>Permanently deletes this party and all their transactions.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setConfirmDel(null)} disabled={deleting}>Cancel</button>
              <button className="btn btn-red btn-full" onClick={() => deleteParty(confirmDel)} disabled={deleting}>{deleting?'Deleting…':'Delete'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════ */
export default function Dashboard() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat,     setEditCat]     = useState(null);
  const [deleteCat,   setDeleteCat]   = useState(null);
  const [viewCat,     setViewCat]     = useState(null);
  const [menuCat,     setMenuCat]     = useState(null); /* which card's 3-dot is open */

  const load = useCallback(async () => {
    try { const r = await dashAPI.get(); setData(r.data.data); }
    catch(e) {
      console.error(e);
      // Only show error toast when online — if offline, the fallback
      // data object {} handles rendering without a confusing error message.
      if (navigator.onLine) toast.error('Failed to load dashboard');
    }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (viewCat) return (
    <CategoryDetailPage
      cat={viewCat}
      onBack={() => setViewCat(null)}
      onEdit={cat => { setViewCat(null); setEditCat(cat); }}
      onDelete={cat => { setViewCat(null); setDeleteCat(cat); }}
      navigate={navigate}
    />
  );

  if (loading) return <div className="spinner"><div className="spin"/></div>;

  const d   = data || { grouped:[], totalToGet:0, totalToGive:0, recentTransactions:[] };
  const recentTx = d.recentTransactions || [];

  return (
    <div style={{ background:'#f5f7fa', minHeight:'100vh', paddingBottom:90 }}>

      {/* ── Header ── */}
      <div style={{ background:'white', padding:'14px 16px 12px', borderBottom:'1px solid #eee' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontSize:12, color:'#aaa', marginBottom:1 }}>Good day,</p>
            <h1 style={{ fontSize:19, fontWeight:800, color:'#1a1d2e', margin:0, lineHeight:1.2 }}>{user?.name}</h1>
            {user?.businessName && <p style={{ fontSize:12, color:'#999', marginTop:2 }}>{user.businessName}</p>}
          </div>
          <button onClick={() => navigate('/more/profile')}
            style={{ width:42, height:42, borderRadius:'50%', background:avatarColor(user?.name||'U'), border:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:17, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
            {avatarLetter(user?.name||'U')}
          </button>
        </div>
      </div>

      <div style={{ padding:'12px 16px 0' }}>

        {/* ── Financial Summary — Get / Give only, no net balance ── */}
        <div style={{ background:'white', borderRadius:16, padding:'12px 14px', marginBottom:12, boxShadow:'0 1px 8px rgba(0,0,0,.07)' }}>
          {d.totalToGet===0 && d.totalToGive===0 ? (
            <p style={{ fontSize:13, fontWeight:600, color:'#aaa', textAlign:'center', padding:'4px 0' }}>All accounts settled ✓</p>
          ) : d.totalToGet>0 && d.totalToGive>0 ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              <div style={{ background:'#e6f9f0', borderRadius:12, padding:'10px 12px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#1a9e5c', marginBottom:4, textTransform:'uppercase', letterSpacing:.3 }}>You will get</p>
                <p style={{ fontSize:20, fontWeight:800, color:'#1a9e5c', lineHeight:1 }}>₹{fmt(d.totalToGet,0)}</p>
                <p style={{ fontSize:10, color:'#aaa', marginTop:3 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance>0).length,0)} parties</p>
              </div>
              <div style={{ background:'#fff0f0', borderRadius:12, padding:'10px 12px' }}>
                <p style={{ fontSize:10, fontWeight:700, color:'#e53935', marginBottom:4, textTransform:'uppercase', letterSpacing:.3 }}>You will give</p>
                <p style={{ fontSize:20, fontWeight:800, color:'#e53935', lineHeight:1 }}>₹{fmt(d.totalToGive,0)}</p>
                <p style={{ fontSize:10, color:'#aaa', marginTop:3 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance<0).length,0)} parties</p>
              </div>
            </div>
          ) : d.totalToGet>0 ? (
            <div style={{ background:'#e6f9f0', borderRadius:12, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:'#1a9e5c', marginBottom:3, textTransform:'uppercase' }}>You will get</p>
                <p style={{ fontSize:22, fontWeight:800, color:'#1a9e5c', lineHeight:1 }}>₹{fmt(d.totalToGet,0)}</p>
              </div>
              <p style={{ fontSize:12, color:'#1a9e5c', fontWeight:600 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance>0).length,0)} parties</p>
            </div>
          ) : (
            <div style={{ background:'#fff0f0', borderRadius:12, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <p style={{ fontSize:10, fontWeight:700, color:'#e53935', marginBottom:3, textTransform:'uppercase' }}>You will give</p>
                <p style={{ fontSize:22, fontWeight:800, color:'#e53935', lineHeight:1 }}>₹{fmt(d.totalToGive,0)}</p>
              </div>
              <p style={{ fontSize:12, color:'#e53935', fontWeight:600 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance<0).length,0)} parties</p>
            </div>
          )}
        </div>

        {/* ── Categories ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
          <p style={{ fontSize:13, fontWeight:800, color:'#1a1d2e' }}>Categories</p>
          <button onClick={() => setShowCatForm(true)}
            style={{ background:'#e8eeff', color:'#1a4fd6', border:'none', borderRadius:50, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add
          </button>
        </div>

        {d.grouped.length === 0 ? (
          <div style={{ background:'white', borderRadius:16, padding:'28px 24px', textAlign:'center', boxShadow:'0 1px 4px rgba(0,0,0,.05)', marginBottom:16 }}>
            <div style={{ fontSize:40, marginBottom:10 }}>📂</div>
            <p style={{ fontWeight:700, fontSize:15, color:'#333', marginBottom:6 }}>No categories yet</p>
            <p style={{ fontSize:12, color:'#999', marginBottom:14 }}>Organise parties into Customers, Suppliers etc.</p>
            <button className="btn btn-primary" onClick={() => setShowCatForm(true)}>+ Add Category</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {d.grouped.map(({ category:cat, parties, toGet, toGive }) => {
              const catNet = toGet - toGive;
              return (
                <div key={cat._id} onClick={() => setViewCat(cat)}
                  style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 4px rgba(0,0,0,.06)', cursor:'pointer', position:'relative' }}>
                  {/* Top color bar */}
                  <div style={{ height:3, background:cat.color }}/>
                  <div style={{ padding:'11px 12px' }}>
                    {/* Name row + 3-dot */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <p style={{ fontSize:13, fontWeight:800, color:'#1a1d2e', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{cat.name}</p>
                      <button
                        onClick={e => { e.stopPropagation(); setMenuCat({ cat, parties:parties.length }); }}
                        style={{ width:28, height:28, borderRadius:8, background:'#f5f7fa', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:4 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="#888">
                          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
                        </svg>
                      </button>
                    </div>

                    <p style={{ fontSize:11, color:'#aaa', marginBottom:6 }}>{parties.length} {parties.length===1?'party':'parties'}</p>

                    {/* Balance — show only relevant side */}
                    {toGet===0 && toGive===0 && (
                      <p style={{ fontSize:11, color:'#aaa' }}>All settled ✓</p>
                    )}
                    {toGet>0 && toGive===0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <p style={{ fontSize:10, color:'#1a9e5c', fontWeight:600 }}>Get</p>
                        <p style={{ fontSize:12, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(toGet,0)}</p>
                      </div>
                    )}
                    {toGive>0 && toGet===0 && (
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <p style={{ fontSize:10, color:'#e53935', fontWeight:600 }}>Give</p>
                        <p style={{ fontSize:12, fontWeight:800, color:'#e53935' }}>₹{fmt(toGive,0)}</p>
                      </div>
                    )}
                    {toGet>0 && toGive>0 && (
                      <>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                          <p style={{ fontSize:10, color:'#1a9e5c', fontWeight:600 }}>Get</p>
                          <p style={{ fontSize:12, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(toGet,0)}</p>
                        </div>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <p style={{ fontSize:10, color:'#e53935', fontWeight:600 }}>Give</p>
                          <p style={{ fontSize:12, fontWeight:800, color:'#e53935' }}>₹{fmt(toGive,0)}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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

      {/* Category 3-dot menu */}
      {menuCat && (
        <ThreeDotMenu
          cat={menuCat.cat}
          parties={menuCat.parties}
          onEdit={() => { setMenuCat(null); setEditCat(menuCat.cat); }}
          onDelete={() => { setMenuCat(null); setDeleteCat({ ...menuCat.cat, partyCount:menuCat.parties }); }}
          onClose={() => setMenuCat(null)}
        />
      )}
    </div>
  );
}

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
              <button key={c} type="button" onClick={()=>setColor(c)} style={{ width:30, height:30, borderRadius:'50%', background:c, border:`3px solid ${c===color?'#1a1d2e':'transparent'}`, cursor:'pointer' }}/>
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
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:16 }}>This category has <b>{cat.partyCount}</b> {cat.partyCount===1?'party':'parties'}.</p>
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
                    <select value={moveId} onChange={e=>setMoveId(e.target.value)} style={{ display:'block', marginTop:6, fontSize:13, padding:'4px 8px', borderRadius:6, border:'1px solid var(--border)', background:'white', width:'100%' }}>
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

  return (
    <div style={{ background:'#f5f7fa', minHeight:'100vh', paddingBottom:90 }}>

      {/* Header */}
      <div style={{ background:'white', padding:'0 16px', borderBottom:'1px solid #eee', position:'sticky', top:0, zIndex:100 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, height:56 }}>
          <button onClick={onBack} style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, color:'#555', cursor:'pointer', flexShrink:0 }}>←</button>
          <div style={{ width:36, height:36, borderRadius:10, background:cat.color, display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:16, flexShrink:0 }}>
            {cat.name[0].toUpperCase()}
          </div>
          <h2 style={{ flex:1, fontSize:17, fontWeight:800, margin:0 }}>{cat.name}</h2>
          <button onClick={() => setShowMenu(true)} style={{ width:36, height:36, borderRadius:'50%', background:'#f5f5f5', border:'none', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
          </button>
        </div>
      </div>

      <div style={{ padding:'14px 16px 0' }}>
        {/* Summary card */}
        <div style={{ background:'white', borderRadius:16, padding:'16px 18px', marginBottom:14, boxShadow:'0 1px 8px rgba(0,0,0,.06)' }}>
          <p style={{ fontSize:12, color:'#888', marginBottom:4 }}>Net Balance</p>
          <p style={{ fontSize:32, fontWeight:800, color:net>=0?'#1a9e5c':'#e53935', lineHeight:1, marginBottom:12 }}>
            {net>=0?'+':''}₹{fmt(net,0)}
          </p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <div style={{ background:'#e6f9f0', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#1a9e5c', marginBottom:3 }}>YOU WILL GET</p>
              <p style={{ fontSize:18, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(toGet,0)}</p>
            </div>
            <div style={{ background:'#fff0f0', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontSize:10, fontWeight:700, color:'#e53935', marginBottom:3 }}>YOU WILL GIVE</p>
              <p style={{ fontSize:18, fontWeight:800, color:'#e53935' }}>₹{fmt(toGive,0)}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div style={{ background:'white', border:'1.5px solid #e8ecf0', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input placeholder="Search parties…" value={search} onChange={e=>setSearch(e.target.value)}
            style={{ flex:1, fontSize:14, background:'none', border:'none', color:'#333' }}/>
        </div>

        {/* Party count */}
        <p style={{ fontSize:12, fontWeight:700, color:'#888', textTransform:'uppercase', letterSpacing:.5, marginBottom:8 }}>
          {filtered.length} {filtered.length===1?'Party':'Parties'}
        </p>

        {/* Party list */}
        {loading ? <div className="spinner"><div className="spin"/></div>
          : filtered.length === 0 ? (
            <div style={{ textAlign:'center', padding:'48px 24px' }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🤝</div>
              <p style={{ fontWeight:700, fontSize:16, color:'#333' }}>No parties yet</p>
              <p style={{ fontSize:13, color:'#999', marginTop:6 }}>Add a party to this category</p>
            </div>
          ) : (
            <div style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.06)', marginBottom:16 }}>
              {filtered.map((p, i) => (
                <div key={p._id} style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 16px', borderBottom:i<filtered.length-1?'1px solid #f0f0f0':'none', cursor:'pointer' }}
                  onClick={() => navigate(`/parties/${p._id}`)}>
                  <div style={{ width:44, height:44, borderRadius:'50%', background:avatarColor(p.name), display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:800, fontSize:17, flexShrink:0 }}>
                    {avatarLetter(p.name)}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontWeight:700, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                    <p style={{ fontSize:12, color:'#999', marginTop:2 }}>
                      {p.phone || (p.balance===0?'Settled':'Tap to view transactions')}
                    </p>
                  </div>
                  <div style={{ textAlign:'right', flexShrink:0 }}>
                    <p style={{ fontSize:16, fontWeight:800, color:p.balance>0?'#e53935':p.balance<0?'#1a9e5c':'#888' }}>
                      {p.balance===0?'₹0':`₹${fmt(Math.abs(p.balance),0)}`}
                    </p>
                    <p style={{ fontSize:11, fontWeight:600, color:p.balance>0?'#e53935':p.balance<0?'#1a9e5c':'#888', marginTop:2 }}>
                      {p.balance>0?'Due':p.balance<0?'Advance':'Settled'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>

      {/* FAB */}
      <button className="fab fab-blue" onClick={() => navigate(`/parties/add?cat=${cat._id}`)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        Add Party
      </button>

      {/* 3-dot menu */}
      {showMenu && (
        <div className="overlay" onClick={() => setShowMenu(false)}>
          <div className="sheet" onClick={e=>e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:16 }}>{cat.name}</h3>
            <button className="btn btn-ghost btn-full" style={{ marginBottom:10 }} onClick={() => { setShowMenu(false); onEdit(cat); }}>✏️  Edit Category</button>
            <button className="btn btn-full" style={{ background:'var(--red-lt)', color:'var(--red)', marginBottom:10 }} onClick={() => { setShowMenu(false); onDelete({ ...cat, partyCount:parties.length }); }}>🗑️  Delete Category</button>
            <button className="btn btn-ghost btn-full" onClick={() => setShowMenu(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Delete party confirm */}
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editCat,     setEditCat]     = useState(null);
  const [deleteCat,   setDeleteCat]   = useState(null);
  const [viewCat,     setViewCat]     = useState(null);

  const load = useCallback(async () => {
    try { const r = await dashAPI.get(); setData(r.data.data); }
    catch(e) { console.error(e); toast.error('Failed to load dashboard'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* Show category detail page */
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

  const d   = data || { grouped:[], totalToGet:0, totalToGive:0, partyCount:0, recentTransactions:[] };
  const net = d.totalToGet - d.totalToGive;
  const recentTx = d.recentTransactions || [];

  return (
    <div style={{ background:'#f5f7fa', minHeight:'100vh', paddingBottom:90 }}>

      {/* ── Header ── */}
      <div style={{ background:'white', padding:'16px 16px 14px', borderBottom:'1px solid #eee' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <p style={{ fontSize:12, color:'#999', marginBottom:2 }}>Good day,</p>
            <h1 style={{ fontSize:20, fontWeight:800, color:'#1a1d2e', margin:0 }}>{user?.name}</h1>
            {user?.businessName && <p style={{ fontSize:12, color:'#888', marginTop:2 }}>{user.businessName}</p>}
          </div>
          <button onClick={() => navigate('/more/profile')}
            style={{ width:42, height:42, borderRadius:'50%', background:avatarColor(user?.name||'U'), border:'none', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:17, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
            {avatarLetter(user?.name||'U')}
          </button>
        </div>
      </div>

      <div style={{ padding:'14px 16px 0' }}>

        {/* ── Financial Summary Card ── */}
        <div style={{ background:'white', borderRadius:20, padding:'20px 18px', marginBottom:16, boxShadow:'0 2px 16px rgba(0,0,0,.07)' }}>
          <p style={{ fontSize:12, color:'#999', marginBottom:4, fontWeight:600 }}>Net Balance</p>
          <p style={{ fontSize:36, fontWeight:800, color:net>=0?'#1a9e5c':'#e53935', lineHeight:1, marginBottom:16 }}>
            {net>=0?'+':''}₹{fmt(net,0)}
          </p>
          <div style={{ height:1, background:'#f0f0f0', marginBottom:16 }}/>
          <div style={{ display:'flex', gap:0 }}>
            <div style={{ flex:1, paddingRight:16 }}>
              <p style={{ fontSize:11, color:'#1a9e5c', fontWeight:700, marginBottom:4, textTransform:'uppercase', letterSpacing:.3 }}>You Get</p>
              <p style={{ fontSize:22, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(d.totalToGet,0)}</p>
              <p style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance>0).length,0)} parties</p>
            </div>
            <div style={{ width:1, background:'#f0f0f0' }}/>
            <div style={{ flex:1, paddingLeft:16 }}>
              <p style={{ fontSize:11, color:'#e53935', fontWeight:700, marginBottom:4, textTransform:'uppercase', letterSpacing:.3 }}>You Give</p>
              <p style={{ fontSize:22, fontWeight:800, color:'#e53935' }}>₹{fmt(d.totalToGive,0)}</p>
              <p style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{d.grouped.reduce((s,g)=>s+g.parties.filter(p=>p.balance<0).length,0)} parties</p>
            </div>
          </div>
        </div>

        {/* ── Quick Actions ── */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[
            { label:'Add Party',   icon:'👤', action:() => navigate('/parties/add'), color:'#e8eeff', text:'#1a4fd6' },
            { label:'All Parties', icon:'📋', action:() => navigate('/parties'),     color:'#e6f9f0', text:'#1a9e5c' },
            { label:'Reports',     icon:'📊', action:() => navigate('/reports'),     color:'#fff0f0', text:'#e53935' },
          ].map(q => (
            <button key={q.label} onClick={q.action}
              style={{ background:'white', border:'none', borderRadius:14, padding:'14px 8px', display:'flex', flexDirection:'column', alignItems:'center', gap:6, cursor:'pointer', boxShadow:'0 1px 6px rgba(0,0,0,.05)' }}>
              <div style={{ width:40, height:40, borderRadius:12, background:q.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>{q.icon}</div>
              <p style={{ fontSize:12, fontWeight:700, color:q.text }}>{q.label}</p>
            </button>
          ))}
        </div>

        {/* ── Recent Transactions ── */}
        {recentTx.length > 0 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <p style={{ fontSize:13, fontWeight:800, color:'#1a1d2e' }}>Recent Transactions</p>
              <button onClick={() => navigate('/reports')} style={{ fontSize:12, color:'var(--blue)', fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>See all</button>
            </div>
            <div style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,.05)' }}>
              {recentTx.slice(0,5).map((tx, i) => (
                <div key={tx._id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderBottom:i<Math.min(recentTx.length,5)-1?'1px solid #f5f5f5':'none' }}>
                  <div style={{ width:36, height:36, borderRadius:'50%', background:tx.type==='got'?'#e6f9f0':'#fff0f0', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={tx.type==='got'?'#1a9e5c':'#e53935'} strokeWidth="2.5" strokeLinecap="round">
                      {tx.type==='got'
                        ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="5 12 12 19 19 12"/></>
                        : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="19 12 12 5 5 12"/></>
                      }
                    </svg>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:700, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{tx.partyId?.name||'—'}</p>
                    <p style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{fmtDate(tx.date)}</p>
                  </div>
                  <p style={{ fontSize:15, fontWeight:800, color:tx.type==='got'?'#1a9e5c':'#e53935', flexShrink:0 }}>
                    {tx.type==='got'?'+':'-'}₹{fmt(tx.amount,0)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Categories ── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
          <p style={{ fontSize:13, fontWeight:800, color:'#1a1d2e' }}>Categories</p>
          <button onClick={() => setShowCatForm(true)}
            style={{ background:'var(--blue-lt)', color:'var(--blue)', border:'none', borderRadius:50, padding:'5px 14px', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            + Add
          </button>
        </div>

        {d.grouped.length === 0 ? (
          <div style={{ background:'white', borderRadius:16, padding:'32px 24px', textAlign:'center', boxShadow:'0 1px 6px rgba(0,0,0,.05)', marginBottom:16 }}>
            <div style={{ fontSize:44, marginBottom:10 }}>📂</div>
            <p style={{ fontWeight:700, fontSize:16, color:'#333', marginBottom:6 }}>No categories yet</p>
            <p style={{ fontSize:13, color:'#999', marginBottom:16 }}>Organise your parties into categories like Customers, Suppliers</p>
            <button className="btn btn-primary" onClick={() => setShowCatForm(true)}>+ Add Category</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
            {d.grouped.map(({ category:cat, parties, toGet, toGive }) => (
              <div key={cat._id} onClick={() => setViewCat(cat)}
                style={{ background:'white', borderRadius:16, overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,.05)', cursor:'pointer', position:'relative' }}>
                {/* Color accent top strip */}
                <div style={{ height:3, background:cat.color }}/>
                <div style={{ padding:'12px 14px' }}>
                  {/* Avatar + menu */}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                    <div style={{ width:34, height:34, borderRadius:10, background:cat.color+'20', display:'flex', alignItems:'center', justifyContent:'center', color:cat.color, fontWeight:800, fontSize:15 }}>
                      {cat.name[0].toUpperCase()}
                    </div>
                    {/* 3-dot menu */}
                    <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:4 }}>
                      <button onClick={() => setEditCat(cat)}
                        style={{ width:26, height:26, borderRadius:8, background:'#f5f5f5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>✏️</button>
                      <button onClick={() => setDeleteCat({ ...cat, partyCount:parties.length })}
                        style={{ width:26, height:26, borderRadius:8, background:'#ffebee', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>🗑️</button>
                    </div>
                  </div>
                  <p style={{ fontSize:14, fontWeight:800, color:'#1a1d2e', marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{cat.name}</p>
                  <p style={{ fontSize:11, color:'#999', marginBottom:10 }}>{parties.length} {parties.length===1?'party':'parties'}</p>
                  {toGet > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                      <p style={{ fontSize:10, color:'#1a9e5c', fontWeight:600 }}>Get</p>
                      <p style={{ fontSize:11, fontWeight:800, color:'#1a9e5c' }}>₹{fmt(toGet,0)}</p>
                    </div>
                  )}
                  {toGive > 0 && (
                    <div style={{ display:'flex', justifyContent:'space-between' }}>
                      <p style={{ fontSize:10, color:'#e53935', fontWeight:600 }}>Give</p>
                      <p style={{ fontSize:11, fontWeight:800, color:'#e53935' }}>₹{fmt(toGive,0)}</p>
                    </div>
                  )}
                  {toGet===0 && toGive===0 && <p style={{ fontSize:11, color:'#aaa' }}>All settled ✅</p>}
                </div>
              </div>
            ))}
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
    </div>
  );
}

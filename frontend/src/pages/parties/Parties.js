import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { partyAPI, categoryAPI } from '../../api';
import { fmt, avatarColor, avatarLetter, balanceClass } from '../../utils/helpers';

export default function Parties() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const initCat = sp.get('cat') || '';
  const [parties,    setParties]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [selCat,     setSelCat]     = useState(initCat);
  const [search,     setSearch]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [confirmDel, setConfirmDel] = useState(null); // party to delete

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (selCat) params.categoryId = selCat;
      if (search) params.search     = search;
      const [pR, cR] = await Promise.all([
        partyAPI.getAll(params),
        categoryAPI.getAll(),
      ]);
      setParties(pR.data.data || []);
      setCategories(cR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [selCat, search]);

  useEffect(() => { load(); }, [load]);

  const deleteParty = async (party) => {
    try {
      await partyAPI.delete(party._id);
      toast.success(`${party.name} deleted`);
      setConfirmDel(null);
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const totalToGet  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalToGive = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', paddingBottom:90 }}>
      <div className="grad-blue" style={{ padding:'18px 16px 0', color:'white' }}>
        <h2 style={{ fontSize:20, fontWeight:800, marginBottom:14 }}>👥 All Parties</h2>
        <div style={{ background:'rgba(255,255,255,.13)', borderRadius:14, padding:'10px 16px', display:'flex', marginBottom:14 }}>
          <div style={{ flex:1, borderRight:'1px solid rgba(255,255,255,.2)', paddingRight:14 }}>
            <p style={{ fontSize:10, opacity:.75, marginBottom:2 }}>You will give</p>
            <p style={{ fontSize:19, fontWeight:800 }}>₹{fmt(totalToGive,0)}</p>
          </div>
          <div style={{ flex:1, paddingLeft:14 }}>
            <p style={{ fontSize:10, opacity:.75, marginBottom:2 }}>You will get</p>
            <p style={{ fontSize:19, fontWeight:800 }}>₹{fmt(totalToGet,0)}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>
        <div className="searchbar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input placeholder="Search parties…" value={search} onChange={e => setSearch(e.target.value)}/>
          {search && <button onClick={() => setSearch('')} style={{ fontSize:18, color:'var(--text3)' }}>×</button>}
        </div>

        {/* Category filter chips */}
        {categories.length > 0 && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
            <button onClick={() => setSelCat('')} style={{ padding:'5px 14px', borderRadius:50, fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer', border:'1.5px solid var(--border)', background: selCat===''?'var(--blue)':'white', color: selCat===''?'white':'var(--text2)' }}>All</button>
            {categories.map(c => (
              <button key={c._id} onClick={() => setSelCat(id => id===c._id?'':c._id)}
                style={{ padding:'5px 14px', borderRadius:50, fontSize:12, fontWeight:600, fontFamily:'inherit', cursor:'pointer', border:`1.5px solid ${selCat===c._id?c.color:'var(--border)'}`, background: selCat===c._id?c.color:'white', color: selCat===c._id?'white':'var(--text2)' }}>
                {c.icon} {c.name}
              </button>
            ))}
          </div>
        )}

        {loading ? <div className="spinner"><div className="spin"/></div>
          : parties.length === 0 ? (
            <div className="empty"><div className="ico">👥</div><h3>No parties found</h3><p>Tap below to add a party</p></div>
          ) : parties.map(p => (
            <div key={p._id} className="list-item" style={{ cursor:'pointer' }}>
              {/* Main area → go to detail */}
              <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }} onClick={() => navigate(`/parties/${p._id}`)}>
                <div className="avatar" style={{ background: avatarColor(p.name) }}>{avatarLetter(p.name)}</div>
                <div className="li-info">
                  <h3>{p.name}</h3>
                  <p>{p.categoryId?.icon} {p.categoryId?.name}{p.phone ? ` · ${p.phone}` : ''}</p>
                </div>
                <div className="li-right">
                  <p className={balanceClass(p.balance)} style={{ fontSize:15 }}>₹{fmt(Math.abs(p.balance),0)}</p>
                  <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{p.balance>0?'to get':p.balance<0?'to give':'settled'}</p>
                </div>
              </div>
              {/* Delete button */}
              <button
                onClick={e => { e.stopPropagation(); setConfirmDel(p); }}
                style={{ marginLeft:8, flexShrink:0, width:32, height:32, borderRadius:8, background:'var(--red-lt)', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15 }}>
                🗑️
              </button>
            </div>
          ))
        }
      </div>

      <button className="fab fab-blue" onClick={() => navigate('/parties/add')}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        ADD PARTY
      </button>

      {/* Delete confirmation sheet */}
      {confirmDel && (
        <div className="overlay" onClick={() => setConfirmDel(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete "{confirmDel.name}"?</h3>
            <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>
              This permanently deletes this party and all their transactions. This cannot be undone.
            </p>
            <div style={{ display:'flex', gap:10 }}>
              <button className="btn btn-ghost btn-full" onClick={() => setConfirmDel(null)}>Cancel</button>
              <button className="btn btn-red btn-full" onClick={() => deleteParty(confirmDel)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

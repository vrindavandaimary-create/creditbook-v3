import React, { useEffect, useState, useCallback } from 'react';
import { txAPI, partyAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';

export default function Reports() {
  const [txs,      setTxs]      = useState([]);
  const [parties,  setParties]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filter,   setFilter]   = useState({ type:'', startDate:'', endDate:'', partyId:'' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type)      params.type      = filter.type;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate)   params.endDate   = filter.endDate;
      if (filter.partyId)   params.partyId   = filter.partyId;
      const [tR, pR] = await Promise.all([
        txAPI.getAll(params),
        partyAPI.getAll(),
      ]);
      setTxs(tR.data.data || []);
      setParties(pR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const totalIn  = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);
  const setF = (k,v) => setFilter(f => ({...f,[k]:v}));

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:80 }}>
      <div className="grad-blue" style={{ padding:'18px 16px 22px', color:'white' }}>
        <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>📊 Reports</h2>
        <div style={{ display:'flex', gap:12, marginTop:14 }}>
          <div style={{ flex:1, background:'rgba(255,255,255,.13)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:10, opacity:.7 }}>Total Received</p>
            <p style={{ fontSize:19, fontWeight:800, color:'#4ade80' }}>₹{fmt(totalIn,0)}</p>
          </div>
          <div style={{ flex:1, background:'rgba(255,255,255,.13)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:10, opacity:.7 }}>Total Given</p>
            <p style={{ fontSize:19, fontWeight:800, color:'#f87171' }}>₹{fmt(totalOut,0)}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>
        <div className="card card-p" style={{ marginBottom:14 }}>
          <p style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'var(--text2)' }}>🔍 Filters</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div className="field" style={{ margin:0 }}>
              <label>Type</label>
              <select value={filter.type} onChange={e=>setF('type',e.target.value)} style={{ fontSize:14, background:'transparent' }}>
                <option value="">All</option>
                <option value="got">Received</option>
                <option value="gave">Given</option>
              </select>
            </div>
            <div className="field" style={{ margin:0 }}>
              <label>Party</label>
              <select value={filter.partyId} onChange={e=>setF('partyId',e.target.value)} style={{ fontSize:13, background:'transparent' }}>
                <option value="">All</option>
                {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </div>
            <div className="field" style={{ margin:0 }}><label>From</label><input type="date" value={filter.startDate} onChange={e=>setF('startDate',e.target.value)} style={{ fontSize:13 }}/></div>
            <div className="field" style={{ margin:0 }}><label>To</label><input type="date" value={filter.endDate} onChange={e=>setF('endDate',e.target.value)} style={{ fontSize:13 }}/></div>
          </div>
          {(filter.type||filter.startDate||filter.endDate||filter.partyId) && (
            <button onClick={()=>setFilter({type:'',startDate:'',endDate:'',partyId:''})} style={{ marginTop:10, color:'var(--red)', fontSize:12, fontWeight:600, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Clear filters</button>
          )}
        </div>

        {loading ? <div className="spinner"><div className="spin"/></div>
          : txs.length===0 ? (
            <div className="empty"><div className="ico">📋</div><h3>No transactions found</h3></div>
          ) : (
            <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
              {txs.map(tx => (
                <div key={tx._id} className="tx-item">
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:700 }}>{tx.partyId?.name||'—'}</p>
                    <p className="tx-date">{fmtDate(tx.date)}</p>
                    {tx.note && <p className="tx-note">{tx.note}</p>}
                  </div>
                  <div style={{ textAlign:'right', marginLeft:10 }}>
                    <p className={tx.type==='got'?'amt-pos':'amt-neg'} style={{ fontSize:15 }}>{tx.type==='got'?'+':'-'}₹{fmt(tx.amount,2)}</p>
                    <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{tx.type==='got'?'Received':'Given'}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}

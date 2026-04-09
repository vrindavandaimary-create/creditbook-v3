import React, { useEffect, useState, useCallback } from 'react';
import { txAPI, partyAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const getRangeForPeriod = (p) => {
  const now = new Date(), today = localDateStr(now);
  if (p === 'today') return { startDate: today, endDate: today };
  if (p === 'week')  { const s = new Date(now); s.setDate(now.getDate()-6); return { startDate: localDateStr(s), endDate: today }; }
  if (p === 'month') return { startDate: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
  if (p === 'year')  return { startDate: localDateStr(new Date(now.getFullYear(), 0, 1)), endDate: today };
  return { startDate: '', endDate: '' };
};

/* ── Bar Chart ── */
function BarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => Math.max(d.received, d.given)), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height:130, padding:'0 2px', position:'relative' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', position:'relative' }}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          onTouchStart={() => setHovered(i)} onTouchEnd={() => setTimeout(() => setHovered(null), 1200)}>
          {hovered === i && (
            <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)', background:'#1a1d2e', color:'white', borderRadius:8, padding:'5px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap', zIndex:10, marginBottom:4 }}>
              +₹{fmt(d.received,0)} / -₹{fmt(d.given,0)}
            </div>
          )}
          <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:106 }}>
            <div style={{ flex:1, background: hovered===i?'#16a34a':'#4ade80', borderRadius:'3px 3px 0 0', height:`${(d.received/max)*100}%`, minHeight:d.received>0?3:0, transition:'all .25s' }}/>
            <div style={{ flex:1, background: hovered===i?'#dc2626':'#f87171', borderRadius:'3px 3px 0 0', height:`${(d.given/max)*100}%`, minHeight:d.given>0?3:0, transition:'all .25s' }}/>
          </div>
          <p style={{ fontSize:9, color:'var(--text4)', marginTop:3, textAlign:'center' }}>{d.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── PDF export ── */
const exportPDF = (txs, user, period, totalIn, totalOut) => {
  const labels = { today:'Today', week:'This Week', month:'This Month', year:'This Year', custom:'Custom' };
  const net = totalIn - totalOut;
  const partySummary = {};
  txs.forEach(t => {
    const n = t.partyId?.name||'—';
    if (!partySummary[n]) partySummary[n] = { received:0, given:0 };
    if (t.type==='got')  partySummary[n].received += t.amount;
    if (t.type==='gave') partySummary[n].given    += t.amount;
  });
  const partyRows = Object.entries(partySummary).sort((a,b)=>(b[1].received+b[1].given)-(a[1].received+a[1].given))
    .map(([n,s]) => `<tr><td>${n}</td><td style="color:#1a9e5c">+₹${fmt(s.received,2)}</td><td style="color:#e53935">-₹${fmt(s.given,2)}</td><td style="color:${s.received-s.given>=0?'#1a9e5c':'#e53935'};font-weight:800">${s.received-s.given>=0?'+':'-'}₹${fmt(Math.abs(s.received-s.given),2)}</td></tr>`).join('');
  const txRows = txs.map(t => `<tr><td>${fmtDate(t.date)}</td><td>${t.partyId?.name||'—'}</td><td style="color:${t.type==='got'?'#1a9e5c':'#e53935'};font-weight:700">${t.type==='got'?'+':'-'}₹${fmt(t.amount,2)}</td><td style="color:#888">${t.note||''}</td></tr>`).join('');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CreditBook Report</title>
  <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px;color:#1a1d2e}
  .hdr{background:linear-gradient(135deg,#1a4fd6,#0e2a8a);color:#fff;padding:16px;border-radius:8px;margin-bottom:16px}
  .hdr h1{margin:0 0 3px;font-size:18px}.hdr p{margin:0;opacity:.8;font-size:11px}
  .summary{display:flex;gap:8px;margin-bottom:16px}.sc{flex:1;padding:10px;border-radius:6px}
  .sc .l{font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:2px}.sc .v{font-size:16px;font-weight:800}
  h2{font-size:11px;color:#4a5068;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 6px}
  table{width:100%;border-collapse:collapse}thead{background:#f0f4ff}th{padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#4a5068;text-transform:uppercase}
  td{padding:6px 8px;border-bottom:1px solid #eee}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:14px;padding-top:10px;border-top:1px solid #eee}
  @media print{body{padding:10px}}</style></head><body>
  <div class="hdr"><h1>📒 CreditBook Report</h1><p>${user?.businessName||'My Business'} · ${labels[period]||period} · ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p></div>
  <div class="summary">
    <div class="sc" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Received</div><div class="v" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div></div>
    <div class="sc" style="background:#fff0f0"><div class="l" style="color:#e53935">Given</div><div class="v" style="color:#e53935">₹${fmt(totalOut,2)}</div></div>
    <div class="sc" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Net</div><div class="v" style="color:#1a4fd6">${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}</div></div>
    <div class="sc" style="background:#f8f8f8"><div class="l" style="color:#666">Transactions</div><div class="v">${txs.length}</div></div>
  </div>
  <h2>Party Summary</h2><table><thead><tr><th>Party</th><th>Received</th><th>Given</th><th>Net</th></tr></thead><tbody>${partyRows}</tbody></table>
  <h2>All Transactions</h2><table><thead><tr><th>Date</th><th>Party</th><th>Amount</th><th>Note</th></tr></thead><tbody>${txRows}</tbody></table>
  <div class="footer">CreditBook · ${user?.name||''} · ${new Date().toLocaleString('en-IN')}</div></body></html>`;
  const win = window.open(URL.createObjectURL(new Blob([html],{type:'text/html'})),'_blank');
  if (win) win.onload = () => win.print();
};

/* ══════════════════════════════════
   MAIN ANALYTICS
══════════════════════════════════ */
export default function Analytics() {
  const { user } = useAuth();
  const [txs,       setTxs]       = useState([]);
  const [parties,   setParties]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [period,    setPeriod]    = useState('month');
  const [filter,    setFilter]    = useState({ type:'', partyId:'', ...getRangeForPeriod('month') });
  const [showCustom,setShowCustom]= useState(false);
  const [cStart,    setCStart]    = useState('');
  const [cEnd,      setCEnd]      = useState('');

  const PERIODS = [
    {key:'today',label:'Today'},{key:'week',label:'Week'},
    {key:'month',label:'Month'},{key:'year',label:'Year'},{key:'custom',label:'Custom'},
  ];

  const selectPeriod = p => {
    setPeriod(p);
    if (p === 'custom') { setShowCustom(true); return; }
    setShowCustom(false);
    setFilter(f => ({ ...f, ...getRangeForPeriod(p) }));
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit:1000 };
      if (filter.type)      params.type      = filter.type;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate)   params.endDate   = filter.endDate;
      if (filter.partyId)   params.partyId   = filter.partyId;
      const [tR, pR] = await Promise.all([txAPI.getAll(params), partyAPI.getAll()]);
      setTxs(tR.data.data || []); setParties(pR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  /* ── Stats ── */
  const totalIn  = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);
  const net      = totalIn - totalOut;

  /* Party breakdown */
  const byParty = {};
  txs.forEach(t => {
    const n = t.partyId?.name||'—';
    if (!byParty[n]) byParty[n] = { received:0, given:0, count:0 };
    if (t.type==='got')  byParty[n].received += t.amount;
    if (t.type==='gave') byParty[n].given    += t.amount;
    byParty[n].count++;
  });
  const partyArr = Object.entries(byParty).sort((a,b)=>(b[1].received+b[1].given)-(a[1].received+a[1].given));

  /* Outstanding */
  const toGet  = [...parties].filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5);
  const toGive = [...parties].filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,5);

  /* Chart */
  const chartData = (() => {
    if (!txs.length) return [];
    if (period==='today') {
      return Array.from({length:8},(_,i)=>{
        const h=i*3;
        const received=txs.filter(t=>t.type==='got'&&new Date(t.date).getHours()>=h&&new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        const given=txs.filter(t=>t.type==='gave'&&new Date(t.date).getHours()>=h&&new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        return {label:`${h}h`,received,given};
      }).filter(d=>d.received>0||d.given>0);
    }
    if (period==='week') {
      return Array.from({length:7},(_,i)=>{
        const d=new Date();d.setDate(d.getDate()-6+i);
        const ds=localDateStr(d);
        const received=txs.filter(t=>t.type==='got'&&localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        const given=txs.filter(t=>t.type==='gave'&&localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        return {label:d.toLocaleDateString('en-IN',{weekday:'short'}),received,given};
      });
    }
    const months={};
    txs.forEach(t=>{
      const d=new Date(t.date),mk=`${d.getFullYear()}-${d.getMonth()}`;
      const label=d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
      if(!months[mk]) months[mk]={label,received:0,given:0,_m:d.getFullYear()*12+d.getMonth()};
      if(t.type==='got') months[mk].received+=t.amount;
      if(t.type==='gave') months[mk].given+=t.amount;
    });
    return Object.values(months).sort((a,b)=>a._m-b._m);
  })();

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>

      {/* Header */}
      <div className="grad-blue" style={{ padding:'18px 16px 18px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>📊 Analytics</h2>
          <button onClick={() => exportPDF(txs, user, period, totalIn, totalOut)} disabled={!txs.length}
            style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.35)', color:'white', borderRadius:50, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:txs.length?'pointer':'not-allowed', fontFamily:'inherit', opacity:txs.length?1:.5 }}>
            ⬇️ PDF
          </button>
        </div>
        {/* 3 summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            {label:'RECEIVED', value:`₹${fmt(totalIn,0)}`, color:'#4ade80'},
            {label:'GIVEN',    value:`₹${fmt(totalOut,0)}`, color:'#f87171'},
            {label:'NET',      value:`${net>=0?'+':'-'}₹${fmt(Math.abs(net),0)}`, color:net>=0?'#4ade80':'#f87171'},
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 10px' }}>
              <p style={{ fontSize:9, opacity:.7, marginBottom:3, fontWeight:700 }}>{s.label}</p>
              <p style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>

        {/* Period tabs */}
        <div style={{ display:'flex', gap:5, marginBottom:12 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => selectPeriod(p.key)}
              style={{ flex:1, padding:'8px 2px', borderRadius:50, fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
                border:`1.5px solid ${period===p.key?'var(--blue)':'var(--border)'}`,
                background:period===p.key?'var(--blue)':'white',
                color:period===p.key?'white':'var(--text2)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date */}
        {showCustom && (
          <div className="card card-p" style={{ marginBottom:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div className="field" style={{ margin:0 }}><label>From</label><input type="date" value={cStart} onChange={e=>setCStart(e.target.value)} style={{ fontSize:13 }}/></div>
              <div className="field" style={{ margin:0 }}><label>To</label><input type="date" value={cEnd} onChange={e=>setCEnd(e.target.value)} style={{ fontSize:13 }}/></div>
            </div>
            <button className="btn btn-primary btn-full" style={{ padding:11 }}
              onClick={() => { if(cStart&&cEnd){setFilter(f=>({...f,startDate:cStart,endDate:cEnd}));setShowCustom(false);} }}>
              Apply
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <div className="field" style={{ margin:0, flex:1 }}>
            <label>Type</label>
            <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All</option>
              <option value="got">Received</option>
              <option value="gave">Given</option>
            </select>
          </div>
          <div className="field" style={{ margin:0, flex:1 }}>
            <label>Party</label>
            <select value={filter.partyId} onChange={e=>setFilter(f=>({...f,partyId:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All</option>
              {parties.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="spinner"><div className="spin"/></div> : txs.length === 0 ? (
          <div className="empty"><div className="ico">📊</div><h3>No data for this period</h3><p>Try a different time range</p></div>
        ) : (
          <>
            {/* Trend chart */}
            {chartData.length > 0 && (
              <div className="card card-p" style={{ marginBottom:14 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)' }}>Trend</p>
                  <div style={{ display:'flex', gap:10 }}>
                    {[['#4ade80','Received'],['#f87171','Given']].map(([c,l])=>(
                      <span key={l} style={{ fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', gap:3 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }}/>{l}
                      </span>
                    ))}
                  </div>
                </div>
                <BarChart data={chartData}/>
              </div>
            )}

            {/* Outstanding balances */}
            {(toGet.length > 0 || toGive.length > 0) && (
              <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', padding:'12px 14px 8px' }}>Outstanding</p>
                {toGet.map(p => (
                  <div key={p._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderTop:'1px solid var(--border)' }}>
                    <p style={{ fontSize:14, fontWeight:600 }}>{p.name}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:'var(--green)' }}>+₹{fmt(p.balance,0)}</p>
                  </div>
                ))}
                {toGive.map(p => (
                  <div key={p._id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'9px 14px', borderTop:'1px solid var(--border)' }}>
                    <p style={{ fontSize:14, fontWeight:600 }}>{p.name}</p>
                    <p style={{ fontSize:14, fontWeight:800, color:'var(--red)' }}>-₹{fmt(Math.abs(p.balance),0)}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Party breakdown */}
            {partyArr.length > 0 && (
              <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
                <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', padding:'12px 14px 8px' }}>By Party</p>
                {partyArr.map(([name, s], i) => (
                  <div key={i} style={{ padding:'10px 14px', borderTop:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <p style={{ fontWeight:700, fontSize:14 }}>{name}</p>
                      <p style={{ fontSize:12, color:'var(--text3)' }}>{s.count} txns</p>
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      <p style={{ fontSize:13, color:'var(--green)', fontWeight:600 }}>+₹{fmt(s.received,0)}</p>
                      <p style={{ fontSize:13, color:'var(--red)', fontWeight:600 }}>-₹{fmt(s.given,0)}</p>
                      <p style={{ fontSize:13, fontWeight:800, color:s.received-s.given>=0?'var(--green)':'var(--red)' }}>
                        net {s.received-s.given>=0?'+':'-'}₹{fmt(Math.abs(s.received-s.given),0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Transaction list */}
            <p className="sec-title">{txs.length} Transactions</p>
            <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
              {txs.map(tx => (
                <div key={tx._id} className="tx-item">
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:14, fontWeight:700 }}>{tx.partyId?.name||'—'}</p>
                    <p className="tx-date">{fmtDate(tx.date)}</p>
                    {tx.note && <p className="tx-note">{tx.note}</p>}
                  </div>
                  <div style={{ textAlign:'right', marginLeft:10 }}>
                    <p style={{ fontSize:15, fontWeight:800, color:tx.type==='got'?'var(--green)':'var(--red)' }}>
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
    </div>
  );
}

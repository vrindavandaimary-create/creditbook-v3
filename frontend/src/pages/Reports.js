import React, { useEffect, useState, useCallback } from 'react';
import { txAPI, partyAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

/* ── Timezone-safe local date string ── */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const getRangeForPeriod = (period) => {
  const now = new Date(), today = localDateStr(now);
  switch(period) {
    case 'today': return { startDate: today, endDate: today };
    case 'week':  { const s = new Date(now); s.setDate(now.getDate()-6); return { startDate: localDateStr(s), endDate: today }; }
    case 'month': return { startDate: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
    case 'year':  return { startDate: localDateStr(new Date(now.getFullYear(), 0, 1)), endDate: today };
    default:      return { startDate: '', endDate: '' };
  }
};

/* ── Bar Chart ── */
function BarChart({ data, height = 140 }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.received, d.given)), 1);
  return (
    <div style={{ position:'relative' }}>
      <div style={{ display:'flex', alignItems:'flex-end', gap:3, height, padding:'0 4px' }}>
        {data.map((d, i) => (
          <div key={i}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            onTouchStart={() => setHovered(i)} onTouchEnd={() => setHovered(null)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', cursor:'default', position:'relative' }}>
            {hovered === i && (
              <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)', background:'#1a1d2e', color:'white', borderRadius:8, padding:'5px 8px', fontSize:10, fontWeight:700, whiteSpace:'nowrap', zIndex:10, marginBottom:4 }}>
                +₹{fmt(d.received,0)} / -₹{fmt(d.given,0)}
              </div>
            )}
            <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:height-24 }}>
              <div style={{ flex:1, background: hovered===i?'#22c55e':'#4ade80', borderRadius:'4px 4px 0 0', height:`${(d.received/maxVal)*100}%`, minHeight:d.received>0?4:0, transition:'all .3s' }}/>
              <div style={{ flex:1, background: hovered===i?'#ef4444':'#f87171', borderRadius:'4px 4px 0 0', height:`${(d.given/maxVal)*100}%`, minHeight:d.given>0?4:0, transition:'all .3s' }}/>
            </div>
            <p style={{ fontSize:9, color:'var(--text4)', textAlign:'center', lineHeight:1.2, marginTop:3 }}>{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Donut Chart ── */
function DonutChart({ received, given }) {
  const total = received + given || 1;
  const r = 44, cx = 60, cy = 60, strokeW = 13, circ = 2 * Math.PI * r;
  const recDash = (received / total) * circ;
  return (
    <svg width={120} height={120} style={{ display:'block', margin:'0 auto' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fca5a5" strokeWidth={strokeW}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth={strokeW}
        strokeDasharray={`${recDash} ${circ}`} strokeDashoffset={0}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}/>
      <text x={cx} y={cy-5} textAnchor="middle" fontSize="10" fill="#4a5068" fontWeight="700">NET</text>
      <text x={cx} y={cy+9} textAnchor="middle" fontSize="11" fill="#1a1d2e" fontWeight="800">
        {received >= given ? '+' : '-'}₹{fmt(Math.abs(received-given),0)}
      </text>
    </svg>
  );
}

/* ── Sparkline ── */
function Sparkline({ values, color = '#4ade80' }) {
  if (!values?.length) return null;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 80, H = 30;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={W} height={H} style={{ display:'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
    </svg>
  );
}

/* ── PDF Generator ── */
const generatePDF = (txs, user, period, totalIn, totalOut, partySummaryArr) => {
  const periodLabels = { today:'Today', week:'This Week', month:'This Month', year:'This Year', custom:'Custom Range' };
  const net = totalIn - totalOut;

  const partyRows = partySummaryArr.map(p =>
    `<tr><td>${p.name}</td><td style="color:#1a9e5c">+₹${fmt(p.received,2)}</td><td style="color:#e53935">-₹${fmt(p.given,2)}</td><td style="color:${p.received-p.given>=0?'#1a9e5c':'#e53935'};font-weight:800">${p.received-p.given>=0?'+':'-'}₹${fmt(Math.abs(p.received-p.given),2)}</td><td>${p.count}</td></tr>`
  ).join('');

  const txRows = txs.map(tx =>
    `<tr><td>${fmtDate(tx.date)}</td><td>${tx.partyId?.name||'—'}</td><td style="color:${tx.type==='got'?'#1a9e5c':'#e53935'};font-weight:700">${tx.type==='got'?'+':'-'}₹${fmt(tx.amount,2)}</td><td style="color:#888">${tx.note||''}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>CreditBook Report</title>
  <style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;color:#1a1d2e;font-size:12px}
  .hdr{background:linear-gradient(135deg,#1a4fd6,#0e2a8a);color:white;padding:18px 20px;border-radius:10px;margin-bottom:16px}
  .hdr h1{margin:0 0 3px;font-size:20px}.hdr p{margin:0;opacity:.8;font-size:11px}
  .summary{display:flex;gap:10px;margin-bottom:16px}.sc{flex:1;padding:12px;border-radius:8px}
  .sc .lbl{font-size:9px;font-weight:700;text-transform:uppercase;margin-bottom:3px}.sc .amt{font-size:18px;font-weight:800}
  h2{font-size:12px;margin:16px 0 6px;color:#4a5068;text-transform:uppercase;letter-spacing:.5px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px}thead{background:#f0f4ff}
  th{padding:7px 8px;text-align:left;font-size:10px;font-weight:700;color:#4a5068;text-transform:uppercase}
  td{padding:7px 8px;border-bottom:1px solid #eee}
  .footer{text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:10px;margin-top:10px}
  @media print{body{padding:10px}}</style></head><body>
  <div class="hdr"><h1>📒 CreditBook Analytics Report</h1>
  <p>${user?.businessName||'My Business'} &nbsp;•&nbsp; ${periodLabels[period]||period} &nbsp;•&nbsp; ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p></div>
  <div class="summary">
    <div class="sc" style="background:#e6f9f0"><div class="lbl" style="color:#1a9e5c">Total Received</div><div class="amt" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div></div>
    <div class="sc" style="background:#fff0f0"><div class="lbl" style="color:#e53935">Total Given</div><div class="amt" style="color:#e53935">₹${fmt(totalOut,2)}</div></div>
    <div class="sc" style="background:#e8eeff"><div class="lbl" style="color:#1a4fd6">Net Balance</div><div class="amt" style="color:#1a4fd6">${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}</div></div>
    <div class="sc" style="background:#f8f8f8"><div class="lbl" style="color:#666">Transactions</div><div class="amt" style="color:#1a1d2e">${txs.length}</div></div>
  </div>
  <h2>Party-wise Summary</h2>
  <table><thead><tr><th>Party</th><th>Received</th><th>Given</th><th>Net</th><th>Txns</th></tr></thead><tbody>${partyRows}</tbody></table>
  <h2>All Transactions</h2>
  <table><thead><tr><th>Date</th><th>Party</th><th>Amount</th><th>Note</th></tr></thead><tbody>${txRows}</tbody></table>
  <div class="footer">CreditBook &nbsp;•&nbsp; ${user?.name||''} &nbsp;•&nbsp; ${new Date().toLocaleString('en-IN')}</div>
  </body></html>`;

  const blob = new Blob([html], { type:'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) { win.onload = () => { win.print(); setTimeout(() => URL.revokeObjectURL(url), 3000); }; }
};

/* ══════════════════════════════════════════════
   MAIN ANALYTICS COMPONENT
══════════════════════════════════════════════ */
export default function Analytics() {
  const { user } = useAuth();
  const [txs,         setTxs]        = useState([]);
  const [parties,     setParties]    = useState([]);
  const [loading,     setLoading]    = useState(true);
  const [period,      setPeriod]     = useState('month');
  const [filter,      setFilter]     = useState({ type:'', partyId:'', ...getRangeForPeriod('month') });
  const [showCustom,  setShowCustom] = useState(false);
  const [customStart, setCustomStart]= useState('');
  const [customEnd,   setCustomEnd]  = useState('');
  const [activeTab,   setActiveTab]  = useState('overview');

  const PERIODS = [
    { key:'today', label:'Today'  },
    { key:'week',  label:'Week'   },
    { key:'month', label:'Month'  },
    { key:'year',  label:'Year'   },
    { key:'custom',label:'Custom' },
  ];

  const TABS = [
    { key:'overview',     label:'📊 Overview'     },
    { key:'parties',      label:'👤 Parties'       },
    { key:'transactions', label:'📋 Transactions'  },
    { key:'insights',     label:'💡 Insights'      },
  ];

  const selectPeriod = (p) => {
    setPeriod(p);
    if (p === 'custom') { setShowCustom(true); return; }
    setShowCustom(false);
    setFilter(f => ({ ...f, ...getRangeForPeriod(p) }));
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setFilter(f => ({ ...f, startDate: customStart, endDate: customEnd }));
    setShowCustom(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      if (filter.type)      params.type      = filter.type;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate)   params.endDate   = filter.endDate;
      if (filter.partyId)   params.partyId   = filter.partyId;
      const [tR, pR] = await Promise.all([txAPI.getAll(params), partyAPI.getAll()]);
      setTxs(tR.data.data || []);
      setParties(pR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  /* ── Computed stats ── */
  const totalIn  = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);
  const net      = totalIn - totalOut;
  const txCount  = txs.length;
  const avgTx    = txCount > 0 ? (totalIn + totalOut) / txCount : 0;

  const biggestIn  = txs.filter(t=>t.type==='got').reduce((m,t)=>t.amount>(m?.amount||0)?t:m, null);
  const biggestOut = txs.filter(t=>t.type==='gave').reduce((m,t)=>t.amount>(m?.amount||0)?t:m, null);

  /* Party-wise summary */
  const partySummary = {};
  txs.forEach(t => {
    const id = t.partyId?._id || 'unknown', name = t.partyId?.name || '—';
    if (!partySummary[id]) partySummary[id] = { name, received:0, given:0, count:0, dates:[] };
    if (t.type==='got')  partySummary[id].received += t.amount;
    if (t.type==='gave') partySummary[id].given    += t.amount;
    partySummary[id].count++;
    partySummary[id].dates.push(new Date(t.date));
  });
  const partySummaryArr = Object.values(partySummary).sort((a,b)=>(b.received+b.given)-(a.received+a.given));

  /* Outstanding balances */
  const topOwed  = [...parties].filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5);
  const topOwing = [...parties].filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,5);
  const totalOwed  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalOwing = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

  /* Chart data */
  const chartData = (() => {
    if (!txs.length) return [];
    if (period === 'today') {
      return Array.from({length:8}, (_,i) => {
        const h = i*3;
        const received = txs.filter(t=>t.type==='got'  && new Date(t.date).getHours()>=h && new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        const given    = txs.filter(t=>t.type==='gave' && new Date(t.date).getHours()>=h && new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        return { label:`${h}h`, received, given };
      }).filter(d=>d.received>0||d.given>0);
    }
    if (period === 'week') {
      return Array.from({length:7}, (_,i) => {
        const d  = new Date(); d.setDate(d.getDate()-6+i);
        const ds = localDateStr(d);
        const received = txs.filter(t=>t.type==='got'  && localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        const given    = txs.filter(t=>t.type==='gave' && localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        return { label: d.toLocaleDateString('en-IN',{weekday:'short'}), received, given };
      });
    }
    if (period === 'month') {
      const days = {};
      txs.forEach(t => {
        const d = new Date(t.date), dk = `${d.getDate()}`;
        if (!days[dk]) days[dk] = { label:dk, received:0, given:0, _d:d.getDate() };
        if (t.type==='got')  days[dk].received += t.amount;
        if (t.type==='gave') days[dk].given    += t.amount;
      });
      return Object.values(days).sort((a,b)=>a._d-b._d);
    }
    const months = {};
    txs.forEach(t => {
      const d = new Date(t.date), mk = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
      if (!months[mk]) months[mk] = { label, received:0, given:0, _m: d.getFullYear()*12+d.getMonth() };
      if (t.type==='got')  months[mk].received += t.amount;
      if (t.type==='gave') months[mk].given    += t.amount;
    });
    return Object.values(months).sort((a,b)=>a._m-b._m);
  })();

  /* Daily sparkline for insights */
  const last7Days = Array.from({length:7}, (_,i) => {
    const d = new Date(); d.setDate(d.getDate()-6+i);
    const ds = localDateStr(d);
    return txs.filter(t=>localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
  });

  /* Insights */
  const insights = [];
  if (net > 0) insights.push({ type:'positive', icon:'📈', text:`You're net positive by ₹${fmt(net,0)} this period. Keep it up!` });
  if (net < 0) insights.push({ type:'warning',  icon:'📉', text:`You're net negative by ₹${fmt(Math.abs(net),0)}. More was given than received.` });
  if (topOwed.length > 0) insights.push({ type:'info', icon:'💰', text:`₹${fmt(totalOwed,0)} is pending collection from ${topOwed.length} parties. ${topOwed[0].name} owes the most: ₹${fmt(topOwed[0].balance,0)}.` });
  if (totalOwing > 0) insights.push({ type:'warning', icon:'💸', text:`You owe ₹${fmt(totalOwing,0)} to ${topOwing.length} parties.` });
  if (avgTx > 0) insights.push({ type:'info', icon:'📊', text:`Average transaction size: ₹${fmt(avgTx,0)} across ${txCount} transactions.` });
  if (biggestIn) insights.push({ type:'positive', icon:'⬆️', text:`Largest receipt: ₹${fmt(biggestIn.amount,0)} from ${biggestIn.partyId?.name||'?'} on ${fmtDate(biggestIn.date)}.` });
  if (biggestOut) insights.push({ type:'info', icon:'⬇️', text:`Largest payment: ₹${fmt(biggestOut.amount,0)} to ${biggestOut.partyId?.name||'?'} on ${fmtDate(biggestOut.date)}.` });
  if (partySummaryArr.length > 0) insights.push({ type:'info', icon:'🤝', text:`Most active party: ${partySummaryArr[0].name} with ${partySummaryArr[0].count} transactions totaling ₹${fmt(partySummaryArr[0].received+partySummaryArr[0].given,0)}.` });

  const insightColor = { positive:'var(--green-lt)', warning:'var(--red-lt)', info:'var(--blue-lt)' };
  const insightBorder = { positive:'var(--green)', warning:'var(--red)', info:'var(--blue)' };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>

      {/* ── Header ── */}
      <div className="grad-blue" style={{ padding:'18px 16px 18px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>📊 Analytics</h2>
          <button onClick={() => generatePDF(txs, user, period, totalIn, totalOut, partySummaryArr)}
            disabled={txs.length===0}
            style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.4)', color:'white', borderRadius:50, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:txs.length===0?'not-allowed':'pointer', fontFamily:'inherit', opacity:txs.length===0?.5:1 }}>
            ⬇️ PDF
          </button>
        </div>

        {/* 4 stat cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:12 }}>
          {[
            { label:'TOTAL RECEIVED', value:`₹${fmt(totalIn,0)}`, color:'#4ade80' },
            { label:'TOTAL GIVEN',    value:`₹${fmt(totalOut,0)}`, color:'#f87171' },
            { label:'NET BALANCE',    value:`${net>=0?'+':'-'}₹${fmt(Math.abs(net),0)}`, color:net>=0?'#4ade80':'#f87171' },
            { label:'AVG PER TXN',   value:txCount>0?`₹${fmt(avgTx,0)}`:'—', color:'#e0e7ff' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'11px 12px' }}>
              <p style={{ fontSize:9, opacity:.75, marginBottom:3, fontWeight:700, letterSpacing:.5 }}>{s.label}</p>
              <p style={{ fontSize:18, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Sparkline + period summary */}
        <div style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'10px 14px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:10, opacity:.7, marginBottom:2 }}>Last 7 days activity</p>
            <Sparkline values={last7Days} color="#4ade80"/>
          </div>
          <div style={{ textAlign:'right' }}>
            <p style={{ fontSize:11, opacity:.7 }}>{txCount} transactions</p>
            <p style={{ fontSize:11, fontWeight:700 }}>{filter.startDate} → {filter.endDate}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>

        {/* Period selector */}
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
            <p style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'var(--text2)' }}>Custom Date Range</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div className="field" style={{ margin:0 }}><label>From</label><input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} style={{ fontSize:13 }}/></div>
              <div className="field" style={{ margin:0 }}><label>To</label><input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} style={{ fontSize:13 }}/></div>
            </div>
            <button className="btn btn-primary btn-full" onClick={applyCustom} style={{ padding:11 }}>Apply Range</button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', background:'var(--input-bg)', borderRadius:12, padding:3, marginBottom:14, gap:3 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{ flex:1, padding:'8px 2px', borderRadius:9, fontSize:11, fontWeight:700, fontFamily:'inherit', cursor:'pointer', border:'none',
                background:activeTab===t.key?'white':'transparent',
                color:activeTab===t.key?'var(--blue)':'var(--text3)',
                boxShadow:activeTab===t.key?'0 1px 6px rgba(0,0,0,.1)':'none',
                transition:'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="spinner"><div className="spin"/></div> : (
          <>
            {/* ══ OVERVIEW TAB ══ */}
            {activeTab === 'overview' && (
              <>
                {/* Donut */}
                {(totalIn > 0 || totalOut > 0) && (
                  <div className="card card-p" style={{ marginBottom:14 }}>
                    <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:12 }}>Income vs Expense</p>
                    <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                      <DonutChart received={totalIn} given={totalOut}/>
                      <div style={{ flex:1 }}>
                        {[
                          { label:'Received', value:totalIn, color:'var(--green)', bg:'#4ade80' },
                          { label:'Given',    value:totalOut, color:'var(--red)',   bg:'#f87171' },
                        ].map(r => (
                          <div key={r.label} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                            <div style={{ width:12, height:12, borderRadius:3, background:r.bg, flexShrink:0 }}/>
                            <div>
                              <p style={{ fontSize:11, color:'var(--text3)', fontWeight:600 }}>{r.label}</p>
                              <p style={{ fontSize:16, fontWeight:800, color:r.color }}>₹{fmt(r.value,0)}</p>
                              <p style={{ fontSize:10, color:'var(--text4)' }}>{totalIn+totalOut>0?((r.value/(totalIn+totalOut))*100).toFixed(0):0}%</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Bar chart */}
                {chartData.length > 0 && (
                  <div className="card card-p" style={{ marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)' }}>Transaction Trend</p>
                      <div style={{ display:'flex', gap:10 }}>
                        {[['#4ade80','Received'],['#f87171','Given']].map(([c,l]) => (
                          <span key={l} style={{ fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', gap:3 }}>
                            <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block' }}/>{l}
                          </span>
                        ))}
                      </div>
                    </div>
                    <BarChart data={chartData} height={140}/>
                  </div>
                )}

                {/* Outstanding balances */}
                {(topOwed.length > 0 || topOwing.length > 0) && (
                  <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
                    <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)' }}>
                      <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)' }}>Outstanding Balances</p>
                      <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                        Net receivable: ₹{fmt(totalOwed,0)} &nbsp;|&nbsp; Net payable: ₹{fmt(totalOwing,0)}
                      </p>
                    </div>
                    {topOwed.length > 0 && (
                      <>
                        <p style={{ fontSize:11, fontWeight:700, color:'var(--green)', padding:'7px 14px 4px', background:'var(--green-lt)' }}>
                          Will RECEIVE from ({topOwed.length})
                        </p>
                        {topOwed.map(p => {
                          const pct = (p.balance / (topOwed[0]?.balance||1)) * 100;
                          return (
                            <div key={p._id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                                <p style={{ fontWeight:700, fontSize:14 }}>{p.name}</p>
                                <p style={{ fontWeight:800, fontSize:14, color:'var(--green)' }}>₹{fmt(p.balance,0)}</p>
                              </div>
                              <div style={{ background:'var(--border)', borderRadius:4, height:4 }}>
                                <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background:'var(--green)', transition:'width .4s' }}/>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {topOwing.length > 0 && (
                      <>
                        <p style={{ fontSize:11, fontWeight:700, color:'var(--red)', padding:'7px 14px 4px', background:'var(--red-lt)' }}>
                          Will GIVE to ({topOwing.length})
                        </p>
                        {topOwing.map(p => {
                          const pct = (Math.abs(p.balance) / (Math.abs(topOwing[0]?.balance)||1)) * 100;
                          return (
                            <div key={p._id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                                <p style={{ fontWeight:700, fontSize:14 }}>{p.name}</p>
                                <p style={{ fontWeight:800, fontSize:14, color:'var(--red)' }}>₹{fmt(Math.abs(p.balance),0)}</p>
                              </div>
                              <div style={{ background:'var(--border)', borderRadius:4, height:4 }}>
                                <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background:'var(--red)', transition:'width .4s' }}/>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </div>
                )}

                {txs.length === 0 && <div className="empty"><div className="ico">📊</div><h3>No data for this period</h3><p>Try a different time range</p></div>}
              </>
            )}

            {/* ══ PARTIES TAB ══ */}
            {activeTab === 'parties' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div className="field" style={{ margin:0 }}>
                    <label>Type</label>
                    <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ fontSize:14, background:'transparent' }}>
                      <option value="">All</option>
                      <option value="got">Received</option>
                      <option value="gave">Given</option>
                    </select>
                  </div>
                  <div className="field" style={{ margin:0 }}>
                    <label>Party</label>
                    <select value={filter.partyId} onChange={e=>setFilter(f=>({...f,partyId:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
                      <option value="">All Parties</option>
                      {parties.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>

                {partySummaryArr.length === 0
                  ? <div className="empty"><div className="ico">👤</div><h3>No party data</h3></div>
                  : (
                    <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 76px 76px 50px', gap:4, padding:'8px 14px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                        {['Party','Received','Given','Txns'].map(h=><p key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase' }}>{h}</p>)}
                      </div>
                      {partySummaryArr.map((p, i) => (
                        <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 76px 76px 50px', gap:4, padding:'11px 14px', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
                          <div>
                            <p style={{ fontWeight:700, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                            <p style={{ fontSize:10, color: p.received-p.given>=0?'var(--green)':'var(--red)', fontWeight:600, marginTop:2 }}>
                              Net: {p.received-p.given>=0?'+':'-'}₹{fmt(Math.abs(p.received-p.given),0)}
                            </p>
                          </div>
                          <p style={{ fontWeight:700, fontSize:13, color:'var(--green)' }}>+₹{fmt(p.received,0)}</p>
                          <p style={{ fontWeight:700, fontSize:13, color:'var(--red)' }}>-₹{fmt(p.given,0)}</p>
                          <p style={{ fontSize:12, color:'var(--text3)', fontWeight:600 }}>{p.count}</p>
                        </div>
                      ))}
                    </div>
                  )
                }
              </>
            )}

            {/* ══ TRANSACTIONS TAB ══ */}
            {activeTab === 'transactions' && (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
                  <div className="field" style={{ margin:0 }}>
                    <label>Type</label>
                    <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ fontSize:14, background:'transparent' }}>
                      <option value="">All</option>
                      <option value="got">Received</option>
                      <option value="gave">Given</option>
                    </select>
                  </div>
                  <div className="field" style={{ margin:0 }}>
                    <label>Party</label>
                    <select value={filter.partyId} onChange={e=>setFilter(f=>({...f,partyId:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
                      <option value="">All Parties</option>
                      {parties.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
                    </select>
                  </div>
                </div>
                <p className="sec-title">{txs.length} Transactions &nbsp;•&nbsp; Total: ₹{fmt(totalIn+totalOut,0)}</p>
                {txs.length === 0
                  ? <div className="empty"><div className="ico">📋</div><h3>No transactions found</h3><p>Try a different period or filter</p></div>
                  : (
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
                  )
                }
              </>
            )}

            {/* ══ INSIGHTS TAB ══ */}
            {activeTab === 'insights' && (
              <>
                {insights.length === 0
                  ? <div className="empty"><div className="ico">💡</div><h3>No insights yet</h3><p>Add more transactions to get smart insights</p></div>
                  : insights.map((ins, i) => (
                    <div key={i} style={{ background:insightColor[ins.type], border:`1.5px solid ${insightBorder[ins.type]}22`, borderRadius:14, padding:'14px 16px', marginBottom:10, display:'flex', gap:12, alignItems:'flex-start' }}>
                      <span style={{ fontSize:22, flexShrink:0 }}>{ins.icon}</span>
                      <p style={{ fontSize:13, lineHeight:1.6, color:'var(--text)', fontWeight:500 }}>{ins.text}</p>
                    </div>
                  ))
                }

                {/* Summary table */}
                {txs.length > 0 && (
                  <div className="card card-p" style={{ marginBottom:14, marginTop:4 }}>
                    <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:12 }}>Period Summary</p>
                    {[
                      ['Total Received',    `₹${fmt(totalIn,2)}`,        'var(--green)'],
                      ['Total Given',       `₹${fmt(totalOut,2)}`,       'var(--red)'  ],
                      ['Net Balance',       `${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}`, net>=0?'var(--green)':'var(--red)'],
                      ['Transactions',      `${txCount}`,                  'var(--text)' ],
                      ['Avg per txn',       `₹${fmt(avgTx,2)}`,           'var(--text)' ],
                      ['Unique parties',    `${partySummaryArr.length}`,   'var(--text)' ],
                      ['Largest receipt',   biggestIn?`₹${fmt(biggestIn.amount,2)}`:'—', 'var(--green)'],
                      ['Largest payment',   biggestOut?`₹${fmt(biggestOut.amount,2)}`:'—', 'var(--red)'],
                      ['Total receivable',  `₹${fmt(totalOwed,2)}`,        'var(--green)'],
                      ['Total payable',     `₹${fmt(totalOwing,2)}`,       'var(--red)'  ],
                    ].map(([label, value, color]) => (
                      <div key={label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                        <p style={{ fontSize:13, color:'var(--text2)' }}>{label}</p>
                        <p style={{ fontSize:14, fontWeight:800, color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

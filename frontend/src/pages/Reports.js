import React, { useEffect, useState, useCallback } from 'react';
import { txAPI, partyAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

/* ── Date range helpers ── */
const toDateStr = d => d.toISOString().split('T')[0];

const getRangeForPeriod = (period) => {
  const now = new Date();
  const today = toDateStr(now);
  switch(period) {
    case 'today': {
      return { startDate: today, endDate: today };
    }
    case 'week': {
      const start = new Date(now);
      start.setDate(now.getDate() - 6);
      return { startDate: toDateStr(start), endDate: today };
    }
    case 'month': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: toDateStr(start), endDate: today };
    }
    case 'year': {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: toDateStr(start), endDate: today };
    }
    default: return { startDate: '', endDate: '' };
  }
};

/* ── Simple bar chart using canvas ── */
function BarChart({ data, height = 120 }) {
  if (!data || data.length === 0) return null;
  const maxVal = Math.max(...data.map(d => Math.max(d.received, d.given)), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:4, height, padding:'0 4px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2, height:'100%', justifyContent:'flex-end' }}>
          <div style={{ width:'100%', display:'flex', gap:1, alignItems:'flex-end', height:height - 24 }}>
            <div style={{ flex:1, background:'#4ade80', borderRadius:'3px 3px 0 0', height:`${(d.received/maxVal)*100}%`, minHeight: d.received>0?3:0, transition:'height .3s' }}/>
            <div style={{ flex:1, background:'#f87171', borderRadius:'3px 3px 0 0', height:`${(d.given/maxVal)*100}%`, minHeight: d.given>0?3:0, transition:'height .3s' }}/>
          </div>
          <p style={{ fontSize:9, color:'var(--text4)', textAlign:'center', lineHeight:1.2 }}>{d.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── PDF generator (no external lib) ── */
const generatePDF = (txs, user, period, totalIn, totalOut) => {
  const periodLabels = { today:'Today', week:'This Week', month:'This Month', year:'This Year', custom:'Custom Range' };
  const rows = txs.map(tx =>
    `<tr style="border-bottom:1px solid #eee">
      <td style="padding:8px 12px">${fmtDate(tx.date)}</td>
      <td style="padding:8px 12px;font-weight:600">${tx.partyId?.name || '—'}</td>
      <td style="padding:8px 12px;color:${tx.type==='got'?'#1a9e5c':'#e53935'};font-weight:700">${tx.type==='got'?'+':'-'}₹${fmt(tx.amount,2)}</td>
      <td style="padding:8px 12px;color:#888;font-size:12px">${tx.note || ''}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>CreditBook Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 24px; color: #1a1d2e; }
    .header { background: linear-gradient(135deg,#1a4fd6,#0e2a8a); color: white; padding: 24px; border-radius: 12px; margin-bottom: 24px; }
    .header h1 { margin:0 0 4px; font-size:24px; }
    .header p { margin:0; opacity:.8; font-size:13px; }
    .summary { display:flex; gap:16px; margin-bottom:24px; }
    .summary-card { flex:1; padding:16px; border-radius:10px; }
    .received { background:#e6f9f0; }
    .given { background:#fff0f0; }
    .net { background:#e8eeff; }
    .summary-card .label { font-size:11px; font-weight:700; text-transform:uppercase; margin-bottom:4px; }
    .summary-card .amount { font-size:22px; font-weight:800; }
    table { width:100%; border-collapse:collapse; }
    thead { background:#f0f4ff; }
    th { padding:10px 12px; text-align:left; font-size:12px; font-weight:700; color:#4a5068; text-transform:uppercase; }
    .footer { margin-top:24px; text-align:center; font-size:11px; color:#aaa; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📒 CreditBook Analytics Report</h1>
    <p>${user?.businessName || 'My Business'} &nbsp;•&nbsp; ${periodLabels[period] || period} &nbsp;•&nbsp; Generated on ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</p>
  </div>
  <div class="summary">
    <div class="summary-card received">
      <div class="label" style="color:#1a9e5c">💰 Total Received</div>
      <div class="amount" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div>
    </div>
    <div class="summary-card given">
      <div class="label" style="color:#e53935">💸 Total Given</div>
      <div class="amount" style="color:#e53935">₹${fmt(totalOut,2)}</div>
    </div>
    <div class="summary-card net">
      <div class="label" style="color:#1a4fd6">📊 Net Balance</div>
      <div class="amount" style="color:#1a4fd6">₹${fmt(totalIn-totalOut,2)}</div>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>Date</th><th>Party</th><th>Amount</th><th>Note</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">CreditBook &nbsp;•&nbsp; ${txs.length} transactions &nbsp;•&nbsp; ${user?.name || ''}</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      win.print();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
  }
};

/* ── Main Analytics page ── */
export default function Analytics() {
  const { user } = useAuth();
  const [txs,      setTxs]      = useState([]);
  const [parties,  setParties]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [period,   setPeriod]   = useState('month');
  const [filter,   setFilter]   = useState({ type:'', partyId:'', ...getRangeForPeriod('month') });
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd,   setCustomEnd]   = useState('');

  const PERIODS = [
    { key:'today', label:'Today' },
    { key:'week',  label:'Week' },
    { key:'month', label:'Month' },
    { key:'year',  label:'Year' },
    { key:'custom',label:'Custom' },
  ];

  const selectPeriod = (p) => {
    setPeriod(p);
    if (p === 'custom') { setShowCustom(true); return; }
    setShowCustom(false);
    const range = getRangeForPeriod(p);
    setFilter(f => ({ ...f, ...range }));
  };

  const applyCustom = () => {
    if (!customStart || !customEnd) return;
    setFilter(f => ({ ...f, startDate: customStart, endDate: customEnd }));
    setShowCustom(false);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filter.type)      params.type      = filter.type;
      if (filter.startDate) params.startDate = filter.startDate;
      if (filter.endDate)   params.endDate   = filter.endDate;
      if (filter.partyId)   params.partyId   = filter.partyId;
      const [tR, pR] = await Promise.all([
        txAPI.getAll({ ...params, limit: 500 }),
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
  const net      = totalIn - totalOut;

  /* Build chart data — group by day/week/month depending on period */
  const chartData = (() => {
    if (txs.length === 0) return [];
    if (period === 'today') {
      const hours = [0,4,8,12,16,20];
      return hours.map(h => {
        const received = txs.filter(t=>t.type==='got' && new Date(t.date).getHours()>=h && new Date(t.date).getHours()<h+4).reduce((s,t)=>s+t.amount,0);
        const given    = txs.filter(t=>t.type==='gave'&& new Date(t.date).getHours()>=h && new Date(t.date).getHours()<h+4).reduce((s,t)=>s+t.amount,0);
        return { label:`${h}h`, received, given };
      }).filter(d => d.received > 0 || d.given > 0);
    }
    if (period === 'week') {
      return Array.from({length:7}, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - 6 + i);
        const ds = toDateStr(d);
        const received = txs.filter(t=>t.type==='got' && toDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        const given    = txs.filter(t=>t.type==='gave'&& toDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        return { label: d.toLocaleDateString('en-IN',{weekday:'short'}), received, given };
      });
    }
    if (period === 'month' || period === 'custom') {
      const weeks = {};
      txs.forEach(t => {
        const d   = new Date(t.date);
        const wk  = `W${Math.ceil(d.getDate()/7)}`;
        if (!weeks[wk]) weeks[wk] = { label:wk, received:0, given:0 };
        if (t.type==='got')  weeks[wk].received += t.amount;
        if (t.type==='gave') weeks[wk].given    += t.amount;
      });
      return Object.values(weeks);
    }
    if (period === 'year') {
      const months = {};
      txs.forEach(t => {
        const d  = new Date(t.date);
        const mk = d.toLocaleDateString('en-IN',{month:'short'});
        if (!months[mk]) months[mk] = { label:mk, received:0, given:0 };
        if (t.type==='got')  months[mk].received += t.amount;
        if (t.type==='gave') months[mk].given    += t.amount;
      });
      return Object.values(months);
    }
    return [];
  })();

  /* Top parties */
  const topParties = [...parties]
    .filter(p => p.balance !== 0)
    .sort((a,b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5);

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>

      {/* Header */}
      <div className="grad-blue" style={{ padding:'18px 16px 20px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>📊 Analytics</h2>
          <button
            onClick={() => generatePDF(txs, user, period, totalIn, totalOut)}
            disabled={txs.length === 0}
            style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.4)', color:'white', borderRadius:50, padding:'7px 14px', fontSize:12, fontWeight:700, cursor: txs.length===0?'not-allowed':'pointer', fontFamily:'inherit', opacity: txs.length===0?.5:1 }}>
            ⬇️ PDF
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'10px 10px' }}>
            <p style={{ fontSize:9, opacity:.7, marginBottom:3 }}>RECEIVED</p>
            <p style={{ fontSize:15, fontWeight:800, color:'#4ade80' }}>₹{fmt(totalIn,0)}</p>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'10px 10px' }}>
            <p style={{ fontSize:9, opacity:.7, marginBottom:3 }}>GIVEN</p>
            <p style={{ fontSize:15, fontWeight:800, color:'#f87171' }}>₹{fmt(totalOut,0)}</p>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:10, padding:'10px 10px' }}>
            <p style={{ fontSize:9, opacity:.7, marginBottom:3 }}>NET</p>
            <p style={{ fontSize:15, fontWeight:800, color: net>=0?'#4ade80':'#f87171' }}>₹{fmt(Math.abs(net),0)}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>

        {/* Period selector */}
        <div style={{ display:'flex', gap:6, marginBottom:12 }}>
          {PERIODS.map(p => (
            <button key={p.key} onClick={() => selectPeriod(p.key)}
              style={{ flex:1, padding:'8px 4px', borderRadius:50, fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
                border:`1.5px solid ${period===p.key?'var(--blue)':'var(--border)'}`,
                background: period===p.key?'var(--blue)':'white',
                color: period===p.key?'white':'var(--text2)' }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date picker */}
        {showCustom && (
          <div className="card card-p" style={{ marginBottom:12 }}>
            <p style={{ fontWeight:700, fontSize:13, marginBottom:10, color:'var(--text2)' }}>Custom Date Range</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div className="field" style={{ margin:0 }}>
                <label>From</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} style={{ fontSize:13 }}/>
              </div>
              <div className="field" style={{ margin:0 }}>
                <label>To</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} style={{ fontSize:13 }}/>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={applyCustom} style={{ padding:11 }}>Apply Range</button>
          </div>
        )}

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="card card-p" style={{ marginBottom:14 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)' }}>Transaction Trend</p>
              <div style={{ display:'flex', gap:10 }}>
                <span style={{ fontSize:11, color:'#4a5068', display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:'#4ade80', display:'inline-block' }}/>Received
                </span>
                <span style={{ fontSize:11, color:'#4a5068', display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:'#f87171', display:'inline-block' }}/>Given
                </span>
              </div>
            </div>
            <BarChart data={chartData} height={130} />
          </div>
        )}

        {/* Filters row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <div className="field" style={{ margin:0 }}>
            <label>Type</label>
            <select value={filter.type} onChange={e => setFilter(f=>({...f,type:e.target.value}))} style={{ fontSize:14, background:'transparent' }}>
              <option value="">All</option>
              <option value="got">Received</option>
              <option value="gave">Given</option>
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Party</label>
            <select value={filter.partyId} onChange={e => setFilter(f=>({...f,partyId:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All</option>
              {parties.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Top parties */}
        {topParties.length > 0 && (
          <>
            <p className="sec-title">Top Parties by Balance</p>
            <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
              {topParties.map(p => {
                const maxBal = Math.abs(topParties[0].balance);
                const pct    = (Math.abs(p.balance) / maxBal) * 100;
                return (
                  <div key={p._id} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                      <p style={{ fontWeight:700, fontSize:13 }}>{p.name}</p>
                      <p style={{ fontWeight:800, fontSize:13, color: p.balance>0?'var(--red)':'var(--blue)' }}>
                        {p.balance>0?'GET':'GIVE'} ₹{fmt(Math.abs(p.balance),0)}
                      </p>
                    </div>
                    <div style={{ background:'var(--border)', borderRadius:4, height:5 }}>
                      <div style={{ width:`${pct}%`, height:'100%', borderRadius:4, background: p.balance>0?'var(--red)':'var(--blue)', transition:'width .4s' }}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Transaction list */}
        <p className="sec-title">{txs.length} Transactions</p>
        {loading ? (
          <div className="spinner"><div className="spin"/></div>
        ) : txs.length === 0 ? (
          <div className="empty"><div className="ico">📋</div><h3>No transactions found</h3><p>Try a different period or filter</p></div>
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
                  <p className={tx.type==='got'?'amt-pos':'amt-neg'} style={{ fontSize:15 }}>
                    {tx.type==='got'?'+':'-'}₹{fmt(tx.amount,2)}
                  </p>
                  <p style={{ fontSize:10, color:'var(--text4)', marginTop:2 }}>{tx.type==='got'?'Received':'Given'}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useEffect, useState, useCallback } from 'react';
import { txAPI, partyAPI, categoryAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';

/* ── helpers ── */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

const getRangeForPeriod = p => {
  const now = new Date(), today = localDateStr(now);
  if (p === 'today') return { startDate: today, endDate: today };
  if (p === 'week')  { const s = new Date(now); s.setDate(now.getDate()-6); return { startDate: localDateStr(s), endDate: today }; }
  if (p === 'month') return { startDate: localDateStr(new Date(now.getFullYear(), now.getMonth(), 1)), endDate: today };
  if (p === 'year')  return { startDate: localDateStr(new Date(now.getFullYear(), 0, 1)), endDate: today };
  return { startDate: '', endDate: '' };
};

/* ── Bar Chart (CSS-based, no canvas needed) ── */
function BarChart({ data }) {
  const [hovered, setHovered] = useState(null);
  if (!data?.length) return null;
  const max = Math.max(...data.flatMap(d => [d.received, d.given]), 1);
  return (
    <div style={{ display:'flex', alignItems:'flex-end', gap:3, height:140, paddingBottom:20, position:'relative' }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', height:'100%', justifyContent:'flex-end', cursor:'default', position:'relative' }}
          onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
          onTouchStart={() => setHovered(i)} onTouchEnd={() => setTimeout(() => setHovered(null), 1400)}>
          {hovered === i && (
            <div style={{ position:'absolute', bottom:'100%', left:'50%', transform:'translateX(-50%)', background:'#1a1d2e', color:'white', borderRadius:8, padding:'5px 9px', fontSize:10, fontWeight:700, whiteSpace:'nowrap', zIndex:20, marginBottom:4, pointerEvents:'none' }}>
              <span style={{ color:'#4ade80' }}>+₹{fmt(d.received,0)}</span> &nbsp; <span style={{ color:'#f87171' }}>-₹{fmt(d.given,0)}</span>
            </div>
          )}
          <div style={{ width:'100%', display:'flex', gap:2, alignItems:'flex-end', height:'calc(100% - 20px)' }}>
            <div style={{ flex:1, background: hovered===i?'#16a34a':'#4ade80', borderRadius:'3px 3px 0 0', height:`${(d.received/max)*100}%`, minHeight:d.received>0?3:0, transition:'background .15s, height .3s' }}/>
            <div style={{ flex:1, background: hovered===i?'#dc2626':'#f87171', borderRadius:'3px 3px 0 0', height:`${(d.given/max)*100}%`, minHeight:d.given>0?3:0, transition:'background .15s, height .3s' }}/>
          </div>
          <p style={{ position:'absolute', bottom:0, fontSize:9, color:'var(--text4)', textAlign:'center', lineHeight:1.2, width:'100%', overflow:'hidden' }}>{d.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ── Donut (SVG) ── */
function Donut({ received, given }) {
  const total = received + given || 1;
  const r = 42, cx = 56, cy = 56, sw = 14, circ = 2 * Math.PI * r;
  const recDash = (received / total) * circ;
  const netVal = received - given;
  return (
    <svg width={112} height={112} style={{ display:'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fca5a5" strokeWidth={sw}/>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4ade80" strokeWidth={sw}
        strokeDasharray={`${recDash} ${circ}`} strokeLinecap="butt"
        transform={`rotate(-90 ${cx} ${cy})`}/>
      <text x={cx} y={cy-4} textAnchor="middle" fontSize="9" fill="#4a5068" fontWeight="700" fontFamily="inherit">NET</text>
      <text x={cx} y={cy+8} textAnchor="middle" fontSize="11" fill={netVal>=0?'#1a9e5c':'#e53935'} fontWeight="800" fontFamily="inherit">
        {netVal>=0?'+':'-'}₹{fmt(Math.abs(netVal),0)}
      </text>
    </svg>
  );
}

/* ══════════════════════════════════════════
   ADVANCED PDF GENERATOR
══════════════════════════════════════════ */
const exportPDF = (txs, user, period, totalIn, totalOut, parties, chartData, filterContext) => {
  const PERIOD_LABEL = { today:'Today', week:'This Week', month:'This Month', year:'This Year', custom:'Custom Range' };
  const net    = totalIn - totalOut;
  const avgTx  = txs.length ? (totalIn + totalOut) / txs.length : 0;
  const now    = new Date();

  /* Party summary */
  const byParty = {};
  txs.forEach(t => {
    const n = t.partyId?.name || '—';
    if (!byParty[n]) byParty[n] = { received:0, given:0, count:0 };
    if (t.type==='got')  byParty[n].received += t.amount;
    if (t.type==='gave') byParty[n].given    += t.amount;
    byParty[n].count++;
  });
  const partyArr = Object.entries(byParty).sort((a,b) => (b[1].received+b[1].given) - (a[1].received+a[1].given));

  /* Biggest txns */
  const bigIn  = txs.filter(t=>t.type==='got').sort((a,b)=>b.amount-a.amount)[0];
  const bigOut = txs.filter(t=>t.type==='gave').sort((a,b)=>b.amount-a.amount)[0];

  /* Outstanding */
  const owed  = parties.filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,10);
  const owing = parties.filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance).slice(0,10);
  const totalOwed  = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalOwing = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);

  /* Bar chart SVG */
  const makeChartSVG = () => {
    if (!chartData?.length) return '';
    const W = 520, H = 120, PB = 20, PAD = 10;
    const cw = W - PAD*2, ch = H - PB;
    const max = Math.max(...chartData.flatMap(d=>[d.received,d.given]),1);
    const bw = (cw / chartData.length) * 0.35;
    const bars = chartData.map((d,i) => {
      const x = PAD + (i / chartData.length) * cw + (cw/chartData.length - bw*2 - 2)/2;
      const rh = (d.received/max)*ch, gh = (d.given/max)*ch;
      return `
        <rect x="${x}" y="${ch-rh}" width="${bw}" height="${rh}" fill="#4ade80" rx="2"/>
        <rect x="${x+bw+2}" y="${ch-gh}" width="${bw}" height="${gh}" fill="#f87171" rx="2"/>
        <text x="${x+bw}" y="${H-2}" text-anchor="middle" font-size="8" fill="#888">${d.label}</text>`;
    }).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" style="display:block;margin:8px 0">${bars}</svg>`;
  };

  const partyRows = partyArr.map(([n,s],i) => `
    <tr style="${i%2===0?'background:#fafafa':''}">
      <td>${n}</td>
      <td style="color:#1a9e5c;font-weight:700">+₹${fmt(s.received,2)}</td>
      <td style="color:#e53935;font-weight:700">-₹${fmt(s.given,2)}</td>
      <td style="color:${s.received-s.given>=0?'#1a9e5c':'#e53935'};font-weight:800">${s.received-s.given>=0?'+':'-'}₹${fmt(Math.abs(s.received-s.given),2)}</td>
      <td style="color:#888">${s.count}</td>
    </tr>`).join('');

  const txRows = txs.map((t,i) => `
    <tr style="${i%2===0?'background:#fafafa':''}">
      <td>${fmtDate(t.date)}</td>
      <td style="font-weight:600">${t.partyId?.name||'—'}</td>
      <td style="color:${t.type==='got'?'#1a9e5c':'#e53935'};font-weight:700">${t.type==='got'?'+':'-'}₹${fmt(t.amount,2)}</td>
      <td style="color:#888;font-size:11px">${t.note||''}</td>
    </tr>`).join('');

  const owedRows = owed.map(p=>`<tr><td>${p.name}</td><td style="color:#1a9e5c;font-weight:700">₹${fmt(p.balance,2)}</td></tr>`).join('');
  const owingRows = owing.map(p=>`<tr><td>${p.name}</td><td style="color:#e53935;font-weight:700">₹${fmt(Math.abs(p.balance),2)}</td></tr>`).join('');

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<title>CreditBook Analytics Report</title>
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1d2e; padding: 24px; }
  .hdr { background: linear-gradient(135deg, #1a4fd6, #0e2a8a); color: white; padding: 20px 24px; border-radius: 10px; margin-bottom: 20px; }
  .hdr h1 { font-size: 20px; margin-bottom: 4px; }
  .hdr p  { font-size: 11px; opacity: .8; }
  .kpi-grid { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 100px; padding: 12px 14px; border-radius: 8px; }
  .kpi .lbl { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .5px; margin-bottom: 4px; }
  .kpi .val { font-size: 18px; font-weight: 800; }
  .kpi .sub { font-size: 10px; margin-top: 3px; opacity: .7; }
  .section { margin-bottom: 20px; }
  .section h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .8px; color: #4a5068; padding-bottom: 6px; border-bottom: 2px solid #e0e6f8; margin-bottom: 10px; }
  .insight-grid { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .insight { flex: 1; min-width: 140px; padding: 10px 12px; border-radius: 8px; font-size: 11px; line-height: 1.5; }
  .two-col { display: flex; gap: 16px; }
  .two-col > div { flex: 1; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead tr { background: #f0f4ff; }
  th { padding: 7px 8px; text-align: left; font-size: 10px; font-weight: 700; color: #4a5068; text-transform: uppercase; }
  td { padding: 7px 8px; border-bottom: 1px solid #eee; }
  .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 20px; padding-top: 12px; border-top: 1px solid #eee; }
  @media print { body { padding: 12px; } }
</style>
</head>
<body>

<div class="hdr">
  <h1>CreditBook Analytics Report</h1>
  <p>${user?.businessName||'My Business'} &nbsp;·&nbsp; ${PERIOD_LABEL[period]||period} &nbsp;·&nbsp; Generated ${now.toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} at ${now.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
</div>

<!-- KPI Cards -->
<div class="kpi-grid">
  <div class="kpi" style="background:#e6f9f0">
    <div class="lbl" style="color:#1a9e5c">Total Received</div>
    <div class="val" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div>
  </div>
  <div class="kpi" style="background:#fff0f0">
    <div class="lbl" style="color:#e53935">Total Given</div>
    <div class="val" style="color:#e53935">₹${fmt(totalOut,2)}</div>
  </div>
  <div class="kpi" style="background:#e8eeff">
    <div class="lbl" style="color:#1a4fd6">Net Balance</div>
    <div class="val" style="color:${net>=0?'#1a9e5c':'#e53935'}">${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}</div>
  </div>
  <div class="kpi" style="background:#f8f8f8">
    <div class="lbl" style="color:#666">Transactions</div>
    <div class="val">${txs.length}</div>
    <div class="sub">Avg ₹${fmt(avgTx,0)} each</div>
  </div>
  <div class="kpi" style="background:#fff7e6">
    <div class="lbl" style="color:#b45309">Net Receivable</div>
    <div class="val" style="color:#1a9e5c">₹${fmt(totalOwed,2)}</div>
    <div class="sub">from ${owed.length} parties</div>
  </div>
  <div class="kpi" style="background:#fff0f0">
    <div class="lbl" style="color:#b91c1c">Net Payable</div>
    <div class="val" style="color:#e53935">₹${fmt(totalOwing,2)}</div>
    <div class="sub">to ${owing.length} parties</div>
  </div>
</div>

<!-- Key Insights -->
<div class="section">
  <h2>Key Insights</h2>
  <div class="insight-grid">
    ${net>0?`<div class="insight" style="background:#e6f9f0;border-left:3px solid #1a9e5c"><strong>Positive Period</strong><br/>Net surplus of ₹${fmt(net,0)} — more received than given.</div>`:''}
    ${net<0?`<div class="insight" style="background:#fff0f0;border-left:3px solid #e53935"><strong>Negative Period</strong><br/>Net deficit of ₹${fmt(Math.abs(net),0)} — more given than received.</div>`:''}
    ${bigIn?`<div class="insight" style="background:#e8eeff;border-left:3px solid #1a4fd6"><strong>Largest Receipt</strong><br/>₹${fmt(bigIn.amount,0)} from ${bigIn.partyId?.name||'?'} on ${fmtDate(bigIn.date)}.</div>`:''}
    ${bigOut?`<div class="insight" style="background:#fff7e6;border-left:3px solid #b45309"><strong>Largest Payment</strong><br/>₹${fmt(bigOut.amount,0)} to ${bigOut.partyId?.name||'?'} on ${fmtDate(bigOut.date)}.</div>`:''}
    ${totalOwed>0?`<div class="insight" style="background:#e6f9f0;border-left:3px solid #1a9e5c"><strong>Pending Collection</strong><br/>₹${fmt(totalOwed,0)} due from ${owed.length} parties. Follow up with ${owed[0]?.name||'?'} first (₹${fmt(owed[0]?.balance||0,0)}).</div>`:''}
    ${avgTx>0?`<div class="insight" style="background:#f8f8f8;border-left:3px solid #888"><strong>Transaction Average</strong><br/>₹${fmt(avgTx,0)} per transaction across ${txs.length} entries.</div>`:''}
  </div>
</div>

${chartData?.length ? `
<div class="section">
  <h2>Transaction Trend</h2>
  <div style="display:flex;gap:12px;font-size:10px;margin-bottom:6px">
    <span><span style="display:inline-block;width:10px;height:10px;background:#4ade80;border-radius:2px;margin-right:4px"></span>Received</span>
    <span><span style="display:inline-block;width:10px;height:10px;background:#f87171;border-radius:2px;margin-right:4px"></span>Given</span>
  </div>
  ${makeChartSVG()}
</div>` : ''}

<!-- Outstanding Balances -->
${(owed.length > 0 || owing.length > 0) ? `
<div class="section">
  <h2>Outstanding Balances</h2>
  <div class="two-col">
    ${owed.length > 0 ? `<div>
      <p style="font-size:11px;font-weight:700;color:#1a9e5c;margin-bottom:6px">Will Receive (${owed.length}) — Total ₹${fmt(totalOwed,0)}</p>
      <table><thead><tr><th>Party</th><th>Amount</th></tr></thead><tbody>${owedRows}</tbody></table>
    </div>` : ''}
    ${owing.length > 0 ? `<div>
      <p style="font-size:11px;font-weight:700;color:#e53935;margin-bottom:6px">Will Give (${owing.length}) — Total ₹${fmt(totalOwing,0)}</p>
      <table><thead><tr><th>Party</th><th>Amount</th></tr></thead><tbody>${owingRows}</tbody></table>
    </div>` : ''}
  </div>
</div>` : ''}

<!-- Party Summary -->
${partyArr.length > 0 ? `
<div class="section">
  <h2>Party-wise Summary</h2>
  <table>
    <thead><tr><th>Party</th><th>Received</th><th>Given</th><th>Net</th><th>Txns</th></tr></thead>
    <tbody>${partyRows}</tbody>
  </table>
</div>` : ''}

<!-- All Transactions -->
<div class="section">
  <h2>All Transactions (${txs.length})</h2>
  <table>
    <thead><tr><th>Date</th><th>Party</th><th>Amount</th><th>Note</th></tr></thead>
    <tbody>${txRows}</tbody>
  </table>
</div>

<div class="footer">
  CreditBook &nbsp;·&nbsp; ${user?.name||''} &nbsp;·&nbsp; ${user?.businessName||''} &nbsp;·&nbsp; ${now.toLocaleString('en-IN')}
</div>
</body></html>`;

  const blob = new Blob([html], { type:'text/html' });
  const url  = URL.createObjectURL(blob);
  const win  = window.open(url, '_blank');
  if (win) {
    win.onload = () => {
      setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 500);
    };
  }
};


/* ── Show More Button ── */
function ShowMoreBtn({ showing, total, onToggle }) {
  if (total <= 4) return null;
  return (
    <button onClick={onToggle}
      style={{ width:'100%', padding:'10px', fontSize:12, fontWeight:700, color:'var(--blue)', background:'var(--blue-lt)', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
      {showing ? `Show less ↑` : `Show all ${total} ↓`}
    </button>
  );
}

/* ── Outstanding Card with Show More ── */
function OutstandingCard({ toGet, toGive }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const allParties = [
    ...toGet.map(p => ({ ...p, type:'get' })),
    ...toGive.map(p => ({ ...p, type:'give' })),
  ];
  const visible = showAll ? allParties : allParties.slice(0, LIMIT);
  return (
    <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
      <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)' }}>Outstanding Balances</p>
        <p style={{ fontSize:11, color:'var(--text3)' }}>{allParties.length} parties</p>
      </div>
      {visible.map((p, i) => (
        <div key={p._id||i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 14px', borderBottom:'1px solid var(--border)' }}>
          <div>
            <p style={{ fontSize:14, fontWeight:600 }}>{p.name}</p>
            <p style={{ fontSize:11, color: p.type==='get'?'var(--green)':'var(--red)', fontWeight:600 }}>
              {p.type==='get' ? 'Will receive' : 'Will give'}
            </p>
          </div>
          <p style={{ fontSize:15, fontWeight:800, color: p.type==='get'?'var(--green)':'var(--red)' }}>
            ₹{fmt(Math.abs(p.balance),0)}
          </p>
        </div>
      ))}
      <ShowMoreBtn showing={showAll} total={allParties.length} onToggle={() => setShowAll(s => !s)}/>
    </div>
  );
}

/* ── Party Breakdown Card with Show More ── */
function PartyBreakdownCard({ partyArr }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const visible = showAll ? partyArr : partyArr.slice(0, LIMIT);
  return (
    <div className="card" style={{ overflow:'hidden', marginBottom:14 }}>
      <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', padding:'12px 14px 8px' }}>By Party</p>
      {visible.map(([name, s], i) => (
        <div key={i} style={{ padding:'11px 14px', borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <p style={{ fontWeight:700, fontSize:14 }}>{name}</p>
              <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{s.count} transaction{s.count!==1?'s':''}</p>
            </div>
            <p style={{ fontSize:14, fontWeight:800, color:s.received-s.given>=0?'var(--green)':'var(--red)' }}>
              net {s.received-s.given>=0?'+':'-'}₹{fmt(Math.abs(s.received-s.given),0)}
            </p>
          </div>
          <div style={{ display:'flex', gap:16, marginTop:6 }}>
            <p style={{ fontSize:12, color:'var(--green)', fontWeight:600 }}>+₹{fmt(s.received,0)}</p>
            <p style={{ fontSize:12, color:'var(--red)', fontWeight:600 }}>-₹{fmt(s.given,0)}</p>
          </div>
        </div>
      ))}
      <ShowMoreBtn showing={showAll} total={partyArr.length} onToggle={() => setShowAll(s => !s)}/>
    </div>
  );
}

/* ── Transaction List Card with Show More ── */
function TransactionListCard({ txs, totalIn, totalOut }) {
  const [showAll, setShowAll] = useState(false);
  const LIMIT = 4;
  const visible = showAll ? txs : txs.slice(0, LIMIT);
  return (
    <>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <p className="sec-title" style={{ margin:0 }}>{txs.length} Transactions</p>
        <p style={{ fontSize:11, color:'var(--text3)' }}>Total ₹{fmt(totalIn+totalOut,0)}</p>
      </div>
      <div className="card" style={{ overflow:'hidden', marginBottom:16 }}>
        {visible.map(tx => (
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
        <ShowMoreBtn showing={showAll} total={txs.length} onToggle={() => setShowAll(s => !s)}/>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════
   MAIN ANALYTICS PAGE
══════════════════════════════════════════ */
export default function Analytics() {
  const { user } = useAuth();
  const [txs,        setTxs]        = useState([]);
  const [parties,    setParties]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [period,     setPeriod]     = useState('month');
  const [filter,     setFilter]     = useState({ type:'', partyId:'', categoryId:'', ...getRangeForPeriod('month') });
  const [showCustom,setShowCustom]= useState(false);
  const [cStart,    setCStart]    = useState('');
  const [cEnd,      setCEnd]      = useState('');

  const PERIODS = [
    { key:'today', label:'Today'  },
    { key:'week',  label:'Week'   },
    { key:'month', label:'Month'  },
    { key:'year',  label:'Year'   },
    { key:'custom',label:'Custom' },
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
      const txParams = { limit:1000 };
      if (filter.type)      txParams.type      = filter.type;
      if (filter.startDate) txParams.startDate = filter.startDate;
      if (filter.endDate)   txParams.endDate   = filter.endDate;
      if (filter.partyId)   txParams.partyId   = filter.partyId;

      const partyParams = {};
      if (filter.categoryId) partyParams.categoryId = filter.categoryId;

      const [tR, pR, cR] = await Promise.all([
        txAPI.getAll(txParams),
        partyAPI.getAll(partyParams),
        categoryAPI.getAll(),
      ]);

      let fetchedTxs = tR.data.data || [];
      // If category filter is set, only keep transactions for parties in that category
      if (filter.categoryId) {
        const partyIds = new Set((pR.data.data || []).map(p => p._id));
        fetchedTxs = fetchedTxs.filter(t => partyIds.has(t.partyId?._id || t.partyId));
      }

      setTxs(fetchedTxs);
      setParties(pR.data.data || []);
      setCategories(cR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  /* ── Computed stats ── */
  const totalIn  = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);
  const net      = totalIn - totalOut;
  const avgTx    = txs.length ? (totalIn+totalOut)/txs.length : 0;

  const bigIn  = txs.filter(t=>t.type==='got').sort((a,b)=>b.amount-a.amount)[0];
  const bigOut = txs.filter(t=>t.type==='gave').sort((a,b)=>b.amount-a.amount)[0];

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
  const toGet  = [...parties].filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance);
  const toGive = [...parties].filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance);
  const totalOwed  = toGet.reduce((s,p)=>s+p.balance,0);
  const totalOwing = toGive.reduce((s,p)=>s+Math.abs(p.balance),0);

  /* Chart data */
  const chartData = (() => {
    if (!txs.length) return [];
    if (period === 'today') {
      const arr = Array.from({length:8},(_,i)=>{
        const h=i*3;
        const received=txs.filter(t=>t.type==='got'&&new Date(t.date).getHours()>=h&&new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        const given=txs.filter(t=>t.type==='gave'&&new Date(t.date).getHours()>=h&&new Date(t.date).getHours()<h+3).reduce((s,t)=>s+t.amount,0);
        return {label:`${h}h`,received,given};
      });
      return arr.filter(d=>d.received>0||d.given>0);
    }
    if (period === 'week') {
      return Array.from({length:7},(_,i)=>{
        const d=new Date(); d.setDate(d.getDate()-6+i);
        const ds=localDateStr(d);
        const received=txs.filter(t=>t.type==='got'&&localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        const given=txs.filter(t=>t.type==='gave'&&localDateStr(new Date(t.date))===ds).reduce((s,t)=>s+t.amount,0);
        return {label:d.toLocaleDateString('en-IN',{weekday:'short'}),received,given};
      });
    }
    const months={};
    txs.forEach(t=>{
      const d=new Date(t.date), mk=`${d.getFullYear()}-${d.getMonth()}`;
      const label=d.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
      if(!months[mk]) months[mk]={label,received:0,given:0,_m:d.getFullYear()*12+d.getMonth()};
      if(t.type==='got') months[mk].received+=t.amount;
      if(t.type==='gave') months[mk].given+=t.amount;
    });
    return Object.values(months).sort((a,b)=>a._m-b._m);
  })();

  /* Insights */
  const insights = [];
  if (net > 0) insights.push({ color:'var(--green-lt)', border:'var(--green)', text:`Net positive ₹${fmt(net,0)} — you received more than you gave this period.` });
  if (net < 0) insights.push({ color:'var(--red-lt)', border:'var(--red)', text:`Net negative ₹${fmt(Math.abs(net),0)} — you gave more than you received.` });
  if (bigIn)   insights.push({ color:'var(--blue-lt)', border:'var(--blue)', text:`Largest receipt: ₹${fmt(bigIn.amount,0)} from ${bigIn.partyId?.name||'?'} on ${fmtDate(bigIn.date)}.` });
  if (bigOut)  insights.push({ color:'#fff7e6', border:'var(--orange)', text:`Largest payment: ₹${fmt(bigOut.amount,0)} to ${bigOut.partyId?.name||'?'} on ${fmtDate(bigOut.date)}.` });
  if (totalOwed > 0) insights.push({ color:'var(--green-lt)', border:'var(--green)', text:`₹${fmt(totalOwed,0)} pending collection from ${toGet.length} parties. ${toGet[0]?.name} owes the most (₹${fmt(toGet[0]?.balance||0,0)}).` });
  if (avgTx > 0) insights.push({ color:'var(--bg)', border:'var(--border)', text:`Average transaction: ₹${fmt(avgTx,0)} across ${txs.length} entries.` });

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>

      {/* ── Header ── */}
      <div className="grad-blue" style={{ padding:'18px 16px 18px', color:'white' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>Analytics</h2>
          <button
            onClick={() => {
              const parts = [];
              if (filter.categoryId) { const cat = categories.find(c=>c._id===filter.categoryId); if(cat) parts.push(`Category: ${cat.name}`); }
              if (filter.partyId)    { const p = parties.find(p=>p._id===filter.partyId); if(p) parts.push(`Party: ${p.name}`); }
              if (filter.type)       parts.push(`Type: ${filter.type==='got'?'Received only':'Given only'}`);
              if (filter.startDate && filter.endDate) parts.push(`Date: ${filter.startDate} to ${filter.endDate}`);
              exportPDF(txs, user, period, totalIn, totalOut, parties, chartData, { activeFilters: parts.join(' · ') || null });
            }}
            disabled={!txs.length}
            style={{ background:'rgba(255,255,255,.2)', border:'1.5px solid rgba(255,255,255,.35)', color:'white', borderRadius:50, padding:'7px 16px', fontSize:12, fontWeight:700, cursor:txs.length?'pointer':'not-allowed', fontFamily:'inherit', opacity:txs.length?1:.5 }}>
            Download PDF
          </button>
        </div>

        {/* Summary row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:12 }}>
          {[
            { label:'RECEIVED', value:`₹${fmt(totalIn,0)}`, color:'#4ade80' },
            { label:'GIVEN',    value:`₹${fmt(totalOut,0)}`, color:'#f87171' },
            { label:'NET',      value:`${net>=0?'+':'-'}₹${fmt(Math.abs(net),0)}`, color:net>=0?'#4ade80':'#f87171' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 10px' }}>
              <p style={{ fontSize:9, opacity:.7, marginBottom:3, fontWeight:700, letterSpacing:.5 }}>{s.label}</p>
              <p style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Donut + extra stats */}
        {(totalIn > 0 || totalOut > 0) && (
          <div style={{ background:'rgba(255,255,255,.1)', borderRadius:12, padding:'12px 14px', display:'flex', alignItems:'center', gap:16 }}>
            <Donut received={totalIn} given={totalOut}/>
            <div style={{ flex:1 }}>
              <div style={{ marginBottom:8 }}>
                <p style={{ fontSize:10, opacity:.7 }}>Total Transactions</p>
                <p style={{ fontSize:16, fontWeight:800 }}>{txs.length}</p>
              </div>
              <div>
                <p style={{ fontSize:10, opacity:.7 }}>Avg per Transaction</p>
                <p style={{ fontSize:14, fontWeight:700 }}>₹{fmt(avgTx,0)}</p>
              </div>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ marginBottom:8 }}>
                <p style={{ fontSize:10, opacity:.7 }}>Receivable</p>
                <p style={{ fontSize:14, fontWeight:800, color:'#4ade80' }}>₹{fmt(totalOwed,0)}</p>
              </div>
              <div>
                <p style={{ fontSize:10, opacity:.7 }}>Payable</p>
                <p style={{ fontSize:14, fontWeight:800, color:'#f87171' }}>₹{fmt(totalOwing,0)}</p>
              </div>
            </div>
          </div>
        )}
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
            <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:10 }}>Custom Date Range</p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div className="field" style={{ margin:0 }}><label>From</label><input type="date" value={cStart} onChange={e=>setCStart(e.target.value)} style={{ fontSize:13 }}/></div>
              <div className="field" style={{ margin:0 }}><label>To</label><input type="date" value={cEnd} onChange={e=>setCEnd(e.target.value)} style={{ fontSize:13 }}/></div>
            </div>
            <button className="btn btn-primary btn-full" style={{ padding:11 }}
              onClick={() => { if(cStart && cEnd) { setFilter(f=>({...f,startDate:cStart,endDate:cEnd})); setShowCustom(false); } }}>
              Apply
            </button>
          </div>
        )}

        {/* Filters */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
          <div className="field" style={{ margin:0 }}>
            <label>Type</label>
            <select value={filter.type} onChange={e=>setFilter(f=>({...f,type:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All types</option>
              <option value="got">Received only</option>
              <option value="gave">Given only</option>
            </select>
          </div>
          <div className="field" style={{ margin:0 }}>
            <label>Category</label>
            <select value={filter.categoryId} onChange={e=>setFilter(f=>({...f,categoryId:e.target.value,partyId:''}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All categories</option>
              {categories.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:14 }}>
          <div className="field" style={{ margin:0, flex:1 }}>
            <label>Party</label>
            <select value={filter.partyId} onChange={e=>setFilter(f=>({...f,partyId:e.target.value}))} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All parties</option>
              {(filter.categoryId
                ? parties.filter(p => p.categoryId?._id === filter.categoryId || p.categoryId === filter.categoryId)
                : parties
              ).map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {(filter.type || filter.categoryId || filter.partyId) && (
            <button
              onClick={() => setFilter(f=>({...f, type:'', categoryId:'', partyId:''}))}
              style={{ alignSelf:'center', padding:'8px 14px', borderRadius:50, fontSize:12, fontWeight:700, color:'var(--red)', background:'var(--red-lt)', border:'none', cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', marginTop:4 }}>
              Clear filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="spinner"><div className="spin"/></div>
        ) : txs.length === 0 ? (
          <div className="empty"><div className="ico">📊</div><h3>No data for this period</h3><p>Try a different time range</p></div>
        ) : (
          <>
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
                <BarChart data={chartData}/>
              </div>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <div style={{ marginBottom:14 }}>
                <p className="sec-title" style={{ marginBottom:8 }}>Insights</p>
                {insights.map((ins, i) => (
                  <div key={i} style={{ background:ins.color, borderLeft:`3px solid ${ins.border}`, borderRadius:10, padding:'10px 14px', marginBottom:8, fontSize:13, lineHeight:1.6, color:'var(--text)' }}>
                    {ins.text}
                  </div>
                ))}
              </div>
            )}

            {/* Outstanding */}
            {(toGet.length > 0 || toGive.length > 0) && (
              <OutstandingCard toGet={toGet} toGive={toGive}/>
            )}

            {/* Party breakdown */}
            {partyArr.length > 0 && (
              <PartyBreakdownCard partyArr={partyArr}/>
            )}

            {/* Transaction list */}
            <TransactionListCard txs={txs} totalIn={totalIn} totalOut={totalOut}/>
          </>
        )}
      </div>
    </div>
  );
}

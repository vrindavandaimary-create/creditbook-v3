import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { txAPI, partyAPI, categoryAPI, billAPI } from '../api';
import { fmt, fmtDate } from '../utils/helpers';

/* ─────────────────────────────────────────────
   SHARED PDF HELPERS
───────────────────────────────────────────── */
const openPDF = (html) => {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  const win = window.open(url, '_blank');
  if (win) win.onload = () => { setTimeout(() => { win.print(); URL.revokeObjectURL(url); }, 400); };
};

const BASE_STYLE = `
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:Arial,sans-serif; font-size:12px; color:#1a1d2e; padding:28px; }
  .hdr  { background:linear-gradient(135deg,#1a4fd6,#0e2a8a); color:#fff; padding:20px 24px; border-radius:10px; margin-bottom:20px; }
  .hdr h1 { font-size:20px; margin-bottom:4px; }
  .hdr p  { font-size:11px; opacity:.8; }
  .hdr .filters { font-size:10px; margin-top:6px; opacity:.75; }
  .kpi { display:flex; gap:10px; flex-wrap:wrap; margin-bottom:20px; }
  .kpi-c { flex:1; min-width:110px; padding:12px 14px; border-radius:8px; }
  .kpi-c .l { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px; }
  .kpi-c .v { font-size:18px; font-weight:800; }
  .kpi-c .s { font-size:10px; margin-top:3px; opacity:.65; }
  h2 { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#4a5068; padding-bottom:6px; border-bottom:2px solid #e0e6f8; margin:18px 0 10px; }
  table { width:100%; border-collapse:collapse; margin-bottom:16px; font-size:11px; }
  thead tr { background:#f0f4ff; }
  th { padding:7px 8px; text-align:left; font-size:10px; font-weight:700; color:#4a5068; text-transform:uppercase; }
  td { padding:7px 8px; border-bottom:1px solid #eee; vertical-align:top; }
  tr:nth-child(even) { background:#fafafa; }
  .tag-green { color:#1a9e5c; font-weight:700; }
  .tag-red   { color:#e53935; font-weight:700; }
  .tag-blue  { color:#1a4fd6; font-weight:700; }
  .tag-orange{ color:#b45309; font-weight:700; }
  .footer { text-align:center; font-size:10px; color:#aaa; border-top:1px solid #eee; padding-top:12px; margin-top:20px; }
  @media print { body { padding:12px; } }
`;

const header = (title, business, name, filterStr, dateRange) => `
  <div class="hdr">
    <h1>${title}</h1>
    <p>${business || 'My Business'} &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} at ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}</p>
    ${dateRange ? `<p class="filters">Period: ${dateRange}</p>` : ''}
    ${filterStr  ? `<p class="filters">Filters: ${filterStr}</p>` : ''}
  </div>`;

const footer = (name) => `<div class="footer">CreditBook &nbsp;·&nbsp; ${name || ''} &nbsp;·&nbsp; ${new Date().toLocaleString('en-IN')}</div>`;

/* ─────────────────────────────────────────────
   1. SALES REPORT  (type=got transactions)
───────────────────────────────────────────── */
const genSalesReport = (txs, parties, user, dateRange, partyFilter) => {
  const sales = txs.filter(t => t.type === 'got');
  const total = sales.reduce((s,t)=>s+t.amount,0);
  const count = sales.length;
  const avg   = count ? total/count : 0;
  const biggest = sales.slice().sort((a,b)=>b.amount-a.amount)[0];

  // group by party
  const byParty = {};
  sales.forEach(t => {
    const n = t.partyId?.name||'—';
    if (!byParty[n]) byParty[n] = { total:0, count:0 };
    byParty[n].total += t.amount; byParty[n].count++;
  });
  const partyRows = Object.entries(byParty).sort((a,b)=>b[1].total-a[1].total)
    .map(([n,s],i) => `<tr><td>${i+1}</td><td>${n}</td><td class="tag-green">₹${fmt(s.total,2)}</td><td>${s.count}</td><td>₹${fmt(s.total/s.count,0)}</td></tr>`).join('');

  const txRows = sales.map(t => `<tr><td>${fmtDate(t.date)}</td><td>${t.partyId?.name||'—'}</td><td class="tag-green">₹${fmt(t.amount,2)}</td><td style="color:#888">${t.note||''}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Sales Report</title><style>${BASE_STYLE}</style></head><body>
    ${header('Sales Report', user?.businessName, user?.name, partyFilter, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Sales</div><div class="v" style="color:#1a9e5c">₹${fmt(total,2)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Transactions</div><div class="v" style="color:#1a4fd6">${count}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Average Sale</div><div class="v">₹${fmt(avg,0)}</div></div>
      ${biggest ? `<div class="kpi-c" style="background:#fff7e6"><div class="l" style="color:#b45309">Biggest Sale</div><div class="v" style="color:#b45309">₹${fmt(biggest.amount,0)}</div><div class="s">${biggest.partyId?.name||'?'}</div></div>` : ''}
    </div>
    <h2>Sales by Party</h2>
    <table><thead><tr><th>#</th><th>Party</th><th>Total Received</th><th>Txns</th><th>Avg</th></tr></thead><tbody>${partyRows}</tbody></table>
    <h2>All Sales Transactions (${count})</h2>
    <table><thead><tr><th>Date</th><th>Party</th><th>Amount</th><th>Note</th></tr></thead><tbody>${txRows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   2. PURCHASE REPORT  (type=gave transactions)
───────────────────────────────────────────── */
const genPurchaseReport = (txs, user, dateRange, partyFilter) => {
  const purchases = txs.filter(t => t.type === 'gave');
  const total = purchases.reduce((s,t)=>s+t.amount,0);
  const count = purchases.length;

  const byParty = {};
  purchases.forEach(t => {
    const n = t.partyId?.name||'—';
    if (!byParty[n]) byParty[n] = { total:0, count:0 };
    byParty[n].total += t.amount; byParty[n].count++;
  });
  const partyRows = Object.entries(byParty).sort((a,b)=>b[1].total-a[1].total)
    .map(([n,s],i) => `<tr><td>${i+1}</td><td>${n}</td><td class="tag-red">₹${fmt(s.total,2)}</td><td>${s.count}</td></tr>`).join('');
  const txRows = purchases.map(t => `<tr><td>${fmtDate(t.date)}</td><td>${t.partyId?.name||'—'}</td><td class="tag-red">₹${fmt(t.amount,2)}</td><td style="color:#888">${t.note||''}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Purchase Report</title><style>${BASE_STYLE}</style></head><body>
    ${header('Purchase Report', user?.businessName, user?.name, partyFilter, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Purchases</div><div class="v" style="color:#e53935">₹${fmt(total,2)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Transactions</div><div class="v" style="color:#1a4fd6">${count}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Average</div><div class="v">₹${fmt(count?total/count:0,0)}</div></div>
    </div>
    <h2>Purchases by Party</h2>
    <table><thead><tr><th>#</th><th>Party / Supplier</th><th>Total Given</th><th>Txns</th></tr></thead><tbody>${partyRows}</tbody></table>
    <h2>All Purchase Transactions (${count})</h2>
    <table><thead><tr><th>Date</th><th>Party</th><th>Amount</th><th>Note</th></tr></thead><tbody>${txRows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   3. PROFIT & LOSS STATEMENT
───────────────────────────────────────────── */
const genPLReport = (txs, user, dateRange) => {
  const income   = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const expenses = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);
  const gross    = income - expenses;
  const margin   = income > 0 ? (gross/income*100).toFixed(1) : 0;

  // monthly breakdown
  const months = {};
  txs.forEach(t => {
    const d = new Date(t.date);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
    if (!months[k]) months[k] = { label, income:0, expenses:0 };
    if (t.type==='got')  months[k].income   += t.amount;
    if (t.type==='gave') months[k].expenses += t.amount;
  });
  const monthRows = Object.values(months).sort((a,b)=>a.label>b.label?1:-1).map(m => {
    const net = m.income - m.expenses;
    return `<tr><td>${m.label}</td><td class="tag-green">₹${fmt(m.income,2)}</td><td class="tag-red">₹${fmt(m.expenses,2)}</td><td class="${net>=0?'tag-green':'tag-red'}">${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>P&L Statement</title><style>${BASE_STYLE}</style></head><body>
    ${header('Profit & Loss Statement', user?.businessName, user?.name, null, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Income</div><div class="v" style="color:#1a9e5c">₹${fmt(income,2)}</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Expenses</div><div class="v" style="color:#e53935">₹${fmt(expenses,2)}</div></div>
      <div class="kpi-c" style="background:${gross>=0?'#e6f9f0':'#fff0f0'}"><div class="l" style="color:${gross>=0?'#1a9e5c':'#e53935'}">Net ${gross>=0?'Profit':'Loss'}</div><div class="v" style="color:${gross>=0?'#1a9e5c':'#e53935'}">${gross>=0?'+':'-'}₹${fmt(Math.abs(gross),2)}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Profit Margin</div><div class="v">${margin}%</div></div>
    </div>
    <h2>P&L Summary</h2>
    <table style="width:50%">
      <tbody>
        <tr><td>Total Income (Received)</td><td class="tag-green" style="text-align:right">₹${fmt(income,2)}</td></tr>
        <tr><td>Total Expenses (Given)</td><td class="tag-red" style="text-align:right">-₹${fmt(expenses,2)}</td></tr>
        <tr style="border-top:2px solid #1a4fd6;font-weight:800"><td>Net ${gross>=0?'Profit':'Loss'}</td><td class="${gross>=0?'tag-green':'tag-red'}" style="text-align:right;font-size:14px">${gross>=0?'+':'-'}₹${fmt(Math.abs(gross),2)}</td></tr>
      </tbody>
    </table>
    <h2>Monthly Breakdown</h2>
    <table><thead><tr><th>Month</th><th>Income</th><th>Expenses</th><th>Net</th></tr></thead><tbody>${monthRows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   4. BALANCE SHEET
───────────────────────────────────────────── */
const genBalanceSheet = (txs, parties, categories, user) => {
  const totalReceivable = parties.filter(p=>p.balance>0).reduce((s,p)=>s+p.balance,0);
  const totalPayable    = parties.filter(p=>p.balance<0).reduce((s,p)=>s+Math.abs(p.balance),0);
  const totalInflow     = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOutflow    = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);

  const receivableRows = parties.filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance)
    .map(p => { const cat = categories.find(c=>c._id===p.categoryId||c._id===p.categoryId?._id); return `<tr><td>${p.name}</td><td style="color:#888">${cat?.name||'—'}</td><td class="tag-green" style="text-align:right">₹${fmt(p.balance,2)}</td></tr>`; }).join('');
  const payableRows = parties.filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance)
    .map(p => { const cat = categories.find(c=>c._id===p.categoryId||c._id===p.categoryId?._id); return `<tr><td>${p.name}</td><td style="color:#888">${cat?.name||'—'}</td><td class="tag-red" style="text-align:right">₹${fmt(Math.abs(p.balance),2)}</td></tr>`; }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Balance Sheet</title><style>${BASE_STYLE}</style></head><body>
    ${header('Balance Sheet', user?.businessName, user?.name, null, 'As of today')}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Receivable</div><div class="v" style="color:#1a9e5c">₹${fmt(totalReceivable,2)}</div><div class="s">${parties.filter(p=>p.balance>0).length} parties</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Payable</div><div class="v" style="color:#e53935">₹${fmt(totalPayable,2)}</div><div class="s">${parties.filter(p=>p.balance<0).length} parties</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Net Position</div><div class="v" style="color:${totalReceivable-totalPayable>=0?'#1a9e5c':'#e53935'}">${totalReceivable-totalPayable>=0?'+':'-'}₹${fmt(Math.abs(totalReceivable-totalPayable),2)}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Total Parties</div><div class="v">${parties.length}</div></div>
    </div>
    <div style="display:flex;gap:20px">
      <div style="flex:1">
        <h2>Assets — Receivable (${parties.filter(p=>p.balance>0).length})</h2>
        <table><thead><tr><th>Party</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>${receivableRows}</tbody>
        <tfoot><tr style="font-weight:800;border-top:2px solid #1a9e5c"><td colspan="2">Total Receivable</td><td class="tag-green" style="text-align:right">₹${fmt(totalReceivable,2)}</td></tr></tfoot></table>
      </div>
      <div style="flex:1">
        <h2>Liabilities — Payable (${parties.filter(p=>p.balance<0).length})</h2>
        <table><thead><tr><th>Party</th><th>Category</th><th style="text-align:right">Amount</th></tr></thead><tbody>${payableRows}</tbody>
        <tfoot><tr style="font-weight:800;border-top:2px solid #e53935"><td colspan="2">Total Payable</td><td class="tag-red" style="text-align:right">₹${fmt(totalPayable,2)}</td></tr></tfoot></table>
      </div>
    </div>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   5. GST REPORT (GSTR-1 style — outward supplies)
───────────────────────────────────────────── */
const genGSTReport = (txs, user, dateRange, variant) => {
  const sales     = txs.filter(t=>t.type==='got');
  const purchases = txs.filter(t=>t.type==='gave');
  const totalSales= sales.reduce((s,t)=>s+t.amount,0);
  const totalPurch= purchases.reduce((s,t)=>s+t.amount,0);
  const gst18Sales = totalSales * 0.18;
  const gst18Purch = totalPurch * 0.18;
  const itcClaim   = gst18Purch;
  const netGST     = gst18Sales - itcClaim;

  const salesRows = sales.map(t => {
    const gst = t.amount * 0.18;
    return `<tr><td>${fmtDate(t.date)}</td><td>${t.partyId?.name||'—'}</td><td>₹${fmt(t.amount,2)}</td><td>18%</td><td>₹${fmt(gst*0.5,2)}</td><td>₹${fmt(gst*0.5,2)}</td><td class="tag-blue">₹${fmt(gst,2)}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>GST Report — ${variant}</title><style>${BASE_STYLE}
    .notice{background:#fff7e6;border-left:4px solid #b45309;padding:10px 14px;border-radius:6px;margin-bottom:16px;font-size:11px;color:#92400e;}
  </style></head><body>
    ${header(`GST Report — ${variant}`, user?.businessName, user?.name, null, dateRange)}
    <div class="notice">⚠️ This is an estimated GST computation based on transaction data. Assumes 18% GST. Consult your CA for actual filing. GSTIN not configured — add it in Profile.</div>
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Outward Supplies</div><div class="v" style="color:#1a9e5c">₹${fmt(totalSales,2)}</div><div class="s">Output GST ₹${fmt(gst18Sales,0)}</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Inward Supplies</div><div class="v" style="color:#e53935">₹${fmt(totalPurch,2)}</div><div class="s">ITC ₹${fmt(itcClaim,0)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Net GST Payable</div><div class="v" style="color:#1a4fd6">₹${fmt(Math.max(netGST,0),2)}</div></div>
    </div>
    <h2>GST Summary</h2>
    <table style="width:60%"><tbody>
      <tr><td>Total Sales (Taxable Value)</td><td class="tag-green" style="text-align:right">₹${fmt(totalSales,2)}</td></tr>
      <tr><td>Output GST @ 18%</td><td class="tag-blue" style="text-align:right">₹${fmt(gst18Sales,2)}</td></tr>
      <tr><td>CGST (9%)</td><td style="text-align:right">₹${fmt(gst18Sales*0.5,2)}</td></tr>
      <tr><td>SGST (9%)</td><td style="text-align:right">₹${fmt(gst18Sales*0.5,2)}</td></tr>
      <tr><td style="padding-top:8px">Input Tax Credit (ITC)</td><td class="tag-red" style="text-align:right">-₹${fmt(itcClaim,2)}</td></tr>
      <tr style="border-top:2px solid #1a4fd6;font-weight:800"><td>Net GST Payable</td><td class="tag-blue" style="text-align:right">₹${fmt(Math.max(netGST,0),2)}</td></tr>
    </tbody></table>
    <h2>Outward Supplies — ${variant === 'GSTR-1' ? 'Invoice Details' : 'Summary'}</h2>
    <table><thead><tr><th>Date</th><th>Party</th><th>Taxable</th><th>Rate</th><th>CGST</th><th>SGST</th><th>Total GST</th></tr></thead><tbody>${salesRows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   6. CASH FLOW STATEMENT
───────────────────────────────────────────── */
const genCashFlow = (txs, user, dateRange) => {
  const months = {};
  txs.forEach(t => {
    const d = new Date(t.date);
    const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = d.toLocaleDateString('en-IN',{month:'short',year:'numeric'});
    if (!months[k]) months[k] = { label, inflow:0, outflow:0, _k:k };
    if (t.type==='got')  months[k].inflow  += t.amount;
    if (t.type==='gave') months[k].outflow += t.amount;
  });
  const sorted = Object.values(months).sort((a,b)=>a._k>b._k?1:-1);
  let running = 0;
  const rows = sorted.map(m => {
    const net = m.inflow - m.outflow;
    running += net;
    return `<tr><td>${m.label}</td><td class="tag-green">₹${fmt(m.inflow,2)}</td><td class="tag-red">₹${fmt(m.outflow,2)}</td><td class="${net>=0?'tag-green':'tag-red'}">${net>=0?'+':'-'}₹${fmt(Math.abs(net),2)}</td><td class="${running>=0?'tag-green':'tag-red'}">₹${fmt(running,2)}</td></tr>`;
  }).join('');
  const totalIn  = txs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = txs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cash Flow</title><style>${BASE_STYLE}</style></head><body>
    ${header('Cash Flow Statement', user?.businessName, user?.name, null, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Inflow</div><div class="v" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Outflow</div><div class="v" style="color:#e53935">₹${fmt(totalOut,2)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Net Cash Flow</div><div class="v" style="color:${totalIn-totalOut>=0?'#1a9e5c':'#e53935'}">${totalIn-totalOut>=0?'+':'-'}₹${fmt(Math.abs(totalIn-totalOut),2)}</div></div>
    </div>
    <h2>Monthly Cash Flow</h2>
    <table><thead><tr><th>Month</th><th>Cash In</th><th>Cash Out</th><th>Net</th><th>Running Balance</th></tr></thead><tbody>${rows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   7. OUTSTANDING BILLS REPORT
───────────────────────────────────────────── */
const genOutstandingBills = (parties, user) => {
  const toGet  = parties.filter(p=>p.balance>0).sort((a,b)=>b.balance-a.balance);
  const toGive = parties.filter(p=>p.balance<0).sort((a,b)=>a.balance-b.balance);
  const totalGet  = toGet.reduce((s,p)=>s+p.balance,0);
  const totalGive = toGive.reduce((s,p)=>s+Math.abs(p.balance),0);

  const getRows  = toGet.map((p,i)  => `<tr><td>${i+1}</td><td>${p.name}</td><td class="tag-green" style="text-align:right">₹${fmt(p.balance,2)}</td><td>Will Receive</td></tr>`).join('');
  const giveRows = toGive.map((p,i) => `<tr><td>${i+1}</td><td>${p.name}</td><td class="tag-red" style="text-align:right">₹${fmt(Math.abs(p.balance),2)}</td><td>Will Give</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Outstanding Bills</title><style>${BASE_STYLE}</style></head><body>
    ${header('Outstanding Balances Report', user?.businessName, user?.name, null, 'As of today')}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Receivable</div><div class="v" style="color:#1a9e5c">₹${fmt(totalGet,2)}</div><div class="s">${toGet.length} parties</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Payable</div><div class="v" style="color:#e53935">₹${fmt(totalGive,2)}</div><div class="s">${toGive.length} parties</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Net Outstanding</div><div class="v" style="color:${totalGet-totalGive>=0?'#1a9e5c':'#e53935'}">${totalGet-totalGive>=0?'+':'-'}₹${fmt(Math.abs(totalGet-totalGive),2)}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Settled Parties</div><div class="v">${parties.filter(p=>p.balance===0).length}</div></div>
    </div>
    ${toGet.length > 0 ? `<h2>To Receive From (${toGet.length})</h2><table><thead><tr><th>#</th><th>Party</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>${getRows}</tbody><tfoot><tr style="font-weight:800"><td colspan="2">Total</td><td class="tag-green" style="text-align:right">₹${fmt(totalGet,2)}</td><td></td></tr></tfoot></table>` : ''}
    ${toGive.length > 0 ? `<h2>To Give To (${toGive.length})</h2><table><thead><tr><th>#</th><th>Party</th><th style="text-align:right">Amount</th><th>Status</th></tr></thead><tbody>${giveRows}</tbody><tfoot><tr style="font-weight:800"><td colspan="2">Total</td><td class="tag-red" style="text-align:right">₹${fmt(totalGive,2)}</td><td></td></tr></tfoot></table>` : ''}
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   8. PARTY-WISE STATEMENT
───────────────────────────────────────────── */
const genPartyStatement = (txs, party, user) => {
  const partyTxs = txs.filter(t => (t.partyId?._id||t.partyId) === party._id);
  const totalIn  = partyTxs.filter(t=>t.type==='got').reduce((s,t)=>s+t.amount,0);
  const totalOut = partyTxs.filter(t=>t.type==='gave').reduce((s,t)=>s+t.amount,0);

  let running = 0;
  const rows = partyTxs.slice().sort((a,b)=>new Date(a.date)-new Date(b.date)).map(t => {
    if (t.type==='got')  running += t.amount;
    if (t.type==='gave') running -= t.amount;
    return `<tr>
      <td>${fmtDate(t.date)}</td>
      <td class="tag-green">${t.type==='got'  ? '₹'+fmt(t.amount,2) : ''}</td>
      <td class="tag-red">  ${t.type==='gave' ? '₹'+fmt(t.amount,2) : ''}</td>
      <td class="${running>=0?'tag-green':'tag-red'}">${running>=0?'+':'-'}₹${fmt(Math.abs(running),2)}</td>
      <td style="color:#888">${t.note||''}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${party.name} Statement</title><style>${BASE_STYLE}</style></head><body>
    ${header(`Account Statement — ${party.name}`, user?.businessName, user?.name, null, 'All time')}
    ${party.phone ? `<p style="font-size:12px;color:#4a5068;margin-bottom:16px">Phone: ${party.phone}</p>` : ''}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Received</div><div class="v" style="color:#1a9e5c">₹${fmt(totalIn,2)}</div></div>
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Given</div><div class="v" style="color:#e53935">₹${fmt(totalOut,2)}</div></div>
      <div class="kpi-c" style="background:${party.balance>=0?'#e6f9f0':'#fff0f0'}"><div class="l" style="color:${party.balance>=0?'#1a9e5c':'#e53935'}">${party.balance>=0?'You Will Receive':'You Will Give'}</div><div class="v" style="color:${party.balance>=0?'#1a9e5c':'#e53935'}">₹${fmt(Math.abs(party.balance),2)}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Transactions</div><div class="v">${partyTxs.length}</div></div>
    </div>
    <h2>Transaction History</h2>
    <table><thead><tr><th>Date</th><th>Received</th><th>Given</th><th>Balance</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   9. ITEM / INVENTORY REPORT  (from bills)
───────────────────────────────────────────── */
const genItemReport = (bills, user, dateRange) => {
  const itemMap = {};
  bills.forEach(bill => {
    bill.items?.forEach(it => {
      const k = it.name.trim().toLowerCase();
      if (!itemMap[k]) itemMap[k] = { name:it.name, qty:0, revenue:0, bills:0 };
      itemMap[k].qty     += it.qty;
      itemMap[k].revenue += it.total;
      itemMap[k].bills++;
    });
  });
  const items = Object.values(itemMap).sort((a,b)=>b.revenue-a.revenue);
  const totalRevenue = items.reduce((s,i)=>s+i.revenue,0);
  const totalQty     = items.reduce((s,i)=>s+i.qty,0);

  const rows = items.map((it,i) => `<tr>
    <td>${i+1}</td><td>${it.name}</td><td style="text-align:right">${it.qty.toFixed(2)}</td>
    <td class="tag-green" style="text-align:right">₹${fmt(it.revenue,2)}</td>
    <td style="text-align:right">${it.bills}</td>
    <td style="text-align:right">₹${fmt(it.revenue/it.qty,2)}</td>
    <td style="text-align:right">${totalRevenue>0?((it.revenue/totalRevenue)*100).toFixed(1):0}%</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Item Report</title><style>${BASE_STYLE}</style></head><body>
    ${header('Item / Inventory Report', user?.businessName, user?.name, null, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#e6f9f0"><div class="l" style="color:#1a9e5c">Total Revenue</div><div class="v" style="color:#1a9e5c">₹${fmt(totalRevenue,2)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Unique Items</div><div class="v" style="color:#1a4fd6">${items.length}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Total Qty Sold</div><div class="v">${totalQty.toFixed(0)}</div></div>
      <div class="kpi-c" style="background:#fff7e6"><div class="l" style="color:#b45309">Total Bills</div><div class="v" style="color:#b45309">${bills.length}</div></div>
    </div>
    ${items.length === 0 ? '<p style="color:#888;text-align:center;padding:20px">No bill items found. Create bills with items to see this report.</p>' : `
    <h2>Items by Revenue</h2>
    <table><thead><tr><th>#</th><th>Item Name</th><th style="text-align:right">Qty Sold</th><th style="text-align:right">Revenue</th><th style="text-align:right">Bills</th><th style="text-align:right">Avg Price</th><th style="text-align:right">Share</th></tr></thead><tbody>${rows}</tbody></table>`}
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ─────────────────────────────────────────────
   10. EXPENSE BY CATEGORY
───────────────────────────────────────────── */
const genExpenseByCategory = (txs, parties, categories, user, dateRange) => {
  const expenses = txs.filter(t=>t.type==='gave');
  const total    = expenses.reduce((s,t)=>s+t.amount,0);

  const catMap = {};
  expenses.forEach(t => {
    const party = parties.find(p => p._id === (t.partyId?._id||t.partyId));
    const catId = party?.categoryId?._id || party?.categoryId || 'uncategorized';
    const cat   = categories.find(c => c._id === catId);
    const catName = cat?.name || 'Uncategorized';
    if (!catMap[catName]) catMap[catName] = { total:0, count:0, parties:{} };
    catMap[catName].total += t.amount;
    catMap[catName].count++;
    const pn = t.partyId?.name||'—';
    catMap[catName].parties[pn] = (catMap[catName].parties[pn]||0) + t.amount;
  });

  const catRows = Object.entries(catMap).sort((a,b)=>b[1].total-a[1].total).map(([name,c],i) => {
    const pct = total > 0 ? ((c.total/total)*100).toFixed(1) : 0;
    const topParty = Object.entries(c.parties).sort((a,b)=>b[1]-a[1])[0];
    return `<tr><td>${i+1}</td><td><strong>${name}</strong></td><td class="tag-red" style="text-align:right">₹${fmt(c.total,2)}</td><td style="text-align:right">${pct}%</td><td style="text-align:right">${c.count}</td><td style="color:#888">${topParty?topParty[0]:''}</td></tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Expense by Category</title><style>${BASE_STYLE}</style></head><body>
    ${header('Expense Report by Category', user?.businessName, user?.name, null, dateRange)}
    <div class="kpi">
      <div class="kpi-c" style="background:#fff0f0"><div class="l" style="color:#e53935">Total Expenses</div><div class="v" style="color:#e53935">₹${fmt(total,2)}</div></div>
      <div class="kpi-c" style="background:#e8eeff"><div class="l" style="color:#1a4fd6">Categories</div><div class="v" style="color:#1a4fd6">${Object.keys(catMap).length}</div></div>
      <div class="kpi-c" style="background:#f8f8f8"><div class="l" style="color:#666">Transactions</div><div class="v">${expenses.length}</div></div>
    </div>
    <h2>Expenses by Category</h2>
    <table><thead><tr><th>#</th><th>Category</th><th style="text-align:right">Amount</th><th style="text-align:right">Share</th><th style="text-align:right">Txns</th><th>Top Party</th></tr></thead><tbody>${catRows}</tbody></table>
    ${footer(user?.name)}</body></html>`;
  openPDF(html);
};

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
export default function DownloadReports() {
  const navigate = useNavigate();
  const [txs,        setTxs]        = useState([]);
  const [allTxs,     setAllTxs]     = useState([]); // unfiltered, for balance sheet
  const [parties,    setParties]    = useState([]);
  const [categories, setCategories] = useState([]);
  const [bills,      setBills]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [generating, setGenerating] = useState('');

  /* date range filter */
  const [startDate, setStartDate] = useState('');
  const [endDate,   setEndDate]   = useState('');
  const [partyId,   setPartyId]   = useState('');

  /* for party-wise statement */
  const [selectedParty, setSelectedParty] = useState('');

  /* hardcoded business info from localStorage */
  const user = (() => { try { return JSON.parse(localStorage.getItem('cb3_user')||'{}'); } catch { return {}; } })();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tR, tAll, pR, cR, bR] = await Promise.all([
        txAPI.getAll({ limit:5000, ...(startDate&&{startDate}), ...(endDate&&{endDate}), ...(partyId&&{partyId}) }),
        txAPI.getAll({ limit:5000 }),
        partyAPI.getAll(),
        categoryAPI.getAll(),
        billAPI.getAll(),
      ]);
      setTxs(tR.data.data || []);
      setAllTxs(tAll.data.data || []);
      setParties(pR.data.data || []);
      setCategories(cR.data.data || []);
      setBills(bR.data.data || []);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [startDate, endDate, partyId]);

  useEffect(() => { load(); }, [load]);

  const dateRange = startDate && endDate ? `${startDate} to ${endDate}` : startDate ? `From ${startDate}` : endDate ? `Until ${endDate}` : 'All time';
  const partyFilter = partyId ? `Party: ${parties.find(p=>p._id===partyId)?.name||''}` : '';

  const gen = async (key, fn) => {
    setGenerating(key);
    try { await fn(); }
    finally { setTimeout(() => setGenerating(''), 600); }
  };

  const REPORT_GROUPS = [
    {
      title: 'Income & Sales',
      color: '#1a9e5c',
      bg: '#e6f9f0',
      reports: [
        { key:'sales',    label:'Sales Report',       desc:'All received transactions by party and date',    action: () => genSalesReport(txs, parties, user, dateRange, partyFilter) },
        { key:'pl',       label:'Profit & Loss',      desc:'Income vs expenses with monthly breakdown',      action: () => genPLReport(txs, user, dateRange) },
        { key:'cashflow', label:'Cash Flow Statement',desc:'Monthly cash inflow/outflow and running balance', action: () => genCashFlow(txs, user, dateRange) },
      ]
    },
    {
      title: 'Expenses & Purchases',
      color: '#e53935',
      bg: '#fff0f0',
      reports: [
        { key:'purchase', label:'Purchase Report',       desc:'All given transactions by supplier',              action: () => genPurchaseReport(txs, user, dateRange, partyFilter) },
        { key:'expcat',   label:'Expense by Category',   desc:'Expenses broken down by category',               action: () => genExpenseByCategory(txs, parties, categories, user, dateRange) },
      ]
    },
    {
      title: 'GST Reports',
      color: '#1a4fd6',
      bg: '#e8eeff',
      reports: [
        { key:'gstr1',  label:'GSTR-1 (Outward Supplies)', desc:'Sales invoice details for GST filing', action: () => genGSTReport(txs, user, dateRange, 'GSTR-1') },
        { key:'gstr3b', label:'GSTR-3B (Summary)',         desc:'Consolidated GST summary with ITC',    action: () => genGSTReport(txs, user, dateRange, 'GSTR-3B') },
      ]
    },
    {
      title: 'Balance & Outstanding',
      color: '#b45309',
      bg: '#fff7e6',
      reports: [
        { key:'balance',     label:'Balance Sheet',          desc:'All assets (receivable) vs liabilities (payable)', action: () => genBalanceSheet(allTxs, parties, categories, user) },
        { key:'outstanding', label:'Outstanding Balances',   desc:'Who owes you and who you owe right now',            action: () => genOutstandingBills(parties, user) },
      ]
    },
    {
      title: 'Party & Items',
      color: '#7b1fa2',
      bg: '#f3e8ff',
      reports: [
        { key:'party', label:'Party-wise Statement', desc:'Full transaction history for a specific party', action: () => {
          const p = parties.find(p=>p._id===selectedParty);
          if (!p) return;
          genPartyStatement(allTxs, p, user);
        }},
        { key:'items', label:'Item / Inventory Report', desc:'Items sold via bills — qty, revenue, share', action: () => genItemReport(bills, user, dateRange) },
      ]
    },
  ];

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>

      {/* Header */}
      <div className="grad-blue" style={{ padding:'18px 16px 20px', color:'white' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => navigate(-1)} className="back-btn">←</button>
          <div>
            <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>Download Reports</h2>
            <p style={{ fontSize:12, opacity:.7, marginTop:3 }}>10 report types · Print-ready PDFs</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>

        {/* Global Filters */}
        <div className="card card-p" style={{ marginBottom:16 }}>
          <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:10 }}>Date Range Filter</p>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <div className="field" style={{ margin:0 }}><label>From</label><input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} style={{ fontSize:13 }}/></div>
            <div className="field" style={{ margin:0 }}><label>To</label>  <input type="date" value={endDate}   onChange={e=>setEndDate(e.target.value)}   style={{ fontSize:13 }}/></div>
          </div>
          <div className="field" style={{ margin:0, marginBottom:8 }}>
            <label>Filter by Party (optional)</label>
            <select value={partyId} onChange={e=>setPartyId(e.target.value)} style={{ fontSize:13, background:'transparent' }}>
              <option value="">All parties</option>
              {parties.map(p=><option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          {(startDate||endDate||partyId) && (
            <button onClick={()=>{setStartDate('');setEndDate('');setPartyId('');}} style={{ fontSize:12, fontWeight:600, color:'var(--red)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>Clear filters ×</button>
          )}
          {(startDate||endDate||partyId) && <p style={{ fontSize:11, color:'var(--text3)', marginTop:6 }}>Applied: {[dateRange!=='All time'&&dateRange, partyFilter].filter(Boolean).join(' · ')}</p>}
        </div>

        {/* Party selector for party-wise statement */}
        <div className="card card-p" style={{ marginBottom:16, borderLeft:'3px solid #7b1fa2' }}>
          <p style={{ fontWeight:700, fontSize:13, color:'var(--text2)', marginBottom:8 }}>Party-wise Statement</p>
          <p style={{ fontSize:12, color:'var(--text3)', marginBottom:10 }}>Select a party to generate their full account statement</p>
          <div className="field" style={{ margin:0 }}>
            <label>Select Party</label>
            <select value={selectedParty} onChange={e=>setSelectedParty(e.target.value)} style={{ fontSize:14, background:'transparent' }}>
              <option value="">Choose a party…</option>
              {parties.map(p=><option key={p._id} value={p._id}>{p.name} {p.balance>0?`(to get ₹${fmt(p.balance,0)})`:p.balance<0?`(to give ₹${fmt(Math.abs(p.balance),0)})`:''}</option>)}
            </select>
          </div>
        </div>

        {loading ? <div className="spinner"><div className="spin"/></div> : (
          REPORT_GROUPS.map(group => (
            <div key={group.title} style={{ marginBottom:18 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                <div style={{ width:4, height:18, borderRadius:2, background:group.color }}/>
                <p style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>{group.title}</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {group.reports.map(report => {
                  const isPartyStatement = report.key === 'party';
                  const disabled = isPartyStatement && !selectedParty;
                  const busy = generating === report.key;
                  return (
                    <div key={report.key}
                      style={{ background:'white', borderRadius:14, padding:'14px 16px', display:'flex', alignItems:'center', gap:14, boxShadow:'0 1px 6px rgba(0,0,0,.06)', borderLeft:`3px solid ${group.color}` }}>
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:700, fontSize:14, color:'var(--text)', marginBottom:3 }}>{report.label}</p>
                        <p style={{ fontSize:12, color:'var(--text3)' }}>{report.desc}</p>
                        {isPartyStatement && !selectedParty && <p style={{ fontSize:11, color:'var(--orange)', marginTop:4, fontWeight:600 }}>Select a party above first</p>}
                      </div>
                      <button
                        onClick={() => !disabled && gen(report.key, report.action)}
                        disabled={disabled || !!generating}
                        style={{ flexShrink:0, padding:'9px 16px', borderRadius:50, border:'none', background: disabled?'var(--border)':group.bg, color: disabled?'var(--text4)':group.color, fontWeight:700, fontSize:12, cursor: disabled?'not-allowed':'pointer', fontFamily:'inherit', whiteSpace:'nowrap', opacity: (!!generating && !busy)?0.5:1 }}>
                        {busy ? '…' : '⬇ PDF'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

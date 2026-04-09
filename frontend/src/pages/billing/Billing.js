import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billAPI, partyAPI } from '../../api';
import { fmt, todayStr, fmtDate } from '../../utils/helpers';

const EMPTY_ITEM = { name:'', qty:'1', price:'' };

/* ── Status config ── */
const STATUS = {
  unpaid:  { bg:'var(--red-lt)',    color:'var(--red)',    label:'Unpaid'  },
  paid:    { bg:'var(--green-lt)',  color:'var(--green)',  label:'Paid'    },
  partial: { bg:'var(--orange-lt)', color:'var(--orange)', label:'Partial' },
};

/* ── Bill Detail Sheet ── */
function BillDetail({ bill, onClose, onRefresh }) {
  const [saving,    setSaving]    = useState(false);
  const [confirmDel,setConfirmDel]= useState(false);

  const saveTx = async () => {
    setSaving(true);
    try { await billAPI.saveAsTx(bill._id); toast.success('Saved as transaction!'); onRefresh(); onClose(); }
    catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const markPaid = async () => {
    try { await billAPI.status(bill._id, 'paid'); toast.success('Marked as paid!'); onRefresh(); onClose(); }
    catch { toast.error('Failed'); }
  };

  const del = async () => {
    try { await billAPI.delete(bill._id); toast.success('Bill deleted'); onRefresh(); onClose(); }
    catch { toast.error('Failed'); }
  };

  const s = STATUS[bill.status] || STATUS.unpaid;
  const imgSrc = bill.receiptImage
    ? (bill.receiptImage.startsWith('http') ? bill.receiptImage : `${process.env.REACT_APP_API_URL || ''}${bill.receiptImage}`)
    : null;

  if (confirmDel) return (
    <div className="overlay" onClick={() => setConfirmDel(false)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3 style={{ fontWeight:800, marginBottom:6 }}>Delete Bill?</h3>
        <p style={{ fontSize:13, color:'var(--text2)', marginBottom:20 }}>
          This will delete {bill.billNumber} permanently.
          {bill.savedAsTransaction && ' The linked transaction will also be reversed.'}
        </p>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-ghost btn-full" onClick={() => setConfirmDel(false)}>Cancel</button>
          <button className="btn btn-red btn-full" onClick={del}>Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()} style={{ maxHeight:'90vh', overflowY:'auto', padding:0 }}>

        {/* Header */}
        <div style={{ padding:'18px 18px 14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <h3 style={{ fontWeight:800, fontSize:18, margin:0 }}>{bill.billNumber}</h3>
              <p style={{ color:'var(--text3)', fontSize:13, marginTop:4 }}>
                {bill.partyId?.name} &nbsp;•&nbsp; {fmtDate(bill.date)}
              </p>
            </div>
            <span style={{ background:s.bg, color:s.color, padding:'5px 12px', borderRadius:50, fontSize:12, fontWeight:700 }}>
              {s.label}
            </span>
          </div>
        </div>

        <div style={{ padding:'16px 18px' }}>
          {/* Receipt image */}
          {imgSrc && (
            <img src={imgSrc} alt="Receipt"
              style={{ width:'100%', borderRadius:12, maxHeight:200, objectFit:'cover', border:'1px solid var(--border)', marginBottom:16 }}/>
          )}

          {/* Items */}
          <div style={{ background:'var(--bg)', borderRadius:12, overflow:'hidden', marginBottom:16 }}>
            {bill.items.map((it, i) => (
              <div key={i} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'11px 14px', borderBottom: i<bill.items.length-1?'1px solid var(--border)':'none' }}>
                <div>
                  <p style={{ fontWeight:700, fontSize:14 }}>{it.name}</p>
                  <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{it.qty} × ₹{fmt(it.price,2)}</p>
                </div>
                <p style={{ fontWeight:800, fontSize:15 }}>₹{fmt(it.total,2)}</p>
              </div>
            ))}
            {/* Totals */}
            <div style={{ padding:'12px 14px', borderTop:'2px solid var(--border)', background:'white' }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <p style={{ color:'var(--text2)', fontSize:13 }}>Subtotal</p>
                <p style={{ fontSize:13 }}>₹{fmt(bill.subtotal,2)}</p>
              </div>
              {bill.discount > 0 && (
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                  <p style={{ color:'var(--green)', fontSize:13, fontWeight:600 }}>Discount</p>
                  <p style={{ color:'var(--green)', fontSize:13, fontWeight:600 }}>-₹{fmt(bill.discount,2)}</p>
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'space-between', paddingTop:8, borderTop:'1px solid var(--border)' }}>
                <p style={{ fontWeight:800, fontSize:17 }}>Total</p>
                <p style={{ fontWeight:800, fontSize:20, color:'var(--blue)' }}>₹{fmt(bill.total,2)}</p>
              </div>
            </div>
          </div>

          {bill.notes && (
            <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 14px', marginBottom:16 }}>
              <p style={{ fontSize:12, fontWeight:700, color:'var(--text3)', marginBottom:4 }}>NOTES</p>
              <p style={{ fontSize:13, color:'var(--text2)' }}>{bill.notes}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {!bill.savedAsTransaction && (
              <button className="btn btn-primary btn-full" style={{ padding:14 }} onClick={saveTx} disabled={saving}>
                {saving ? 'Saving…' : '💳 Save as Transaction'}
              </button>
            )}
            {bill.status !== 'paid' && (
              <button className="btn btn-green btn-full" style={{ padding:14 }} onClick={markPaid}>
                ✅ Mark as Paid
              </button>
            )}
            <button onClick={() => setConfirmDel(true)}
              style={{ padding:14, borderRadius:50, border:'1.5px solid var(--red)', background:'var(--red-lt)', color:'var(--red)', fontWeight:700, fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
              🗑️ Delete Bill
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main Billing Page ── */
export default function Billing() {
  const navigate   = useNavigate();
  const [sp]       = useSearchParams();
  const prePartyId = sp.get('party') || '';

  const [view,       setView]       = useState(prePartyId ? 'create' : 'list');
  const [bills,      setBills]      = useState([]);
  const [parties,    setParties]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [detailBill, setDetailBill] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');

  /* form */
  const [partyId,    setPartyId]    = useState(prePartyId);
  const [items,      setItems]      = useState([{...EMPTY_ITEM}]);
  const [discount,   setDiscount]   = useState('');
  const [notes,      setNotes]      = useState('');
  const [date,       setDate]       = useState(todayStr());
  const [billNum,    setBillNum]    = useState('');
  const [imgFile,    setImgFile]    = useState(null);
  const [imgPreview, setImgPreview] = useState('');
  const fileRef   = useRef(null);
  const cameraRef = useRef(null);

  const loadBills   = useCallback(async () => {
    try { const r = await billAPI.getAll(); setBills(r.data.data || []); }
    catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadParties = useCallback(async () => {
    try { const r = await partyAPI.getAll(); setParties(r.data.data || []); }
    catch {}
  }, []);

  useEffect(() => { loadBills(); loadParties(); }, [loadBills, loadParties]);

  const subtotal = items.reduce((s,it) => s + (parseFloat(it.qty)||0)*(parseFloat(it.price)||0), 0);
  const disc     = Math.min(parseFloat(discount)||0, subtotal);
  const total    = subtotal - disc;

  const setItem = (i,k,v) => setItems(prev => prev.map((it,idx) => idx===i ? {...it,[k]:v} : it));
  const addItem = () => setItems(prev => [...prev, {...EMPTY_ITEM}]);
  const remItem = i => setItems(prev => prev.length>1 ? prev.filter((_,idx)=>idx!==i) : prev);

  const handleImage = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgFile(file);
    setImgPreview(URL.createObjectURL(file));
  };

  const resetForm = () => {
    setPartyId(prePartyId); setItems([{...EMPTY_ITEM}]); setDiscount('');
    setNotes(''); setDate(todayStr()); setBillNum('');
    setImgFile(null); setImgPreview('');
  };

  const submit = async e => {
    e.preventDefault();
    if (!partyId) return toast.error('Select a party');
    const valid = items.filter(it => it.name.trim() && parseFloat(it.qty)>0);
    if (!valid.length) return toast.error('Add at least one item');
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('partyId', partyId);
      fd.append('items', JSON.stringify(valid.map(it => ({ name:it.name.trim(), qty:parseFloat(it.qty), price:parseFloat(it.price)||0 }))));
      fd.append('discount', discount||'0');
      fd.append('notes', notes);
      fd.append('date', date);
      fd.append('billNumber', billNum.trim());
      if (imgFile) fd.append('receiptImage', imgFile);
      await billAPI.create(fd);
      toast.success('Bill created!');
      resetForm(); loadBills(); setView('list');
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const filteredBills = filterStatus ? bills.filter(b => b.status === filterStatus) : bills;
  const totalUnpaid   = bills.filter(b=>b.status==='unpaid').reduce((s,b)=>s+b.total,0);
  const totalPaid     = bills.filter(b=>b.status==='paid').reduce((s,b)=>s+b.total,0);

  /* ── LIST VIEW ── */
  if (view === 'list') return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>
      <div className="grad-blue" style={{ padding:'18px 16px 20px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ fontSize:19, fontWeight:800, margin:0 }}>🧾 Billing</h2>
        </div>
        {/* Summary row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginTop:14 }}>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:10, opacity:.7, marginBottom:3 }}>Unpaid</p>
            <p style={{ fontSize:18, fontWeight:800, color:'#f87171' }}>₹{fmt(totalUnpaid,0)}</p>
          </div>
          <div style={{ background:'rgba(255,255,255,.12)', borderRadius:12, padding:'10px 14px' }}>
            <p style={{ fontSize:10, opacity:.7, marginBottom:3 }}>Collected</p>
            <p style={{ fontSize:18, fontWeight:800, color:'#4ade80' }}>₹{fmt(totalPaid,0)}</p>
          </div>
        </div>
      </div>

      <div style={{ padding:'14px 14px 0' }}>
        {/* Filter chips */}
        <div style={{ display:'flex', gap:6, marginBottom:14 }}>
          {['', 'unpaid', 'paid', 'partial'].map(s => {
            const labels = { '':'All', unpaid:'Unpaid', paid:'Paid', partial:'Partial' };
            const active = filterStatus === s;
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ padding:'6px 14px', borderRadius:50, fontSize:12, fontWeight:700, fontFamily:'inherit', cursor:'pointer',
                  border:`1.5px solid ${active?'var(--blue)':'var(--border)'}`,
                  background: active?'var(--blue)':'white',
                  color: active?'white':'var(--text2)' }}>
                {labels[s]}
              </button>
            );
          })}
        </div>

        {loading ? <div className="spinner"><div className="spin"/></div>
          : filteredBills.length === 0 ? (
            <div className="empty">
              <div className="ico">🧾</div>
              <h3>{filterStatus ? `No ${filterStatus} bills` : 'No bills yet'}</h3>
              <p>Tap + NEW BILL to create one</p>
            </div>
          ) : filteredBills.map(b => {
            const s = STATUS[b.status] || STATUS.unpaid;
            return (
              <div key={b._id} onClick={() => setDetailBill(b)}
                style={{ background:'white', borderRadius:16, padding:'14px 16px', marginBottom:10, display:'flex', alignItems:'center', gap:12, boxShadow:'0 1px 8px rgba(26,79,214,.07)', cursor:'pointer', borderLeft:`4px solid ${s.color}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <p style={{ fontWeight:800, fontSize:15 }}>{b.billNumber}</p>
                    <span style={{ background:s.bg, color:s.color, padding:'2px 8px', borderRadius:50, fontSize:10, fontWeight:700 }}>{s.label}</span>
                  </div>
                  <p style={{ fontSize:13, color:'var(--text3)' }}>{b.partyId?.name||'—'} &nbsp;•&nbsp; {fmtDate(b.date)}</p>
                  {b.savedAsTransaction && <p style={{ fontSize:11, color:'var(--green)', marginTop:3, fontWeight:600 }}>✓ Linked to transaction</p>}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <p style={{ fontWeight:800, fontSize:17, color:'var(--text)' }}>₹{fmt(b.total,0)}</p>
                  <p style={{ fontSize:11, color:'var(--text4)', marginTop:2 }}>{b.items?.length} item{b.items?.length!==1?'s':''}</p>
                </div>
              </div>
            );
          })
        }
      </div>

      <button className="fab fab-blue" onClick={() => { resetForm(); setView('create'); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        NEW BILL
      </button>

      {detailBill && <BillDetail bill={detailBill} onClose={() => setDetailBill(null)} onRefresh={loadBills}/>}
    </div>
  );

  /* ── CREATE VIEW ── */
  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:100 }}>
      <div className="grad-blue" style={{ padding:'16px 16px 20px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => { resetForm(); setView('list'); }}>←</button>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Create Bill</h2>
        </div>
      </div>

      <form onSubmit={submit} style={{ padding:'16px 14px 0' }}>

        {/* Party selector */}
        <div className="field">
          <label>Party *</label>
          <select value={partyId} onChange={e=>setPartyId(e.target.value)} style={{ fontSize:15, background:'transparent' }}>
            <option value="">Select party…</option>
            {parties.map(p => <option key={p._id} value={p._id}>{p.name}{p.categoryId?.name?` · ${p.categoryId.name}`:''}</option>)}
          </select>
        </div>

        {/* Bill no + date */}
        <div style={{ display:'flex', gap:10 }}>
          <div className="field" style={{ flex:1 }}><label>Bill #</label><input placeholder="Auto" value={billNum} onChange={e=>setBillNum(e.target.value)}/></div>
          <div className="field" style={{ flex:1 }}><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} max={todayStr()}/></div>
        </div>

        {/* Items */}
        <p className="sec-title" style={{ marginTop:4, marginBottom:8 }}>Items</p>
        <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
          {/* Header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 56px 80px 32px', gap:4, padding:'8px 14px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
            {['Item','Qty','Price ₹',''].map(h => <p key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase' }}>{h}</p>)}
          </div>
          {items.map((it, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 56px 80px 32px', gap:4, padding:'10px 14px', borderBottom:'1px solid var(--border)', alignItems:'center', background: i%2===0?'white':'var(--bg)' }}>
              <input placeholder="Item name" value={it.name} onChange={e=>setItem(i,'name',e.target.value)}
                style={{ fontSize:14, background:'transparent', border:'none', width:'100%', fontFamily:'inherit' }}/>
              <input type="number" min="0" step="0.001" placeholder="1" value={it.qty} onChange={e=>setItem(i,'qty',e.target.value)}
                style={{ fontSize:14, background:'transparent', border:'none', width:'100%', fontFamily:'inherit' }}/>
              <input type="number" min="0" step="0.01" placeholder="0" value={it.price} onChange={e=>setItem(i,'price',e.target.value)}
                style={{ fontSize:14, background:'transparent', border:'none', width:'100%', fontFamily:'inherit' }}/>
              <button type="button" onClick={()=>remItem(i)} style={{ color:'var(--red)', fontSize:20, border:'none', background:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addItem}
            style={{ width:'100%', padding:'11px', fontSize:13, fontWeight:700, color:'var(--blue)', background:'var(--blue-lt)', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
            + Add Item
          </button>
        </div>

        {/* Live total */}
        <div className="card card-p" style={{ marginBottom:14, background: total>0?'var(--blue-lt)':'var(--bg)' }}>
          {subtotal > 0 && disc > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <p style={{ color:'var(--text2)', fontSize:13 }}>Subtotal</p>
              <p style={{ fontSize:13 }}>₹{fmt(subtotal,2)}</p>
            </div>
          )}
          {disc > 0 && (
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
              <p style={{ color:'var(--green)', fontSize:13, fontWeight:600 }}>Discount</p>
              <p style={{ color:'var(--green)', fontSize:13, fontWeight:600 }}>-₹{fmt(disc,2)}</p>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <p style={{ fontWeight:800, fontSize:16 }}>Total</p>
            <p style={{ fontWeight:800, fontSize:22, color:'var(--blue)' }}>₹{fmt(total,2)}</p>
          </div>
        </div>

        {/* Discount + notes */}
        <div style={{ display:'flex', gap:10 }}>
          <div className="field" style={{ flex:1 }}><label>Discount (₹)</label><input type="number" min="0" step="0.01" placeholder="0" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
        </div>
        <div className="field"><label>Notes (optional)</label><textarea rows={2} placeholder="Any notes for this bill…" value={notes} onChange={e=>setNotes(e.target.value)}/></div>

        {/* Receipt image */}
        <p className="sec-title" style={{ marginBottom:8 }}>Receipt Photo (Optional)</p>
        <div style={{ marginBottom:16 }}>
          {imgPreview ? (
            <div style={{ position:'relative', marginBottom:10 }}>
              <img src={imgPreview} alt="Preview" style={{ width:'100%', borderRadius:12, maxHeight:200, objectFit:'cover', border:'1px solid var(--border)' }}/>
              <button type="button" onClick={() => { setImgFile(null); setImgPreview(''); }}
                style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.65)', color:'white', border:'none', borderRadius:'50%', width:30, height:30, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                ×
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', gap:10 }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ flex:1, padding:'14px', borderRadius:12, border:'2px dashed var(--border)', background:'white', fontSize:13, fontWeight:700, color:'var(--text2)', cursor:'pointer', fontFamily:'inherit' }}>
                🖼️ Gallery
              </button>
              <button type="button" onClick={() => cameraRef.current?.click()}
                style={{ flex:1, padding:'14px', borderRadius:12, border:'2px dashed var(--border)', background:'white', fontSize:13, fontWeight:700, color:'var(--text2)', cursor:'pointer', fontFamily:'inherit' }}>
                📸 Camera
              </button>
            </div>
          )}
          <input ref={fileRef}   type="file" accept="image/*" onChange={handleImage} style={{ display:'none' }}/>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display:'none' }}/>
        </div>

        <button type="submit" className="btn btn-primary btn-full" style={{ padding:16, fontSize:16 }} disabled={saving}>
          {saving ? 'Creating Bill…' : '💾 Create Bill'}
        </button>
      </form>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { billAPI, partyAPI } from '../../api';
import { fmt, todayStr, fmtDate } from '../../utils/helpers';

const EMPTY_ITEM = { name:'', qty:'1', price:'' };

function BillDetail({ bill, onClose, onRefresh }) {
  const [saving, setSaving] = useState(false);

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
    if (!window.confirm('Delete this bill?')) return;
    try { await billAPI.delete(bill._id); toast.success('Bill deleted'); onRefresh(); onClose(); }
    catch { toast.error('Failed'); }
  };

  const statusStyle = s => {
    const m = { unpaid:['var(--red-lt)','var(--red)'], paid:['var(--green-lt)','var(--green)'], partial:['var(--orange-lt)','var(--orange)'] };
    return m[s] || m.unpaid;
  };

  const imgSrc = bill.receiptImage
    ? (bill.receiptImage.startsWith('http') ? bill.receiptImage : `${process.env.REACT_APP_API_URL || ''}${bill.receiptImage}`)
    : null;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" onClick={e=>e.stopPropagation()} style={{ maxHeight:'88vh', overflowY:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div>
            <h3 style={{ fontWeight:800, margin:0 }}>{bill.billNumber}</h3>
            <p style={{ color:'var(--text3)', fontSize:13, marginTop:3 }}>{bill.partyId?.name} · {fmtDate(bill.date)}</p>
          </div>
          <span style={{ background:statusStyle(bill.status)[0], color:statusStyle(bill.status)[1], padding:'3px 10px', borderRadius:50, fontSize:11, fontWeight:700, textTransform:'capitalize' }}>{bill.status}</span>
        </div>

        {/* Receipt image */}
        {imgSrc && (
          <div style={{ marginBottom:14 }}>
            <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', marginBottom:6 }}>📷 Receipt</p>
            <img src={imgSrc} alt="Receipt" style={{ width:'100%', borderRadius:10, maxHeight:200, objectFit:'cover', border:'1px solid var(--border)' }}/>
          </div>
        )}

        {/* Items */}
        <div style={{ background:'var(--bg)', borderRadius:10, padding:'10px 14px', marginBottom:12 }}>
          {bill.items.map((it,i) => (
            <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'5px 0', borderBottom: i<bill.items.length-1?'1px solid var(--border)':'none' }}>
              <div><p style={{ fontWeight:600, fontSize:14 }}>{it.name}</p><p style={{ fontSize:12, color:'var(--text3)' }}>{it.qty} × ₹{fmt(it.price,2)}</p></div>
              <p style={{ fontWeight:700, fontSize:14 }}>₹{fmt(it.total,2)}</p>
            </div>
          ))}
          <div style={{ borderTop:'1.5px solid var(--border)', marginTop:6, paddingTop:8 }}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><p style={{ color:'var(--text2)' }}>Subtotal</p><p>₹{fmt(bill.subtotal,2)}</p></div>
            {bill.discount>0 && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}><p style={{ color:'var(--green)' }}>Discount</p><p style={{ color:'var(--green)' }}>-₹{fmt(bill.discount,2)}</p></div>}
            <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1.5px solid var(--text2)', paddingTop:6 }}>
              <p style={{ fontWeight:800, fontSize:17 }}>Total</p>
              <p style={{ fontWeight:800, fontSize:17, color:'var(--blue)' }}>₹{fmt(bill.total,2)}</p>
            </div>
          </div>
        </div>

        {bill.notes && <p style={{ fontSize:13, color:'var(--text2)', marginBottom:12 }}>📝 {bill.notes}</p>}

        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {!bill.savedAsTransaction && <button className="btn btn-primary" style={{ flex:1 }} onClick={saveTx} disabled={saving}>{saving?'Saving…':'💳 Save as Txn'}</button>}
          {bill.status!=='paid' && <button className="btn btn-green" style={{ flex:1 }} onClick={markPaid}>✅ Mark Paid</button>}
          <button className="btn btn-full" style={{ background:'var(--red-lt)', color:'var(--red)' }} onClick={del}>🗑️ Delete Bill</button>
        </div>
      </div>
    </div>
  );
}

export default function Billing() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const prePartyId = sp.get('party') || '';

  const [view,      setView]      = useState(prePartyId ? 'create' : 'list');
  const [bills,     setBills]     = useState([]);
  const [parties,   setParties]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [detailBill,setDetailBill]= useState(null);

  // form
  const [partyId,   setPartyId]   = useState(prePartyId);
  const [items,     setItems]     = useState([{...EMPTY_ITEM}]);
  const [discount,  setDiscount]  = useState('0');
  const [notes,     setNotes]     = useState('');
  const [date,      setDate]      = useState(todayStr());
  const [billNum,   setBillNum]   = useState('');
  const [imgFile,   setImgFile]   = useState(null);
  const [imgPreview,setImgPreview]= useState('');
  const fileInputRef  = useRef(null);
  const cameraInputRef= useRef(null);

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
    const url = URL.createObjectURL(file);
    setImgPreview(url);
  };

  const resetForm = () => {
    setPartyId(prePartyId); setItems([{...EMPTY_ITEM}]); setDiscount('0');
    setNotes(''); setDate(todayStr()); setBillNum('');
    setImgFile(null); setImgPreview('');
  };

  const submit = async e => {
    e.preventDefault();
    if (!partyId) return toast.error('Select a party');
    const valid = items.filter(it => it.name.trim() && parseFloat(it.qty)>0);
    if (!valid.length) return toast.error('Add at least one item with name and qty > 0');
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
      resetForm();
      loadBills();
      setView('list');
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  const statusBadge = s => {
    const m = { unpaid:['var(--red-lt)','var(--red)'], paid:['var(--green-lt)','var(--green)'], partial:['var(--orange-lt)','var(--orange)'] };
    const [bg,c] = m[s]||m.unpaid;
    return <span style={{ background:bg, color:c, padding:'2px 10px', borderRadius:50, fontSize:11, fontWeight:700, textTransform:'capitalize' }}>{s}</span>;
  };

  // LIST VIEW
  if (view === 'list') return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>
      <div className="grad-blue" style={{ padding:'18px 16px 22px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ fontSize:19, fontWeight:800, margin:0 }}>🧾 Billing</h2>
        </div>
        <p style={{ opacity:.7, fontSize:13, marginTop:4 }}>Create and manage bills</p>
      </div>
      <div style={{ padding:'14px 14px 0' }}>
        {loading ? <div className="spinner"><div className="spin"/></div>
          : bills.length===0 ? (
            <div className="empty"><div className="ico">🧾</div><h3>No bills yet</h3><p>Create your first bill</p></div>
          ) : bills.map(b => (
            <div key={b._id} className="list-item" onClick={() => setDetailBill(b)}>
              <div style={{ width:40, height:40, borderRadius:10, background:'var(--blue-lt)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🧾</div>
              <div className="li-info">
                <h3>{b.billNumber}</h3>
                <p>{b.partyId?.name||'—'} · {fmtDate(b.date)}</p>
              </div>
              <div style={{ textAlign:'right' }}>
                <p style={{ fontWeight:800, fontSize:15 }}>₹{fmt(b.total,2)}</p>
                <div style={{ marginTop:4 }}>{statusBadge(b.status)}</div>
              </div>
            </div>
          ))
        }
      </div>
      <button className="fab fab-blue" onClick={() => { resetForm(); setView('create'); }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        NEW BILL
      </button>
      {detailBill && <BillDetail bill={detailBill} onClose={() => setDetailBill(null)} onRefresh={loadBills}/>}
    </div>
  );

  // CREATE VIEW
  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>
      <div className="grad-blue" style={{ padding:'16px 16px 22px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => { resetForm(); setView('list'); }}>←</button>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Create Bill</h2>
        </div>
      </div>

      <form onSubmit={submit} style={{ padding:'14px 14px 0' }}>
        {/* Party + Bill info */}
        <div className="field">
          <label>Party *</label>
          <select value={partyId} onChange={e=>setPartyId(e.target.value)} style={{ fontSize:15, background:'transparent' }}>
            <option value="">Select party…</option>
            {parties.map(p => <option key={p._id} value={p._id}>{p.name}{p.categoryId?.name?` (${p.categoryId.name})`:''}</option>)}
          </select>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <div className="field" style={{ flex:1 }}><label>Bill Number</label><input placeholder="Auto" value={billNum} onChange={e=>setBillNum(e.target.value)}/></div>
          <div className="field" style={{ flex:1 }}><label>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} max={todayStr()}/></div>
        </div>

        {/* Items table */}
        <p className="sec-title" style={{ marginTop:4 }}>Items</p>
        <div className="card" style={{ overflow:'hidden', marginBottom:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 52px 78px 28px', gap:4, padding:'7px 12px', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
            {['Item Name','Qty','Price ₹',''].map(h => <p key={h} style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase' }}>{h}</p>)}
          </div>
          {items.map((it,i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 52px 78px 28px', gap:4, padding:'8px 12px', borderBottom:'1px solid var(--border)', alignItems:'center' }}>
              <input placeholder="Name" value={it.name} onChange={e=>setItem(i,'name',e.target.value)} style={{ fontSize:14, background:'transparent', border:'none', width:'100%' }}/>
              <input type="number" min="0" step="0.001" placeholder="1" value={it.qty} onChange={e=>setItem(i,'qty',e.target.value)} style={{ fontSize:14, background:'transparent', border:'none', width:'100%' }}/>
              <input type="number" min="0" step="0.01" placeholder="0.00" value={it.price} onChange={e=>setItem(i,'price',e.target.value)} style={{ fontSize:14, background:'transparent', border:'none', width:'100%' }}/>
              <button type="button" onClick={()=>remItem(i)} style={{ color:'var(--red)', fontSize:18, fontWeight:700, border:'none', background:'none', cursor:'pointer' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addItem} style={{ width:'100%', padding:'9px', fontSize:13, fontWeight:700, color:'var(--blue)', background:'var(--blue-lt)', border:'none', cursor:'pointer', fontFamily:'inherit' }}>+ Add Item</button>
        </div>

        <div className="field"><label>Discount (₹)</label><input type="number" min="0" step="0.01" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
        <div className="field"><label>Notes</label><textarea rows={2} placeholder="Bill notes…" value={notes} onChange={e=>setNotes(e.target.value)}/></div>

        {/* Receipt image upload */}
        <p className="sec-title">📷 Receipt Image (Optional)</p>
        <div className="card card-p" style={{ marginBottom:14 }}>
          {imgPreview ? (
            <div style={{ position:'relative', marginBottom:10 }}>
              <img src={imgPreview} alt="Preview" style={{ width:'100%', borderRadius:10, maxHeight:180, objectFit:'cover' }}/>
              <button type="button" onClick={() => { setImgFile(null); setImgPreview(''); }} style={{ position:'absolute', top:6, right:6, background:'rgba(0,0,0,.6)', color:'white', border:'none', borderRadius:'50%', width:28, height:28, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
            </div>
          ) : (
            <div style={{ border:'2px dashed var(--border)', borderRadius:10, padding:'20px', textAlign:'center', marginBottom:10 }}>
              <p style={{ fontSize:24, marginBottom:6 }}>🖼️</p>
              <p style={{ fontSize:13, color:'var(--text3)' }}>Upload receipt photo</p>
            </div>
          )}
          <div style={{ display:'flex', gap:10 }}>
            {/* Gallery upload */}
            <button type="button" onClick={() => fileInputRef.current?.click()}
              style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid var(--border)', background:'white', fontSize:13, fontWeight:700, color:'var(--text2)', cursor:'pointer', fontFamily:'inherit' }}>
              🖼️ Gallery
            </button>
            {/* Camera capture */}
            <button type="button" onClick={() => cameraInputRef.current?.click()}
              style={{ flex:1, padding:'10px', borderRadius:10, border:'1.5px solid var(--border)', background:'white', fontSize:13, fontWeight:700, color:'var(--text2)', cursor:'pointer', fontFamily:'inherit' }}>
              📸 Camera
            </button>
          </div>
          {/* Hidden inputs — accept triggers gallery, capture=camera triggers camera */}
          <input ref={fileInputRef}   type="file" accept="image/*"           onChange={handleImage} style={{ display:'none' }}/>
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImage} style={{ display:'none' }}/>
        </div>

        {/* Total summary */}
        <div className="card card-p" style={{ marginBottom:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}><p style={{ color:'var(--text2)' }}>Subtotal</p><p>₹{fmt(subtotal,2)}</p></div>
          {disc>0 && <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}><p style={{ color:'var(--green)' }}>Discount</p><p style={{ color:'var(--green)' }}>-₹{fmt(disc,2)}</p></div>}
          <div style={{ display:'flex', justifyContent:'space-between', borderTop:'1.5px solid var(--border)', paddingTop:8 }}>
            <p style={{ fontWeight:800, fontSize:17 }}>Total</p>
            <p style={{ fontWeight:800, fontSize:17, color:'var(--blue)' }}>₹{fmt(total,2)}</p>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-full" style={{ padding:15 }} disabled={saving}>{saving?'Saving…':'💾 Save Bill'}</button>
      </form>
    </div>
  );
}

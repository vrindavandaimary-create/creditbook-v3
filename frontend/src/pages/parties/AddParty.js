import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { partyAPI, categoryAPI } from '../../api';

export default function AddParty() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const initCat = sp.get('cat') || '';

  const [form, setForm] = useState({ name:'', categoryId:initCat, phone:'', email:'', address:'', notes:'' });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    categoryAPI.getAll().then(r => setCategories(r.data.data || [])).catch(()=>{});
  }, []);

  const set = k => e => setForm(f => ({...f, [k]: e.target.value}));

  const submit = async e => {
    e.preventDefault();
    if (!form.name.trim())    return toast.error('Name is required');
    if (!form.categoryId)     return toast.error('Please select a category');
    setLoading(true);
    try {
      const r = await partyAPI.create(form);
      toast.success('Party added!');
      navigate(`/parties/${r.data.data._id}`, { replace:true });
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh' }}>
      <div className="grad-blue" style={{ padding:'16px 16px 24px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={()=>navigate(-1)}>←</button>
          <h2 style={{ fontSize:18, fontWeight:800, margin:0 }}>Add Party</h2>
        </div>
        <p style={{ opacity:.7, fontSize:13, marginTop:4 }}>Add a person or business you deal with</p>
      </div>
      <form onSubmit={submit} style={{ padding:16 }}>
        <div className="field">
          <label>Category *</label>
          <select value={form.categoryId} onChange={set('categoryId')} style={{ fontSize:15, background:'transparent' }}>
            <option value="">Select category…</option>
            {categories.map(c => <option key={c._id} value={c._id}>{c.icon} {c.name}</option>)}
          </select>
        </div>
        <div className="field"><label>Name *</label><input placeholder="Full name or business name" value={form.name} onChange={set('name')} autoFocus/></div>
        <div className="field"><label>Phone</label><input type="tel" placeholder="Mobile number" value={form.phone} onChange={set('phone')} inputMode="numeric"/></div>
        <div className="field"><label>Email</label><input type="email" placeholder="Email (optional)" value={form.email} onChange={set('email')}/></div>
        <div className="field"><label>Address</label><input placeholder="Address (optional)" value={form.address} onChange={set('address')}/></div>
        <div className="field"><label>Notes</label><textarea rows={3} placeholder="Any notes…" value={form.notes} onChange={set('notes')}/></div>
        <button type="submit" className="btn btn-primary btn-full" style={{ padding:15, marginTop:6 }} disabled={loading}>
          {loading ? 'Adding…' : 'Add Party'}
        </button>
        {categories.length === 0 && (
          <p style={{ textAlign:'center', marginTop:14, fontSize:13, color:'var(--text3)' }}>
            No categories yet.{' '}
            <button type="button" onClick={()=>navigate('/')} style={{ color:'var(--blue)', fontWeight:700, background:'none', border:'none', cursor:'pointer', fontFamily:'inherit' }}>
              Go to Home to add one →
            </button>
          </p>
        )}
      </form>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', businessName: user?.businessName || '' });
  const [saving, setSaving] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const saveProfile = async e => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Name required');
    setSaving(true);
    try {
      const r = await authAPI.update(form);
      updateUser(r.data.user);
      toast.success('Profile updated!');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:80 }}>
      <div className="grad-blue" style={{ padding:'18px 16px 22px', color:'white' }}>
        <div className="hdr-row">
          <button className="back-btn" onClick={() => navigate(-1)}>←</button>
          <h2 style={{ fontSize:19, fontWeight:800, margin:0 }}>👤 Profile</h2>
        </div>
      </div>
      <div style={{ padding:'16px 14px 0' }}>
        <div className="card card-p" style={{ textAlign:'center', marginBottom:16 }}>
          <div style={{ width:58, height:58, borderRadius:'50%', background:'var(--blue)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, color:'white', fontWeight:800, margin:'0 auto 10px' }}>
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <h3 style={{ fontWeight:800 }}>{user?.name}</h3>
          <p style={{ color:'var(--text3)', fontSize:13, marginTop:4 }}>{user?.phone}</p>
        </div>

        <form onSubmit={saveProfile} style={{ marginBottom:16 }}>
          <div className="field"><label>Full Name</label><input value={form.name} onChange={set('name')} placeholder="Full Name" /></div>
          <div className="field"><label>Business Name</label><input value={form.businessName} onChange={set('businessName')} placeholder="Business Name" /></div>
          <button type="submit" className="btn btn-primary btn-full" disabled={saving} style={{ padding:14 }}>
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </form>

        <button onClick={() => { if (window.confirm('Logout?')) logout(); }}
          className="btn btn-full" style={{ background:'var(--red-lt)', color:'var(--red)', fontWeight:700, padding:14 }}>
          🚪 Logout
        </button>
      </div>
    </div>
  );
}

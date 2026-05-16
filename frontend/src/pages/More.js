import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function More() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const items = [
    { icon:'🧾', label:'Billing', desc:'Create & manage bills with receipts', path:'/more/billing' },
    { icon:'👤', label:'Profile', desc:'Update your account & business info', path:'/more/profile' },
  ];

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', paddingBottom:90 }}>
      <div className="grad-blue" style={{ padding:'20px 16px 24px', color:'white' }}>
        <h2 style={{ fontSize:20, fontWeight:800, margin:0 }}>More</h2>
        <p style={{ opacity:.7, fontSize:13, marginTop:4 }}>{user?.businessName || 'My Business'}</p>
      </div>
      <div style={{ padding:'16px 14px 0' }}>
        <div className="card" style={{ overflow:'hidden', marginBottom:20 }}>
          {items.map((item, i) => (
            <button key={item.path} onClick={() => navigate(item.path)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:14, padding:'16px 16px', background:'none', border:'none', cursor:'pointer', borderBottom: i<items.length-1?'1px solid var(--border)':'none', textAlign:'left' }}>
              <div style={{ width:42, height:42, borderRadius:12, background:'var(--blue-lt)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, flexShrink:0 }}>
                {item.icon}
              </div>
              <div style={{ flex:1 }}>
                <p style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{item.label}</p>
                <p style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>{item.desc}</p>
              </div>
              <span style={{ color:'var(--text4)', fontSize:20 }}>›</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => logout()}
          className="btn btn-full"
          style={{ background:'var(--red-lt)', color:'var(--red)', fontWeight:700, padding:14 }}>
          🚪 Logout
        </button>
        <p style={{ textAlign:'center', fontSize:11, color:'var(--text4)', marginTop:20 }}>CreditBook v3.0</p>
      </div>
    </div>
  );
}

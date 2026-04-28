import React, { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { authAPI } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const STEP = { PHONE: 'phone', OTP: 'otp' };

export default function Login() {
  const [step,      setStep]      = useState(STEP.PHONE);
  const [phone,     setPhone]     = useState('+91');
  const [otp,       setOtp]       = useState(['','','','','','']);
  const [loading,   setLoading]   = useState(false);
  const [countdown, setCountdown] = useState(0);
  const inputRefs = useRef([]);
  const { verifyOtp } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOTP = async () => {
    const cleaned = phone.trim();
    if (!/^\+\d{10,15}$/.test(cleaned))
      return toast.error('Enter phone with country code e.g. +91XXXXXXXXXX');
    setLoading(true);
    try {
      await authAPI.sendOtp(cleaned);
      setStep(STEP.OTP);
      setCountdown(30);
      toast.success('OTP sent! 📱');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally { setLoading(false); }
  };

  const verifyOTP = async () => {
    const code = otp.join('');
    if (code.length !== 6) return toast.error('Enter all 6 digits');
    setLoading(true);
    try {
      await verifyOtp(phone.trim(), code);
      toast.success('Welcome back! 👋');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally { setLoading(false); }
  };

  const handleOtpChange = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const next = [...otp]; next[i] = val; setOtp(next);
    if (val && i < 5) inputRefs.current[i + 1]?.focus();
  };
  const handleOtpKey = (i, e) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus();
  };
  const handleOtpPaste = (e) => {
    const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (p.length === 6) { setOtp(p.split('')); inputRefs.current[5]?.focus(); }
  };

  const btnStyle = (dis) => ({
    width:'100%', padding:'15px', borderRadius:50,
    background: dis ? 'var(--border)' : 'linear-gradient(135deg,#1a4fd6,#0e2a8a)',
    color:'white', fontSize:15, fontWeight:700, border:'none',
    cursor: dis ? 'not-allowed' : 'pointer',
    boxShadow: dis ? 'none' : '0 4px 20px rgba(26,79,214,.35)',
    transition:'all .2s', fontFamily:'inherit',
  });

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:'linear-gradient(160deg,#1a4fd6,#0e2a8a)' }}>
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'white', padding:'40px 24px 32px' }}>
        <div style={{ fontSize:56, marginBottom:10 }}>📒</div>
        <h1 style={{ fontSize:32, fontWeight:800, margin:0 }}>CreditBook</h1>
        <p style={{ opacity:.7, marginTop:8, fontSize:14 }}>Smart Business Ledger</p>
      </div>

      <div style={{ background:'white', borderRadius:'24px 24px 0 0', padding:'32px 24px 48px' }}>
        {step === STEP.PHONE ? (
          <>
            <h2 style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>Welcome back 👋</h2>
            <p style={{ fontSize:13, color:'var(--text3)', marginBottom:28 }}>Enter your phone number to login</p>
            <div className="field">
              <label>Phone Number</label>
              <input type="tel" placeholder="XXXXXXXXXX" value={phone}
                onChange={e => setPhone(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendOTP()}
                autoFocus autoComplete="tel" />
            </div>
            
            <button onClick={sendOTP} disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Sending OTP…' : '📲 Send OTP'}
            </button>
            <p style={{ textAlign:'center', marginTop:24, fontSize:14, color:'var(--text3)' }}>
              Don't have an account?{' '}
              <Link to="/register" style={{ color:'var(--blue)', fontWeight:700 }}>Create account</Link>
            </p>
          </>
        ) : (
          <>
            <button onClick={() => { setStep(STEP.PHONE); setOtp(['','','','','','']); }}
              style={{ background:'none', border:'none', color:'var(--blue)', fontWeight:700, fontSize:14, marginBottom:16, cursor:'pointer', padding:0 }}>
              ← Change number
            </button>
            <h2 style={{ fontSize:22, fontWeight:800, marginBottom:4 }}>Enter OTP 🔐</h2>
            <p style={{ fontSize:13, color:'var(--text3)', marginBottom:28 }}>Sent to <strong>{phone}</strong></p>
            <div style={{ display:'flex', gap:10, justifyContent:'center', marginBottom:28 }}>
              {otp.map((digit, i) => (
                <input key={i} ref={el => inputRefs.current[i] = el}
                  type="tel" maxLength={1} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKey(i, e)}
                  onPaste={handleOtpPaste}
                  style={{ width:46, height:54, textAlign:'center', fontSize:22, fontWeight:800,
                    border:`2px solid ${digit ? 'var(--blue)' : 'var(--border)'}`,
                    borderRadius:12, background: digit ? 'var(--blue-lt)' : 'var(--input-bg)',
                    color:'var(--text)', transition:'all .15s', fontFamily:'inherit' }} />
              ))}
            </div>
            <button onClick={verifyOTP} disabled={loading} style={btnStyle(loading)}>
              {loading ? 'Verifying…' : '✅ Verify & Login'}
            </button>
            <div style={{ textAlign:'center', marginTop:20 }}>
              {countdown > 0
                ? <p style={{ fontSize:13, color:'var(--text3)' }}>Resend in <strong>{countdown}s</strong></p>
                : <button onClick={sendOTP} disabled={loading}
                    style={{ background:'none', border:'none', color:'var(--blue)', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                    🔄 Resend OTP
                  </button>
              }
            </div>
          </>
        )}
      </div>
    </div>
  );
}

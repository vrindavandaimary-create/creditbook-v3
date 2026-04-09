import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../api';

/* ── Mini Chart ── */
function MiniChart({ chart }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !chart) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const W = canvas.width  = canvas.offsetWidth  * window.devicePixelRatio;
    const H = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    ctx.clearRect(0, 0, w, h);
    const labels = chart.labels || [], datasets = chart.datasets || [];
    const pad = { top:30, right:10, bottom:40, left:50 };
    const cw = w - pad.left - pad.right, ch = h - pad.top - pad.bottom;
    ctx.fillStyle = '#1a1d2e'; ctx.font = `bold ${Math.min(13,w/20)}px sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(chart.title||'', w/2, 18);
    if (chart.type === 'pie') {
      const data = datasets[0]?.data||[], colors = datasets[0]?.colors||['#1a4fd6','#1a9e5c','#e53935','#f57c00','#7b1fa2'];
      const total = data.reduce((s,v)=>s+v,0)||1, cx=w/2, cy=pad.top+ch/2, r=Math.min(cw,ch)/2-10;
      let start = -Math.PI/2;
      data.forEach((val,i) => {
        const slice = (val/total)*Math.PI*2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+slice); ctx.closePath();
        ctx.fillStyle = colors[i%colors.length]; ctx.fill();
        ctx.strokeStyle='#fff'; ctx.lineWidth=2; ctx.stroke();
        start += slice;
      });
      labels.forEach((lbl,i) => {
        const lx = pad.left + i * (cw/labels.length);
        ctx.fillStyle = colors[i%colors.length]; ctx.fillRect(lx, pad.top+ch+8, 10, 10);
        ctx.fillStyle='#4a5068'; ctx.font=`${Math.min(10,w/32)}px sans-serif`; ctx.textAlign='left';
        ctx.fillText(lbl, lx+13, pad.top+ch+17);
      });
      return;
    }
    const allVals = datasets.flatMap(d=>d.data||[]), maxVal=Math.max(...allVals,1), minVal=Math.min(...allVals,0), range=maxVal-minVal||1;
    ctx.strokeStyle='#e0e6f8'; ctx.lineWidth=1;
    [0,1,2,3,4].forEach(i => {
      const y = pad.top+(ch/4)*i;
      ctx.beginPath(); ctx.moveTo(pad.left,y); ctx.lineTo(pad.left+cw,y); ctx.stroke();
      const val = maxVal-(range/4)*i;
      ctx.fillStyle='#8a90b0'; ctx.font=`${Math.min(10,w/36)}px sans-serif`; ctx.textAlign='right';
      ctx.fillText(val>=1000?(val/1000).toFixed(1)+'k':Math.round(val), pad.left-4, y+4);
    });
    const bgw = cw/labels.length;
    if (chart.type === 'bar') {
      datasets.forEach((ds,di) => {
        ctx.fillStyle = ds.color||'#1a4fd6';
        const bw = (bgw*0.7)/datasets.length;
        ds.data.forEach((val,i) => {
          const barH = ((val-minVal)/range)*ch;
          const x = pad.left+i*bgw+(bgw*0.15)+di*bw;
          ctx.beginPath(); ctx.roundRect(x,pad.top+ch-barH,bw-2,barH,[4,4,0,0]); ctx.fill();
        });
      });
    }
    if (chart.type === 'line') {
      datasets.forEach(ds => {
        const pts = ds.data.map((val,i) => ({ x:pad.left+i*bgw+bgw/2, y:pad.top+ch-((val-minVal)/range)*ch }));
        ctx.beginPath(); ctx.moveTo(pts[0].x,pad.top+ch);
        pts.forEach(p=>ctx.lineTo(p.x,p.y)); ctx.lineTo(pts[pts.length-1].x,pad.top+ch); ctx.closePath();
        ctx.fillStyle=(ds.color||'#1a4fd6')+'22'; ctx.fill();
        ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.strokeStyle=ds.color||'#1a4fd6'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.stroke();
        pts.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,4,0,Math.PI*2); ctx.fillStyle='#fff'; ctx.fill(); ctx.strokeStyle=ds.color||'#1a4fd6'; ctx.lineWidth=2; ctx.stroke(); });
      });
    }
    labels.forEach((lbl,i) => {
      ctx.fillStyle='#4a5068'; ctx.font=`${Math.min(10,w/36)}px sans-serif`; ctx.textAlign='center';
      ctx.fillText(lbl.length>8?lbl.slice(0,7)+'…':lbl, pad.left+i*bgw+bgw/2, pad.top+ch+16);
    });
  }, [chart]);
  if (!chart) return null;
  return (
    <div style={{ background:'#f8faff', borderRadius:12, padding:'8px 6px 4px', marginTop:8, border:'1px solid #e0e6f8' }}>
      <canvas ref={canvasRef} style={{ width:'100%', height:chart.type==='pie'?170:150, display:'block' }}/>
    </div>
  );
}

/* ══════════════════════════════════
   MAIN CHATBOT — Draggable FAB
══════════════════════════════════ */
export default function ChatBot() {
  const navigate = useNavigate();

  /* ── Drag state ── */
  const [pos,     setPos]     = useState({ x: 12, y: 74 }); // right, bottom from viewport
  const dragging  = useRef(false);
  const hasDragged= useRef(false);
  const dragStart = useRef({ mx:0, my:0, px:0, py:0 });

  const onPointerDown = useCallback((e) => {
    dragging.current  = true;
    hasDragged.current = false;
    dragStart.current = { mx: e.clientX, my: e.clientY, px: pos.x, py: pos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [pos]);

  const onPointerMove = useCallback((e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) hasDragged.current = true;
    const newX = Math.max(4, dragStart.current.px - dx);
    const newY = Math.max(4, dragStart.current.py - dy);
    setPos({ x: newX, y: newY });
  }, []);

  const onPointerUp = useCallback(() => { dragging.current = false; }, []);

  /* ── Chat state ── */
  const [open,    setOpen]    = useState(false);
  const [msgs,    setMsgs]    = useState([
    { role:'assistant', content:"Hello! I'm CreditBot.\n\nAsk me about your balances, parties, trends, or say:\n• \"Show top debtors chart\"\n• \"Monthly trend graph\"\n• \"Add ₹500 to Rahul\"", ts: new Date() }
  ]);
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [unread,  setUnread]  = useState(0);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100); }
  }, [open, msgs]);

  const send = useCallback(async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');
    setMsgs(prev => [...prev, { role:'user', content:msg, ts:new Date() }]);
    setLoading(true);
    try {
      const history = msgs.slice(-12).map(m => ({ role:m.role, content:m.content }));
      const r = await chatAPI.send({ message:msg, history });
      const { reply, action, chart } = r.data.data;
      setMsgs(prev => [...prev, { role:'assistant', content:reply, chart, ts:new Date() }]);
      if (action?.refresh) {
        setTimeout(() => setMsgs(prev => [...prev, { role:'assistant', content:'Done! Refresh to see changes.', ts:new Date(), isHint:true }]), 600);
      }
      if (!open) setUnread(u => u+1);
    } catch {
      setMsgs(prev => [...prev, { role:'assistant', content:'Could not connect. Try again.', ts:new Date() }]);
    } finally { setLoading(false); }
  }, [input, loading, msgs, open]);

  const SUGGESTIONS = ['My balance?', 'Top debtors chart', 'Monthly trend', 'Who owes me most?'];
  const fmtTime = d => new Date(d).toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });

  /* Chat panel position: open above the FAB */
  const panelStyle = {
    position: 'fixed',
    bottom: pos.y + 60,
    right:  pos.x,
    width: 340,
    maxHeight: '65vh',
    ...(window.innerWidth <= 480 ? { right: 8, left: 8, width: 'auto' } : {}),
  };

  return (
    <>
      {/* Chat panel */}
      {open && (
        <div style={{
          ...panelStyle,
          background: 'white',
          borderRadius: 20,
          boxShadow: '0 8px 40px rgba(26,79,214,.25)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 400,
          border: '1.5px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ background:'linear-gradient(135deg,#1a4fd6,#0e2a8a)', padding:'12px 14px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
            <div style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>🤖</div>
            <div style={{ flex:1 }}>
              <p style={{ fontWeight:800, fontSize:14, color:'white', margin:0 }}>CreditBot AI</p>
              <p style={{ fontSize:10, color:'rgba(255,255,255,.7)', margin:0 }}>Smart Business Assistant</p>
            </div>
            <button onClick={() => setOpen(false)}
              style={{ background:'rgba(255,255,255,.2)', border:'none', color:'white', width:26, height:26, borderRadius:'50%', cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>×</button>
          </div>

          {/* Messages */}
          <div style={{ flex:1, overflowY:'auto', padding:'10px 12px', display:'flex', flexDirection:'column', gap:8 }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ display:'flex', flexDirection:'column', alignItems: m.role==='user'?'flex-end':'flex-start' }}>
                <div style={{
                  maxWidth:'92%', padding:'9px 13px',
                  borderRadius: m.role==='user'?'16px 16px 4px 16px':'16px 16px 16px 4px',
                  background: m.role==='user'?'linear-gradient(135deg,#1a4fd6,#0e2a8a)':m.isHint?'var(--green-lt)':'var(--bg)',
                  color: m.role==='user'?'white':'var(--text)',
                  fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap', wordBreak:'break-word',
                }}>
                  {m.content}
                  {m.chart && <MiniChart chart={m.chart}/>}
                </div>
                <p style={{ fontSize:10, color:'var(--text4)', marginTop:3 }}>{fmtTime(m.ts)}</p>
              </div>
            ))}
            {loading && (
              <div style={{ display:'flex' }}>
                <div style={{ background:'var(--bg)', borderRadius:'16px 16px 16px 4px', padding:'12px 16px', display:'flex', gap:5, alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text3)', marginRight:4 }}>Thinking</span>
                  {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'var(--blue)', animation:'dotBounce 1s infinite', animationDelay:`${i*.2}s` }}/>)}
                </div>
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          {/* Suggestions */}
          {msgs.length <= 2 && (
            <div style={{ padding:'4px 10px', display:'flex', gap:5, flexWrap:'wrap', flexShrink:0 }}>
              {SUGGESTIONS.map((s,i) => (
                <button key={i} onClick={() => send(s)}
                  style={{ background:'white', border:'1.5px solid var(--border)', borderRadius:50, padding:'5px 10px', fontSize:11, fontWeight:600, color:'var(--text2)', cursor:'pointer', fontFamily:'inherit', marginBottom:4 }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding:'8px 10px 10px', display:'flex', gap:7, borderTop:'1px solid var(--border)', flexShrink:0 }}>
            <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Ask about your business…"
              style={{ flex:1, border:'1.5px solid var(--border)', borderRadius:50, padding:'9px 14px', fontSize:13, background:'var(--bg)', fontFamily:'inherit' }}
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              style={{ width:38, height:38, borderRadius:'50%', border:'none',
                background: input.trim()?'linear-gradient(135deg,#1a4fd6,#0e2a8a)':'var(--border)',
                color:'white', cursor:input.trim()?'pointer':'default',
                fontSize:15, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              ➤
            </button>
          </div>
        </div>
      )}

      {/* ── Draggable FAB ── */}
      <div
        style={{
          position: 'fixed',
          bottom: pos.y,
          right:  pos.x,
          width: 50, height: 50,
          borderRadius: '50%',
          background: open ? 'var(--blue-dk)' : 'linear-gradient(135deg,#1a4fd6,#0e2a8a)',
          border: 'none',
          color: 'white',
          fontSize: 22,
          boxShadow: '0 4px 20px rgba(26,79,214,.45)',
          zIndex: 401,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          touchAction: 'none',
          userSelect: 'none',
          cursor: 'grab',
          transition: 'background .2s',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={() => { if (!hasDragged.current) setOpen(o => !o); }}
      >
        {open ? '✕' : '🤖'}
        {!open && unread > 0 && (
          <span style={{ position:'absolute', top:-3, right:-3, background:'var(--red)', color:'white', borderRadius:'50%', width:17, height:17, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>{unread}</span>
        )}
      </div>
    </>
  );
}

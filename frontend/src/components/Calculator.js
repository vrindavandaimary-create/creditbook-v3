import React, { useState, useCallback } from 'react';

export default function Calculator() {
  const [open,     setOpen]     = useState(false);
  const [display,  setDisplay]  = useState('0');
  const [expr,     setExpr]     = useState('');
  const [justEval, setJustEval] = useState(false);

  const press = useCallback((val) => {
    if (val === 'C')  { setDisplay('0'); setExpr(''); setJustEval(false); return; }
    if (val === '⌫')  {
      if (justEval) { setExpr(''); setJustEval(false); }
      setDisplay(p => p.length > 1 ? p.slice(0,-1) : '0');
      return;
    }
    if (val === '=') {
      try {
        const safe = (expr + display).replace(/×/g,'*').replace(/÷/g,'/').replace(/[^0-9+\-*/.()%]/g,'');
        // eslint-disable-next-line no-new-func
        const result = Function('"use strict";return (' + safe + ')')();
        const r = isFinite(result) ? String(parseFloat(result.toFixed(10))) : 'Error';
        setDisplay(r); setExpr(''); setJustEval(true);
      } catch { setDisplay('Error'); setExpr(''); setJustEval(true); }
      return;
    }
    if (['+','-','×','÷','%'].includes(val)) {
      setExpr(e => e + display + val); setDisplay('0'); setJustEval(false); return;
    }
    if (val === '.') {
      if (justEval) { setDisplay('0.'); setExpr(''); setJustEval(false); return; }
      if (!display.includes('.')) setDisplay(p => p + '.');
      return;
    }
    if (justEval) { setDisplay(val); setExpr(''); setJustEval(false); return; }
    setDisplay(p => p === '0' ? val : p + val);
  }, [display, expr, justEval]);

  const ROWS = [
    ['C','⌫','%','÷'],['7','8','9','×'],['4','5','6','-'],['1','2','3','+'],['0','.','','=']
  ];

  const btnStyle = v => ({
    flex: v==='0' ? 2 : 1, margin:3, padding:'13px 4px', borderRadius:12, fontSize:18,
    fontWeight: v==='='?800:600, fontFamily:'inherit', cursor:'pointer', border:'none', transition:'all .12s',
    background: v==='=' ? 'var(--blue)' : ['+','-','×','÷','%'].includes(v) ? 'var(--blue-lt)' :
      v==='C' ? '#ffe0e0' : v==='⌫' ? '#fff3e0' : 'white',
    color: v==='=' ? 'white' : ['+','-','×','÷','%'].includes(v) ? 'var(--blue)' :
      v==='C' ? 'var(--red)' : v==='⌫' ? '#e65100' : 'var(--text)',
    boxShadow:'0 1px 4px rgba(0,0,0,.06)',
  });

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        title="Calculator"
        style={{
          position:'fixed', top:14, right:14, zIndex:600,
          width:42, height:42, borderRadius:'50%',
          background: open ? 'var(--blue)' : 'white',
          border:'2px solid var(--border)',
          color: open ? 'white' : 'var(--blue)',
          fontSize:19, cursor:'pointer',
          boxShadow:'0 2px 12px rgba(26,79,214,.18)',
          display:'flex', alignItems:'center', justifyContent:'center',
          transition:'all .2s',
        }}
      >🧮</button>

      {open && (
        <div style={{
          position:'fixed', top:64, right:14, zIndex:599,
          width:278, background:'var(--bg)', borderRadius:20,
          boxShadow:'0 8px 40px rgba(26,79,214,.22)',
          border:'1.5px solid var(--border)', overflow:'hidden',
          animation:'calcSlideIn .18s ease',
        }}>
          <div className="grad-blue" style={{ padding:'14px 18px 10px', textAlign:'right' }}>
            <p style={{ color:'rgba(255,255,255,.5)', fontSize:12, minHeight:16, marginBottom:2, wordBreak:'break-all' }}>{expr}</p>
            <p style={{ color:'white', fontSize:30, fontWeight:800, wordBreak:'break-all', lineHeight:1.1 }}>{display}</p>
          </div>
          <div style={{ padding:'8px 6px 10px' }}>
            {ROWS.map((row, ri) => (
              <div key={ri} style={{ display:'flex' }}>
                {row.map((v, ci) => v === '' ? (
                  <div key={ci} style={{ flex:1, margin:3 }} />
                ) : (
                  <button key={ci} style={btnStyle(v)} onClick={() => press(v)}
                    onMouseDown={e => { e.currentTarget.style.transform='scale(.93)'; }}
                    onMouseUp={e => { e.currentTarget.style.transform='scale(1)'; }}>
                    {v}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

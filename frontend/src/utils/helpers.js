const COLORS = ['#1a4fd6','#e53935','#1a9e5c','#f57c00','#7b1fa2','#0097a7','#c62828','#283593','#558b2f','#ad1457'];
export const avatarColor  = (name='') => COLORS[name.charCodeAt(0) % COLORS.length];
export const avatarLetter = (name='') => (name?.[0] || '?').toUpperCase();
export const fmt  = (n=0,d=2) => Number(n).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d});
export const fmtDate     = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '';
export const fmtDateTime = d => d ? new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '';
export const todayStr    = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const balanceLabel = b => b > 0 ? 'to get' : b < 0 ? 'to give' : 'settled';
export const balanceClass = b => b > 0 ? 'amt-pos' : b < 0 ? 'amt-neg' : 'amt-zero';

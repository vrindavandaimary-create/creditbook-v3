import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

/* Register service worker for offline + caching */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => {
        console.log('[SW] Registered:', reg.scope);
        reg.onupdatefound = () => {
          const w = reg.installing;
          w.onstatechange = () => {
            if (w.state === 'installed' && navigator.serviceWorker.controller) {
              /* New version available — tell SW to skip waiting */
              w.postMessage({ type: 'SKIP_WAITING' });
              window.location.reload();
            }
          };
        };
      })
      .catch(e => console.warn('[SW] Registration failed:', e));
  });
}

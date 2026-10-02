import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service worker: only on the real site (production build, not inside a preview frame).
// Anywhere else, remove any old one so it can't serve stale files.
if ("serviceWorker" in navigator) {
  const inFrame = (() => { try { return window.self !== window.top; } catch { return true; } })();
  if (import.meta.env.PROD && !inFrame) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
    if ("caches" in window) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
  }
}

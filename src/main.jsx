import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { installChunkErrorReload } from './lib/chunkReload';

// The desktop build loads over file://, where the History API can't do real
// paths — use HashRouter there. The web keeps clean URLs with BrowserRouter.
const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

// Static pages from scripts/prerender.mjs carry the page's structured data for
// crawlers; the app adds its own (kept current on navigation), so drop these.
document.querySelectorAll('script[data-prerendered]').forEach((el) => el.remove());

// After a deploy, an open tab can ask for old chunk files — reload instead of failing.
installChunkErrorReload();

// The pre-rendered page loads the stylesheet without blocking its first paint
// (see scripts/prerender.mjs): don't take over the page before it's there.
function stylesheetReady() {
  const link = document.querySelector('link[data-fq-css]');
  if (!link || link.media !== 'print') return Promise.resolve();
  return new Promise((resolve) => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, 10000);
  });
}

// A link tapped on the pre-rendered page before the app was ready: open it now.
function takePendingTap() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('fq:goto') || 'null');
    sessionStorage.removeItem('fq:goto');
    if (saved && Date.now() - saved.at < 60000 && /^\/[\w\-/]*$/.test(saved.to) && saved.to !== window.location.pathname) {
      window.history.replaceState(null, '', saved.to);
    }
  } catch { /* storage blocked */ }
}

stylesheetReady().then(() => {
  takePendingTap();
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <Router>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Router>
    </StrictMode>,
  );
  window.__fqApp = true;
});

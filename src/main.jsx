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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Router>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </Router>
  </StrictMode>,
);

import React, { Suspense } from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BackToTop from './components/BackToTop';
import SupportToast from './components/SupportToast';
import CookieBanner from './components/CookieBanner';
import Analytics from './components/Analytics';
import { isDesktop } from './lib/desktop';
import { withChunkRetry } from './lib/chunkReload';
import AppRoutes from './routes';

// The desktop app's shell (sidebar, update bridge) never runs on the website,
// so it stays out of the bundle every web visitor downloads.
const DesktopShell = React.lazy(withChunkRetry(() => import('./components/desktop/DesktopShell')));

const App = () => {
  if (isDesktop()) return <Suspense fallback={null}><DesktopShell /></Suspense>;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <ScrollToTop />
      <Analytics />
      <Navigation />
      <main className="flex-grow container mx-auto overflow-x-clip px-4 py-8">
        <AppRoutes />
      </main>
      <Footer />
      <BackToTop />
      <SupportToast />
      <CookieBanner />
    </div>
  );
};

export default App;

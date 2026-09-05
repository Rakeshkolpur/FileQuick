import React from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BackToTop from './components/BackToTop';
import DesktopBridge from './components/DesktopBridge';
import DesktopShell from './components/desktop/DesktopShell';
import CookieBanner from './components/CookieBanner';
import Analytics from './components/Analytics';
import { isDesktop } from './lib/desktop';
import AppRoutes from './routes';

const App = () => {
  if (isDesktop()) return <DesktopShell />;

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
      <DesktopBridge />
      <CookieBanner />
    </div>
  );
};

export default App;

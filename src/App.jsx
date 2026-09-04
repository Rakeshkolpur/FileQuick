import React from 'react';
import './App.css';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';
import BackToTop from './components/BackToTop';
import DesktopBridge from './components/DesktopBridge';
import AppRoutes from './routes';

const App = () => (
  <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-300">
    <ScrollToTop />
    <Navigation />
    <main className="flex-grow container mx-auto overflow-x-clip px-4 py-8">
      <AppRoutes />
    </main>
    <Footer />
    <BackToTop />
    <DesktopBridge />
  </div>
);

export default App;

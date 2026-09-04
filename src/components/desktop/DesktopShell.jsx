import React from 'react';
import ScrollToTop from '../ScrollToTop';
import DesktopBridge from '../DesktopBridge';
import DesktopSidebar from './DesktopSidebar';
import AppRoutes from '../../routes';

/** The desktop app's own shell — a sidebar dashboard instead of the website's navbar/footer. */
const DesktopShell = () => (
  <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
    <ScrollToTop />
    <DesktopSidebar />
    <main className="flex-1 overflow-y-auto p-8">
      <AppRoutes />
    </main>
    <DesktopBridge />
  </div>
);

export default DesktopShell;

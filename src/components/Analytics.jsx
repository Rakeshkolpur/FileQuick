import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPageview } from '../lib/analytics';

/** Fires a GA4 page_view on every SPA route change (GA can't see these on its own). */
const Analytics = () => {
  const { pathname } = useLocation();
  useEffect(() => { trackPageview(pathname); }, [pathname]);
  return null;
};

export default Analytics;

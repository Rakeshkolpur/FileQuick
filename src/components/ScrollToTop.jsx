import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * SPA route changes don't reset the scroll position on their own. This jumps
 * back to the top whenever the path changes (e.g. picking a tool from the nav
 * while scrolled halfway down the page) so the visitor lands on the drop area.
 *
 * Browser Back/Forward keep their remembered scroll position — that's expected.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();
  const navType = useNavigationType(); // 'PUSH' | 'REPLACE' | 'POP'

  useEffect(() => {
    if (navType === 'POP') return; // let the browser restore Back/Forward scroll
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, left: 0, behavior: reduced ? 'auto' : 'smooth' });
  }, [pathname, navType]);

  return null;
};

export default ScrollToTop;

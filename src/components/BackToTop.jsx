import React, { useEffect, useState } from 'react';

/**
 * Floating "back to top" arrow — bottom-right, appears once the visitor has
 * scrolled down a screenful, smooth-scrolls to the top on click.
 */
const BackToTop = () => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const toTop = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label="Back to top"
      className={`fixed bottom-5 right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 transition-all duration-200 hover:bg-indigo-700 hover:-translate-y-0.5 dark:bg-indigo-500 dark:hover:bg-indigo-400 ${
        show ? 'opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
};

export default BackToTop;

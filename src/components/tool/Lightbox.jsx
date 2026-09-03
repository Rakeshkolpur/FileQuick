import React, { useEffect, useState } from 'react';

/**
 * A centred image popup (not full-screen). Click the backdrop, the ✕, or press
 * Esc to close. Click the image to toggle a 1:1 zoom. Reusable across tools.
 *
 * @param {string} src
 * @param {string} [alt]
 * @param {string} [caption]
 * @param {() => void} onClose
 */
const Lightbox = ({ src, alt = '', caption, onClose }) => {
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className={zoom ? 'max-h-[88vh] max-w-[92vw] overflow-auto' : ''} onClick={(e) => e.stopPropagation()}>
        <img
          src={src}
          alt={alt}
          onClick={() => setZoom((z) => !z)}
          className={`rounded-lg shadow-2xl ${
            zoom
              ? 'max-w-none cursor-zoom-out'
              : 'max-h-[82vh] max-w-[min(92vw,880px)] cursor-zoom-in object-contain'
          }`}
        />
      </div>

      {caption && <p className="mt-3 max-w-[880px] text-center text-[13px] text-white/75">{caption}</p>}
    </div>
  );
};

export default Lightbox;

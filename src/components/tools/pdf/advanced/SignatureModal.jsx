import React, { useEffect, useRef, useState } from 'react';
import { LuX, LuUpload } from 'react-icons/lu';

const INKS = ['#111827', '#1d4ed8', '#0f5132'];
const SCRIPTS = [
  { label: 'Script', family: '"Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive', style: 'normal' },
  { label: 'Handwriting', family: '"Lucida Handwriting", "Segoe Print", cursive', style: 'normal' },
  { label: 'Casual', family: '"Ink Free", "Segoe Print", "Comic Sans MS", cursive', style: 'normal' },
  { label: 'Formal', family: '"Times New Roman", Times, serif', style: 'italic' },
];

/** Crop a canvas to its non-transparent pixels (plus a little padding). */
function trim(canvas, pad = 6) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const d = ctx.getImageData(0, 0, width, height).data;
  let x0 = width; let y0 = height; let x1 = -1; let y1 = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (d[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return { src: out.toDataURL('image/png'), w: out.width, h: out.height };
}

const TabBtn = ({ on, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${on ? 'border-blue-600 text-blue-700 dark:text-blue-300' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
  >
    {children}
  </button>
);

/**
 * Create a signature by drawing, typing or uploading a picture of one.
 * Calls onDone({ src: pngDataUrl, w, h }) with a tightly-cropped,
 * transparent-background image.
 */
const SignatureModal = ({ initialTab = 'draw', onDone, onClose }) => {
  const [tab, setTab] = useState(initialTab);
  const [ink, setInk] = useState(INKS[0]);
  const [typed, setTyped] = useState('');
  const [script, setScript] = useState(0);
  const [upload, setUpload] = useState(null); // HTMLImageElement
  const [dropWhite, setDropWhite] = useState(true);
  const [empty, setEmpty] = useState(true);
  const padRef = useRef(null);
  const drawing = useRef(null);

  // Drawing pad, sized for the screen's pixel density.
  useEffect(() => {
    if (tab !== 'draw') return;
    const c = padRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setEmpty(true);
  }, [tab]);

  const pt = (e) => {
    const r = padRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    padRef.current.setPointerCapture(e.pointerId);
    drawing.current = pt(e);
  };
  const moveDraw = (e) => {
    if (!drawing.current) return;
    const p = pt(e);
    const ctx = padRef.current.getContext('2d');
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(drawing.current.x, drawing.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drawing.current = p;
    if (empty) setEmpty(false);
  };
  const up = () => { drawing.current = null; };
  const clearPad = () => {
    const c = padRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  const onFile = (f) => {
    if (!f || !f.type.startsWith('image/')) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { setUpload(img); URL.revokeObjectURL(url); };
    img.src = url;
  };

  const make = () => {
    if (tab === 'draw') return padRef.current ? trim(padRef.current) : null;
    if (tab === 'type') {
      if (!typed.trim()) return null;
      const s = SCRIPTS[script];
      const c = document.createElement('canvas');
      const size = 96;
      const ctx = c.getContext('2d');
      ctx.font = `${s.style} ${size}px ${s.family}`;
      c.width = Math.ceil(ctx.measureText(typed).width + size);
      c.height = Math.ceil(size * 1.8);
      ctx.font = `${s.style} ${size}px ${s.family}`;
      ctx.fillStyle = ink;
      ctx.textBaseline = 'middle';
      ctx.fillText(typed, size / 2, c.height / 2);
      return trim(c);
    }
    if (tab === 'upload' && upload) {
      const c = document.createElement('canvas');
      const k = Math.min(1, 1200 / upload.naturalWidth);
      c.width = Math.round(upload.naturalWidth * k);
      c.height = Math.round(upload.naturalHeight * k);
      const ctx = c.getContext('2d');
      ctx.drawImage(upload, 0, 0, c.width, c.height);
      if (dropWhite) {
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
          if (lum > 215) d[i + 3] = 0;
          else if (lum > 170) d[i + 3] = Math.round(d[i + 3] * ((215 - lum) / 45));
        }
        ctx.putImageData(id, 0, 0);
      }
      return trim(c, 2);
    }
    return null;
  };

  const ready = (tab === 'draw' && !empty) || (tab === 'type' && typed.trim()) || (tab === 'upload' && upload);

  return (
    <div data-fq-keep="" className="fixed inset-0 z-[100] grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 px-2 dark:border-gray-700">
          <div className="flex">
            <TabBtn on={tab === 'draw'} onClick={() => setTab('draw')}>Draw</TabBtn>
            <TabBtn on={tab === 'type'} onClick={() => setTab('type')}>Type</TabBtn>
            <TabBtn on={tab === 'upload'} onClick={() => setTab('upload')}>Upload</TabBtn>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          {tab !== 'upload' && (
            <div className="mb-3 flex items-center gap-2 text-xs text-gray-500">
              Ink
              {INKS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInk(c)}
                  className={`h-6 w-6 rounded-full border-2 ${ink === c ? 'border-blue-500' : 'border-white shadow'}`}
                  style={{ background: c }}
                  aria-label="Ink colour"
                />
              ))}
            </div>
          )}

          {tab === 'draw' && (
            <div>
              <canvas
                ref={padRef}
                className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-900"
                onPointerDown={down}
                onPointerMove={moveDraw}
                onPointerUp={up}
                onPointerCancel={up}
              />
              <div className="mt-2 flex justify-between text-xs text-gray-400">
                <span>Sign with your mouse, touchpad or finger</span>
                <button type="button" onClick={clearPad} className="font-semibold text-blue-600 hover:underline">Clear</button>
              </div>
            </div>
          )}

          {tab === 'type' && (
            <div>
              <input
                autoFocus
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder="Type your name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-white"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {SCRIPTS.map((s, i) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => setScript(i)}
                    className={`truncate rounded-xl border-2 px-3 py-3 text-2xl ${script === i ? 'border-blue-500 bg-blue-50 dark:bg-blue-500/10' : 'border-gray-200 dark:border-gray-700'}`}
                    style={{ fontFamily: s.family, fontStyle: s.style, color: ink }}
                  >
                    {typed || 'Your Name'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab === 'upload' && (
            <div>
              <label className="flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-sm text-gray-500 dark:border-gray-600 dark:bg-gray-900">
                {upload ? (
                  <img src={upload.src} alt="" className="max-h-36 max-w-full object-contain" />
                ) : (
                  <>
                    <LuUpload className="h-6 w-6" />
                    Choose a photo or scan of your signature
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              <label className="mt-2 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={dropWhite} onChange={(e) => setDropWhite(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                Remove the white paper background
              </label>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-600 dark:text-gray-200">
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => { const sig = make(); if (sig) onDone(sig); }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Insert signature
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;

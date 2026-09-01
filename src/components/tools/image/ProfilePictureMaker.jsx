import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import ResultScreen from '../../tool/ResultScreen';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes, stripExt } from '../../../lib/format';
import { cutoutBackground, preloadBackgroundModel } from '../../../lib/backgroundRemoval';

const PREVIEW = 360; // on-screen editor viewport (px)

const OUTPUT_SIZES = [
  { label: 'Standard · 1000px', px: 1000 },
  { label: 'WhatsApp · 640px', px: 640 },
  { label: 'Instagram · 320px', px: 320 },
  { label: 'Facebook · 720px', px: 720 },
  { label: 'X / Twitter · 400px', px: 400 },
  { label: 'LinkedIn · 400px', px: 400 },
  { label: 'YouTube · 800px', px: 800 },
  { label: 'Discord / Telegram · 512px', px: 512 },
];

const SOLIDS = [
  '#ffffff', '#f1f5f9', '#e2e8f0', '#94a3b8', '#475569', '#1e293b', '#000000',
  '#fee2e2', '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
];

const GRADIENTS = [
  ['#f97316', '#ef4444'], ['#f59e0b', '#f97316'], ['#facc15', '#f97316'],
  ['#84cc16', '#22c55e'], ['#22c55e', '#14b8a6'], ['#14b8a6', '#0ea5e9'],
  ['#3b82f6', '#6366f1'], ['#6366f1', '#8b5cf6'], ['#8b5cf6', '#ec4899'],
  ['#ec4899', '#f43f5e'], ['#fb7185', '#c084fc'], ['#0ea5e9', '#22d3ee'],
  ['#a3a3a3', '#525252'], ['#1e293b', '#475569'], ['#fde68a', '#fca5a5'],
  ['#c7d2fe', '#a5b4fc'],
];

const SHAPES = [
  { key: 'circle', label: 'Circle' },
  { key: 'rounded', label: 'Rounded' },
  { key: 'square', label: 'Square' },
];

const TABS = [
  { key: 'bg', label: 'Background' },
  { key: 'border', label: 'Border' },
  { key: 'shape', label: 'Shape' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const gradCss = ([a, b]) => `linear-gradient(135deg, ${a}, ${b})`;

function shapePath(ctx, S, shape, inset = 0) {
  const i = inset;
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(S / 2, S / 2, S / 2 - i, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    const r = Math.max(0, S * 0.18 - i);
    if (ctx.roundRect) ctx.roundRect(i, i, S - 2 * i, S - 2 * i, r);
    else ctx.rect(i, i, S - 2 * i, S - 2 * i);
  } else {
    ctx.rect(i, i, S - 2 * i, S - 2 * i);
  }
}

const ProfilePictureMaker = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [cutout, setCutout] = useState(null);
  const [cutoutUrl, setCutoutUrl] = useState(null);
  const loadTok = useRef(0);
  const urlsRef = useRef([]);

  const [removeBg, setRemoveBg] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const [tab, setTab] = useState('bg');
  const [bg, setBg] = useState({ type: 'solid', value: '#ffffff' }); // type: none | solid | gradient
  const [shape, setShape] = useState('circle');
  const [border, setBorder] = useState({ width: 0, color: '#ffffff' });

  const [scale, setScale] = useState(100);
  const [rotate, setRotate] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [sizeIdx, setSizeIdx] = useState(0);
  const [fmt, setFmt] = useState('png');

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const drag = useRef(null);
  const registerBack = useContext(ToolBackContext);

  useEffect(() => { preloadBackgroundModel(); }, []);

  const started = !!file || !!result;
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(started ? () => { if (result) setResult(null); else reset(); } : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, started, result]);

  const loadFromUrl = (url) => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Could not read this image.'));
    im.src = url;
  });

  const reset = () => {
    loadTok.current += 1;
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = [];
    setFile(null); setImg(null); setImgUrl(null); setCutout(null); setCutoutUrl(null);
    setResult(null); setError(null); setRemoveBg(false);
  };

  useEffect(() => () => urlsRef.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const handleFile = async (f) => {
    if (!f || !f.type.startsWith('image/')) { setError('Please choose an image file (JPG, PNG…).'); return; }
    const t = ++loadTok.current;
    setError(null); setResult(null); setFile(f);
    setRemoveBg(false); setCutout(null); setCutoutUrl(null);
    setScale(100); setRotate(0); setOffset({ x: 0, y: 0 });
    const url = URL.createObjectURL(f);
    urlsRef.current.push(url);
    try {
      const im = await loadFromUrl(url);
      if (t === loadTok.current) { setImg(im); setImgUrl(url); }
    } catch (e) {
      if (t === loadTok.current) setError(e.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let pending = null;
    try { pending = sessionStorage.getItem('pendingImageUpload'); if (pending) sessionStorage.removeItem('pendingImageUpload'); } catch (_) { /* ignore */ }
    if (!pending) return undefined;
    fetch(pending).then((r) => r.blob()).then((blob) => {
      if (cancelled) return;
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      handleFile(new File([blob], `photo.${ext}`, { type: blob.type }));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRemoveBg = async (on) => {
    setRemoveBg(on);
    setResult(null);
    if (!on || cutout || !file) return;
    setBgBusy(true); setBgProgress(0); setError(null);
    try {
      const png = await cutoutBackground(file, (p) => setBgProgress(p));
      const url = URL.createObjectURL(png);
      urlsRef.current.push(url);
      setCutout(await loadFromUrl(url));
      setCutoutUrl(url);
    } catch (_) {
      setError('Background removal failed — try a clearer, front-facing photo.');
      setRemoveBg(false);
    } finally {
      setBgBusy(false);
    }
  };

  const src = removeBg && cutout ? cutout : img;
  const srcUrl = removeBg && cutout ? cutoutUrl : imgUrl;

  // "cover" base scale so scale=100 fills the viewport
  const baseScale = useMemo(() => {
    if (!src) return 1;
    return Math.max(PREVIEW / src.naturalWidth, PREVIEW / src.naturalHeight);
  }, [src]);

  const showBg = bg.type !== 'none';

  // ---- drag to reposition ----
  const onPointerDown = (e) => {
    if (!src) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    setResult(null);
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    // limit so the image can't slide completely out of view
    const dw = src.naturalWidth * baseScale * (scale / 100);
    const dh = src.naturalHeight * baseScale * (scale / 100);
    const mx = Math.max(dw, PREVIEW);
    const my = Math.max(dh, PREVIEW);
    setOffset({ x: clamp(nx, -mx, mx), y: clamp(ny, -my, my) });
  };
  const onPointerUp = () => { drag.current = null; };

  const imgStyle = {
    width: src ? src.naturalWidth * baseScale : 0,
    height: src ? src.naturalHeight * baseScale : 0,
    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${scale / 100}) rotate(${rotate}deg)`,
  };

  const radiusCss = shape === 'circle' ? '9999px' : shape === 'rounded' ? '18%' : '14px';

  // ---- export ----
  const build = async () => {
    if (!src) return;
    setBusy(true); setError(null);
    try {
      const S = OUTPUT_SIZES[sizeIdx].px;
      const canvas = document.createElement('canvas');
      canvas.width = S;
      canvas.height = S;
      const ctx = canvas.getContext('2d');

      const k = S / PREVIEW;
      const drawScale = baseScale * (scale / 100) * k;
      const dw = src.naturalWidth * drawScale;
      const dh = src.naturalHeight * drawScale;

      // Clip to the shape FIRST so the corners of a circle / rounded square
      // stay transparent in the export.
      ctx.save();
      shapePath(ctx, S, shape);
      ctx.clip();

      if (bg.type === 'solid') {
        ctx.fillStyle = bg.value;
        ctx.fillRect(0, 0, S, S);
      } else if (bg.type === 'gradient') {
        const g = ctx.createLinearGradient(0, 0, S, S);
        g.addColorStop(0, bg.value[0]);
        g.addColorStop(1, bg.value[1]);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, S, S);
      }

      ctx.translate(S / 2 + offset.x * k, S / 2 + offset.y * k);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      if (border.width > 0) {
        const bw = border.width * k;
        ctx.save();
        shapePath(ctx, S, shape, bw / 2);
        ctx.lineWidth = bw;
        ctx.strokeStyle = border.color;
        ctx.stroke();
        ctx.restore();
      }

      const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
      let outCanvas = canvas;
      if (type === 'image/jpeg') {
        const flat = document.createElement('canvas');
        flat.width = S; flat.height = S;
        const fc = flat.getContext('2d');
        fc.fillStyle = '#ffffff';
        fc.fillRect(0, 0, S, S);
        fc.drawImage(canvas, 0, 0);
        outCanvas = flat;
      }
      const blob = await new Promise((res) => outCanvas.toBlob(res, type, 0.95));
      setResult({ blob, size: blob.size, px: S, type });
    } catch (e) {
      setError(e.message || 'Could not create the image.');
    } finally {
      setBusy(false);
    }
  };

  const ext = result?.type === 'image/jpeg' ? 'jpg' : 'png';
  const outName = file ? `${stripExt(file.name)}-profile-${result?.px || OUTPUT_SIZES[sizeIdx].px}.${ext}` : 'profile-picture.png';

  if (!file) {
    return (
      <div className="max-w-2xl mx-auto">
        <FileDropzone
          accept="image/*"
          onFiles={(fs) => handleFile(fs[0])}
          title="Drop a photo to start"
          hint="or click to browse — a selfie works great"
          formats="JPG · PNG · WebP"
        />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  if (busy || result) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 px-4 py-3">
        <ResultScreen
          working={busy}
          done={!!result}
          title="Your profile picture is ready"
          workingLabel="Rendering…"
          subtitle={result ? `${result.px} × ${result.px} px · ${formatBytes(result.size)}` : undefined}
          fileName={outName}
          fileSize={result?.size}
          onDownload={() => result && downloadBlob(result.blob, outName)}
          onBack={() => setResult(null)}
          backLabel="Back to editing"
        />
      </div>
    );
  }

  const swatchRing = (active) => `h-8 w-8 rounded-lg border-2 transition-transform ${active ? 'border-purple-600 scale-110' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      {/* ---- editor / preview ---- */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/40 p-5 flex flex-col items-center">
        <div className="flex w-full items-center justify-between mb-3 text-[13px]">
          <span className="truncate font-medium text-gray-900 dark:text-white">{file.name}</span>
          <button type="button" onClick={reset} className="shrink-0 px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
            Change photo
          </button>
        </div>

        <div
          className="relative bg-checkered"
          style={{
            width: PREVIEW, height: PREVIEW, borderRadius: radiusCss,
            boxShadow: border.width > 0 ? `0 0 0 ${border.width}px ${border.color}, 0 10px 30px rgba(0,0,0,.15)` : '0 10px 30px rgba(0,0,0,.15)',
          }}
        >
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: radiusCss }}>
            {showBg && (
              <div
                className="absolute inset-0"
                style={bg.type === 'gradient' ? { backgroundImage: gradCss(bg.value) } : { background: bg.value }}
              />
            )}
            {src && (
              <img
                src={srcUrl}
                alt=""
                draggable={false}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute left-1/2 top-1/2 max-w-none cursor-grab active:cursor-grabbing select-none touch-none"
                style={imgStyle}
              />
            )}
            {bgBusy && (
              <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-gray-900/70">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 border-4 border-t-purple-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Removing background… {Math.round(bgProgress * 100)}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* zoom + rotate */}
        <div className="w-full max-w-[380px] mt-5 space-y-3">
          <label className="flex items-center gap-3">
            <svg className="h-5 w-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            <input type="range" min={100} max={400} value={scale} onChange={(e) => { setScale(+e.target.value); setResult(null); }} className="w-full accent-purple-600" />
          </label>
          <label className="flex items-center gap-3">
            <svg className="h-5 w-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 10a8 8 0 00-14-4M4 14a8 8 0 0014 4" /></svg>
            <input type="range" min={-180} max={180} value={rotate} onChange={(e) => { setRotate(+e.target.value); setResult(null); }} className="w-full accent-purple-600" />
            {rotate !== 0 && <button type="button" onClick={() => setRotate(0)} className="text-[11px] text-gray-400 hover:text-gray-600 shrink-0">reset</button>}
          </label>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 text-center">Drag the photo to reposition it.</p>
        </div>
      </div>

      {/* ---- panel ---- */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
        <div className="p-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-gray-900 dark:text-white">Edit your profile pic</h2>
          <label className="flex items-center gap-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 select-none">
            Remove BG
            <span className="relative inline-flex">
              <input type="checkbox" checked={removeBg} disabled={bgBusy} onChange={(e) => toggleRemoveBg(e.target.checked)} className="peer sr-only" />
              <span className="h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        </div>

        <div className="px-4">
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-700/60 p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${
                  tab === t.key ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'bg' && (
            <>
              {!removeBg && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5">
                  Turn on <b>Remove BG</b> to see the background colour behind your photo.
                </p>
              )}
              <button
                type="button"
                onClick={() => { setBg({ type: 'none' }); setResult(null); }}
                className={`w-full text-[13px] py-1.5 rounded-lg border ${bg.type === 'none' ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}
              >
                No background (transparent)
              </button>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Solid colour</p>
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${swatchRing(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom colour">
                    <input type="color" onChange={(e) => { setBg({ type: 'solid', value: e.target.value }); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => { setBg({ type: 'solid', value: c }); setResult(null); }} className={swatchRing(bg.type === 'solid' && bg.value === c)} style={{ background: c }} />
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Gradient</p>
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENTS.map((g, i) => (
                    <button key={i} type="button" onClick={() => { setBg({ type: 'gradient', value: g }); setResult(null); }} className={swatchRing(bg.type === 'gradient' && bg.value[0] === g[0] && bg.value[1] === g[1])} style={{ backgroundImage: gradCss(g) }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'border' && (
            <>
              <label className="block">
                <span className="flex items-center justify-between text-[13px] font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Thickness <span className="text-purple-600 dark:text-purple-400 tabular-nums">{border.width}px</span>
                </span>
                <input type="range" min={0} max={24} value={border.width} onChange={(e) => { setBorder((b) => ({ ...b, width: +e.target.value })); setResult(null); }} className="w-full accent-purple-600" />
              </label>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Border colour</p>
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${swatchRing(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom colour">
                    <input type="color" onChange={(e) => { setBorder((b) => ({ ...b, color: e.target.value })); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => { setBorder((b) => ({ ...b, color: c })); setResult(null); }} className={swatchRing(border.color === c)} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'shape' && (
            <div className="grid grid-cols-3 gap-2">
              {SHAPES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => { setShape(s.key); setResult(null); }}
                  className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[12px] font-medium transition-colors ${
                    shape === s.key ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}
                >
                  <span
                    className="h-9 w-9 bg-gray-300 dark:bg-gray-600"
                    style={{ borderRadius: s.key === 'circle' ? '9999px' : s.key === 'rounded' ? '30%' : '4px' }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <select
              value={sizeIdx}
              onChange={(e) => { setSizeIdx(+e.target.value); setResult(null); }}
              className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[13px] p-2"
            >
              {OUTPUT_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-[12px] font-medium shrink-0">
              {['png', 'jpg'].map((f) => (
                <button key={f} type="button" onClick={() => { setFmt(f); setResult(null); }} className={`px-2.5 py-1 rounded-md ${fmt === f ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300' : 'text-gray-500'}`}>
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={build}
            disabled={!src || bgBusy}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureMaker;

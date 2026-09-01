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
  '#ffffff', '#f8fafc', '#e2e8f0', '#cbd5e1', '#94a3b8', '#64748b', '#334155', '#0f172a', '#000000',
  '#fecaca', '#fca5a5', '#ef4444', '#dc2626', '#b91c1c',
  '#fed7aa', '#fdba74', '#f97316', '#ea580c',
  '#fde68a', '#facc15', '#eab308',
  '#d9f99d', '#a3e635', '#65a30d',
  '#bbf7d0', '#4ade80', '#16a34a', '#059669',
  '#99f6e4', '#2dd4bf', '#0d9488',
  '#a5f3fc', '#22d3ee', '#0891b2',
  '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8',
  '#c7d2fe', '#818cf8', '#4f46e5',
  '#ddd6fe', '#a78bfa', '#7c3aed',
  '#f5d0fe', '#e879f9', '#c026d3',
  '#fbcfe8', '#f472b6', '#db2777',
  '#fecdd3', '#fb7185', '#e11d48',
];

const GRADIENTS = [
  ['#f97316', '#ef4444'], ['#f59e0b', '#f97316'], ['#facc15', '#f97316'], ['#fb7185', '#f43f5e'],
  ['#84cc16', '#22c55e'], ['#22c55e', '#14b8a6'], ['#14b8a6', '#0ea5e9'], ['#34d399', '#3b82f6'],
  ['#3b82f6', '#6366f1'], ['#6366f1', '#8b5cf6'], ['#8b5cf6', '#ec4899'], ['#0ea5e9', '#22d3ee'],
  ['#ec4899', '#8b5cf6'], ['#fb7185', '#c084fc'], ['#f9a8d4', '#c4b5fd'], ['#fda4af', '#fdba74'],
  ['#fde68a', '#fca5a5'], ['#c7d2fe', '#a5b4fc'], ['#a3a3a3', '#525252'], ['#0f172a', '#334155'],
  ['#fef9c3', '#bbf7d0'], ['#dbeafe', '#f5d0fe'], ['#fee2e2', '#e0e7ff'], ['#ecfccb', '#cffafe'],
];

// Repeating SVG-tile backgrounds (colour, texture, floral). tile = px per repeat.
const PATTERNS = [
  {
    key: 'confetti', name: 'Confetti', tile: 44,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='#eef2ff'/><g fill='none' stroke-width='3' stroke-linecap='round'><path d='M6 8l4 4' stroke='#f472b6'/><path d='M30 6l4-3' stroke='#38bdf8'/><path d='M38 26l-4 4' stroke='#facc15'/><path d='M12 32l3 4' stroke='#4ade80'/><path d='M24 20l3 3' stroke='#c084fc'/></g></svg>",
  },
  {
    key: 'dots', name: 'Polka', tile: 28,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><rect width='28' height='28' fill='#fef3c7'/><circle cx='7' cy='7' r='3' fill='#fbbf24'/><circle cx='21' cy='21' r='3' fill='#fbbf24'/></svg>",
  },
  {
    key: 'grid', name: 'Grid', tile: 32,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='#f1f5f9'/><path d='M32 0H0V32' fill='none' stroke='#cbd5e1' stroke-width='1.5'/></svg>",
  },
  {
    key: 'stripes', name: 'Stripes', tile: 24,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><rect width='24' height='24' fill='#ede9fe'/><path d='M-6 6l12-12M0 24L24 0M18 30l12-12' stroke='#c4b5fd' stroke-width='6'/></svg>",
  },
  {
    key: 'bokeh', name: 'Bokeh', tile: 80,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#0c4a6e'/><g fill='#38bdf8' opacity='.35'><circle cx='16' cy='20' r='10'/><circle cx='60' cy='14' r='6'/><circle cx='44' cy='52' r='14'/><circle cx='72' cy='66' r='8'/><circle cx='10' cy='64' r='5'/></g></svg>",
  },
  {
    key: 'floral-pink', name: 'Blossom', tile: 64,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='#fce7f3'/><g fill='#f9a8d4'><g transform='translate(16,16)'><circle r='3.2' fill='#fbbf24'/><ellipse cx='0' cy='-8' rx='4' ry='6'/><ellipse cx='0' cy='8' rx='4' ry='6'/><ellipse cx='-8' cy='0' rx='6' ry='4'/><ellipse cx='8' cy='0' rx='6' ry='4'/></g><g transform='translate(48,48)'><circle r='3.2' fill='#fbbf24'/><ellipse cx='0' cy='-8' rx='4' ry='6'/><ellipse cx='0' cy='8' rx='4' ry='6'/><ellipse cx='-8' cy='0' rx='6' ry='4'/><ellipse cx='8' cy='0' rx='6' ry='4'/></g></g></svg>",
  },
  {
    key: 'floral-blue', name: 'Meadow', tile: 60,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='60' height='60' fill='#ecfeff'/><g><g transform='translate(15,15) rotate(20)' fill='#a5b4fc'><ellipse rx='3.5' ry='7' cy='-6'/><ellipse rx='3.5' ry='7' cy='6'/><ellipse rx='7' ry='3.5' cx='-6'/><ellipse rx='7' ry='3.5' cx='6'/><circle r='3' fill='#fde047'/></g><g transform='translate(45,42) rotate(-15)' fill='#67e8f9'><ellipse rx='3.5' ry='7' cy='-6'/><ellipse rx='3.5' ry='7' cy='6'/><ellipse rx='7' ry='3.5' cx='-6'/><ellipse rx='7' ry='3.5' cx='6'/><circle r='3' fill='#fde047'/></g></g></svg>",
  },
  {
    key: 'leaves', name: 'Leaves', tile: 56,
    svg: "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><rect width='56' height='56' fill='#dcfce7'/><g fill='#86efac'><path d='M14 6c8 2 10 12 4 18-8-2-10-12-4-18z'/><path d='M42 32c8 2 10 12 4 18-8-2-10-12-4-18z'/></g></svg>",
  },
];

const BORDER_STYLES = [
  { key: 'solid', label: 'Solid' },
  { key: 'dashed', label: 'Dashed' },
  { key: 'dotted', label: 'Dotted' },
  { key: 'double', label: 'Double' },
  { key: 'glow', label: 'Glow' },
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
const patternUrl = (p) => `url("data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}")`;

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

function paintBg(ctx, S, bg, patImg) {
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.value;
    ctx.fillRect(0, 0, S, S);
  } else if (bg.type === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, bg.value[0]);
    g.addColorStop(1, bg.value[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  } else if (bg.type === 'pattern' && patImg) {
    const tiles = 6;
    const t = Math.ceil(S / tiles);
    for (let y = 0; y < S; y += t) {
      for (let x = 0; x < S; x += t) ctx.drawImage(patImg, x, y, t, t);
    }
  }
}

function drawBorder(ctx, S, shape, border, k) {
  if (!border.width) return;
  const bw = border.width * k;
  ctx.save();
  ctx.strokeStyle = border.color;
  ctx.lineJoin = 'round';
  if (border.style === 'double') {
    const seg = Math.max(1, bw * 0.34);
    const gap = bw * 0.4;
    ctx.lineWidth = seg;
    shapePath(ctx, S, shape, seg / 2); ctx.stroke();
    shapePath(ctx, S, shape, seg + gap + seg / 2); ctx.stroke();
  } else {
    ctx.lineWidth = bw;
    if (border.style === 'dashed') ctx.setLineDash([bw * 2.4, bw * 1.6]);
    else if (border.style === 'dotted') { ctx.setLineDash([0.01, bw * 2]); ctx.lineCap = 'round'; }
    else if (border.style === 'glow') { ctx.shadowColor = border.color; ctx.shadowBlur = bw * 2.6; }
    shapePath(ctx, S, shape, bw / 2);
    ctx.stroke();
    if (border.style === 'glow') { ctx.shadowBlur = 0; shapePath(ctx, S, shape, bw / 2); ctx.stroke(); }
  }
  ctx.restore();
}

const ProfilePictureMaker = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const [imgUrl, setImgUrl] = useState(null);
  const [cutout, setCutout] = useState(null);
  const [cutoutUrl, setCutoutUrl] = useState(null);
  const loadTok = useRef(0);
  const urlsRef = useRef([]);
  const patCache = useRef({});

  const [removeBg, setRemoveBg] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const [tab, setTab] = useState('bg');
  const [bgSub, setBgSub] = useState('color'); // color | gradient | pattern
  const [bg, setBg] = useState({ type: 'solid', value: '#ffffff' });
  const [shape, setShape] = useState('circle');
  const [border, setBorder] = useState({ width: 0, color: '#ffffff', style: 'solid' });
  const [cutCorners, setCutCorners] = useState(false); // false = fill the square

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

  const started = !!file || !!result;
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(started ? () => { if (result) setResult(null); else reset(); } : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, started, result]);

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

  const baseScale = useMemo(() => {
    if (!src) return 1;
    return Math.max(PREVIEW / src.naturalWidth, PREVIEW / src.naturalHeight);
  }, [src]);

  const pattern = bg.type === 'pattern' ? PATTERNS.find((p) => p.key === bg.value) : null;

  const patImgFor = async (p) => {
    if (patCache.current[p.key]) return patCache.current[p.key];
    const im = await loadFromUrl(`data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}`);
    patCache.current[p.key] = im;
    return im;
  };

  // ---- drag ----
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
  const bgLayerStyle = bg.type === 'gradient'
    ? { backgroundImage: gradCss(bg.value) }
    : bg.type === 'pattern' && pattern
      ? { backgroundImage: patternUrl(pattern), backgroundSize: `${(PREVIEW / 6).toFixed(1)}px` }
      : bg.type === 'solid' ? { background: bg.value } : null;

  // ---- preview border overlay ----
  const borderSvg = () => {
    if (!border.width) return null;
    const w = border.width;
    const common = { fill: 'none', stroke: border.color, strokeWidth: w };
    const dash = border.style === 'dashed' ? { strokeDasharray: `${w * 2.4} ${w * 1.6}` }
      : border.style === 'dotted' ? { strokeDasharray: `0.01 ${w * 2}`, strokeLinecap: 'round' } : {};
    const glow = border.style === 'glow' ? { filter: `drop-shadow(0 0 ${w * 1.6}px ${border.color})` } : {};
    const shapeEl = (inset, sw) => (shape === 'circle'
      ? <circle cx={PREVIEW / 2} cy={PREVIEW / 2} r={PREVIEW / 2 - inset} {...common} strokeWidth={sw ?? w} {...dash} />
      : <rect x={inset} y={inset} width={PREVIEW - 2 * inset} height={PREVIEW - 2 * inset} rx={shape === 'rounded' ? PREVIEW * 0.18 - inset : 14} {...common} strokeWidth={sw ?? w} {...dash} />);
    return (
      <svg width={PREVIEW} height={PREVIEW} className="absolute inset-0 pointer-events-none" style={glow}>
        {border.style === 'double'
          ? <>{shapeEl(w * 0.17, w * 0.34)}{shapeEl(w * 0.17 + w * 0.4 + w * 0.17, w * 0.34)}</>
          : shapeEl(w / 2)}
      </svg>
    );
  };

  // ---- export ----
  const build = async () => {
    if (!src) return;
    setBusy(true); setError(null);
    try {
      const S = OUTPUT_SIZES[sizeIdx].px;
      const canvas = document.createElement('canvas');
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';

      const patImg = pattern ? await patImgFor(pattern) : null;

      // fill the whole square unless the user asked to cut to the shape
      if (!cutCorners && bg.type !== 'none') paintBg(ctx, S, bg, patImg);

      const k = S / PREVIEW;
      const drawScale = baseScale * (scale / 100) * k;
      const dw = src.naturalWidth * drawScale;
      const dh = src.naturalHeight * drawScale;

      ctx.save();
      shapePath(ctx, S, shape);
      ctx.clip();
      if (bg.type !== 'none') paintBg(ctx, S, bg, patImg);
      ctx.translate(S / 2 + offset.x * k, S / 2 + offset.y * k);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      drawBorder(ctx, S, shape, border, k);

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
          note={cutCorners && ext === 'png'
            ? 'The corners are see-through, so it stays round on any app. Your photo viewer may show them white.'
            : 'The image stays on your device — nothing is uploaded.'}
        />
      </div>
    );
  }

  const ring = (active) => `h-8 w-8 rounded-lg border-2 transition-transform ${active ? 'border-purple-600 scale-110' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`;

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      {/* preview */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-900/40 p-5 flex flex-col items-center">
        <div className="flex w-full items-center justify-between mb-3 text-[13px]">
          <span className="truncate font-medium text-gray-900 dark:text-white">{file.name}</span>
          <button type="button" onClick={reset} className="shrink-0 px-2.5 py-1 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600">
            Change photo
          </button>
        </div>

        <div className="relative" style={{ width: PREVIEW, height: PREVIEW }}>
          {/* fills the square behind the shape */}
          {!cutCorners && bgLayerStyle && <div className="absolute inset-0" style={{ ...bgLayerStyle, borderRadius: shape === 'square' ? '14px' : 0 }} />}
          <div className="absolute inset-0 overflow-hidden bg-checkered" style={{ borderRadius: radiusCss }}>
            {bgLayerStyle && <div className="absolute inset-0" style={bgLayerStyle} />}
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
          {borderSvg()}
        </div>

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

      {/* panel */}
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
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 text-[13px] font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {tab === 'bg' && (
            <>
              {!removeBg && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5">
                  Turn on <b>Remove BG</b> to put your photo on the background you pick.
                </p>
              )}
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 text-[12px] font-medium">
                {[['color', 'Colour'], ['gradient', 'Gradient'], ['pattern', 'Texture']].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setBgSub(k)}
                    className={`flex-1 py-1 rounded-md ${bgSub === k ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>
              <button type="button" onClick={() => { setBg({ type: 'none' }); setResult(null); }}
                className={`w-full text-[12px] py-1.5 rounded-lg border ${bg.type === 'none' ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                No background (transparent)
              </button>

              {bgSub === 'color' && (
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${ring(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom colour">
                    <input type="color" onChange={(e) => { setBg({ type: 'solid', value: e.target.value }); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.map((c) => (
                    <button key={c} type="button" title={c} onClick={() => { setBg({ type: 'solid', value: c }); setResult(null); }} className={ring(bg.type === 'solid' && bg.value === c)} style={{ background: c }} />
                  ))}
                </div>
              )}
              {bgSub === 'gradient' && (
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENTS.map((g, i) => (
                    <button key={i} type="button" onClick={() => { setBg({ type: 'gradient', value: g }); setResult(null); }} className={ring(bg.type === 'gradient' && bg.value[0] === g[0] && bg.value[1] === g[1])} style={{ backgroundImage: gradCss(g) }} />
                  ))}
                </div>
              )}
              {bgSub === 'pattern' && (
                <div className="grid grid-cols-4 gap-2">
                  {PATTERNS.map((p) => (
                    <button key={p.key} type="button" title={p.name} onClick={() => { setBg({ type: 'pattern', value: p.key }); setResult(null); }}
                      className={`h-14 rounded-lg border-2 ${bg.type === 'pattern' && bg.value === p.key ? 'border-purple-600' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`}
                      style={{ backgroundImage: patternUrl(p), backgroundSize: `${p.tile}px` }} />
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'border' && (
            <>
              <div className="grid grid-cols-5 gap-1">
                {BORDER_STYLES.map((s) => (
                  <button key={s.key} type="button" onClick={() => { setBorder((b) => ({ ...b, style: s.key, width: b.width || 8 })); setResult(null); }}
                    className={`py-1.5 text-[11px] font-medium rounded-lg border ${border.style === s.key && border.width ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="flex items-center justify-between text-[13px] font-medium text-gray-700 dark:text-gray-200 mb-1.5">
                  Thickness <span className="text-purple-600 dark:text-purple-400 tabular-nums">{border.width}px</span>
                </span>
                <input type="range" min={0} max={28} value={border.width} onChange={(e) => { setBorder((b) => ({ ...b, width: +e.target.value })); setResult(null); }} className="w-full accent-purple-600" />
              </label>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Border colour</p>
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${ring(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom colour">
                    <input type="color" onChange={(e) => { setBorder((b) => ({ ...b, color: e.target.value })); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.filter((_, i) => i % 2 === 0).map((c) => (
                    <button key={c} type="button" title={c} onClick={() => { setBorder((b) => ({ ...b, color: c })); setResult(null); }} className={ring(border.color === c)} style={{ background: c }} />
                  ))}
                </div>
              </div>
            </>
          )}

          {tab === 'shape' && (
            <>
              <div className="grid grid-cols-3 gap-2">
                {SHAPES.map((s) => (
                  <button key={s.key} type="button" onClick={() => { setShape(s.key); setResult(null); }}
                    className={`flex flex-col items-center gap-2 py-3 rounded-xl border text-[12px] font-medium transition-colors ${shape === s.key ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    <span className="h-9 w-9 bg-gray-300 dark:bg-gray-600" style={{ borderRadius: s.key === 'circle' ? '9999px' : s.key === 'rounded' ? '30%' : '4px' }} />
                    {s.label}
                  </button>
                ))}
              </div>
              {shape !== 'square' && (
                <label className="flex items-start gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                  <input type="checkbox" checked={cutCorners} onChange={(e) => { setCutCorners(e.target.checked); setResult(null); }} className="mt-0.5 h-4 w-4 accent-purple-600" />
                  <span>
                    Cut to the shape (see-through corners)
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500">Off = a full square you can see; the shape still shows on WhatsApp / Instagram etc.</span>
                  </span>
                </label>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <select value={sizeIdx} onChange={(e) => { setSizeIdx(+e.target.value); setResult(null); }}
              className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[13px] p-2">
              {OUTPUT_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-[12px] font-medium shrink-0">
              {['png', 'jpg'].map((f) => (
                <button key={f} type="button" onClick={() => { setFmt(f); setResult(null); }} className={`px-2.5 py-1 rounded-md ${fmt === f ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300' : 'text-gray-500'}`}>{f.toUpperCase()}</button>
              ))}
            </div>
          </div>
          <button type="button" onClick={build} disabled={!src || bgBusy}
            className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-95 disabled:opacity-50 transition-opacity">
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePictureMaker;

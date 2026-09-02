import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import ResultScreen from '../../tool/ResultScreen';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes, stripExt } from '../../../lib/format';
import { cutoutBackground, preloadBackgroundModel } from '../../../lib/backgroundRemoval';

const PREVIEW = 360;

const OUTPUT_SIZES = [
  { label: 'Standard · 1000px', px: 1000 },
  { label: 'HD · 1600px', px: 1600 },
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
  '#fecaca', '#fca5a5', '#ef4444', '#dc2626', '#fed7aa', '#fdba74', '#f97316', '#ea580c',
  '#fde68a', '#facc15', '#eab308', '#d9f99d', '#a3e635', '#65a30d', '#bbf7d0', '#4ade80', '#16a34a',
  '#99f6e4', '#2dd4bf', '#0d9488', '#a5f3fc', '#22d3ee', '#0891b2', '#bfdbfe', '#60a5fa', '#2563eb',
  '#c7d2fe', '#818cf8', '#4f46e5', '#ddd6fe', '#a78bfa', '#7c3aed', '#f5d0fe', '#e879f9', '#c026d3',
  '#fbcfe8', '#f472b6', '#db2777', '#fecdd3', '#fb7185', '#e11d48',
];

const GRADIENTS = [
  ['#f97316', '#ef4444'], ['#f59e0b', '#f97316'], ['#facc15', '#f97316'], ['#fb7185', '#f43f5e'],
  ['#84cc16', '#22c55e'], ['#22c55e', '#14b8a6'], ['#14b8a6', '#0ea5e9'], ['#34d399', '#3b82f6'],
  ['#3b82f6', '#6366f1'], ['#6366f1', '#8b5cf6'], ['#8b5cf6', '#ec4899'], ['#0ea5e9', '#22d3ee'],
  ['#ec4899', '#8b5cf6'], ['#fb7185', '#c084fc'], ['#f9a8d4', '#c4b5fd'], ['#fda4af', '#fdba74'],
  ['#fde68a', '#fca5a5'], ['#c7d2fe', '#a5b4fc'], ['#a3a3a3', '#525252'], ['#0f172a', '#334155'],
  ['#fef9c3', '#bbf7d0'], ['#dbeafe', '#f5d0fe'], ['#fee2e2', '#e0e7ff'], ['#ecfccb', '#cffafe'],
];

const PATTERNS = [
  { key: 'confetti', name: 'Confetti', tile: 44, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44'><rect width='44' height='44' fill='#eef2ff'/><g fill='none' stroke-width='3' stroke-linecap='round'><path d='M6 8l4 4' stroke='#f472b6'/><path d='M30 6l4-3' stroke='#38bdf8'/><path d='M38 26l-4 4' stroke='#facc15'/><path d='M12 32l3 4' stroke='#4ade80'/><path d='M24 20l3 3' stroke='#c084fc'/></g></svg>" },
  { key: 'dots', name: 'Polka', tile: 28, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'><rect width='28' height='28' fill='#fef3c7'/><circle cx='7' cy='7' r='3' fill='#fbbf24'/><circle cx='21' cy='21' r='3' fill='#fbbf24'/></svg>" },
  { key: 'grid', name: 'Grid', tile: 32, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='32' height='32'><rect width='32' height='32' fill='#f1f5f9'/><path d='M32 0H0V32' fill='none' stroke='#cbd5e1' stroke-width='1.5'/></svg>" },
  { key: 'stripes', name: 'Stripes', tile: 24, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><rect width='24' height='24' fill='#ede9fe'/><path d='M-6 6l12-12M0 24L24 0M18 30l12-12' stroke='#c4b5fd' stroke-width='6'/></svg>" },
  { key: 'bokeh', name: 'Bokeh', tile: 80, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='80' height='80' fill='#0c4a6e'/><g fill='#38bdf8' opacity='.35'><circle cx='16' cy='20' r='10'/><circle cx='60' cy='14' r='6'/><circle cx='44' cy='52' r='14'/><circle cx='72' cy='66' r='8'/><circle cx='10' cy='64' r='5'/></g></svg>" },
  { key: 'floral-pink', name: 'Blossom', tile: 64, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='#fce7f3'/><g fill='#f9a8d4'><g transform='translate(16,16)'><circle r='3.2' fill='#fbbf24'/><ellipse cx='0' cy='-8' rx='4' ry='6'/><ellipse cx='0' cy='8' rx='4' ry='6'/><ellipse cx='-8' cy='0' rx='6' ry='4'/><ellipse cx='8' cy='0' rx='6' ry='4'/></g><g transform='translate(48,48)'><circle r='3.2' fill='#fbbf24'/><ellipse cx='0' cy='-8' rx='4' ry='6'/><ellipse cx='0' cy='8' rx='4' ry='6'/><ellipse cx='-8' cy='0' rx='6' ry='4'/><ellipse cx='8' cy='0' rx='6' ry='4'/></g></g></svg>" },
  { key: 'floral-blue', name: 'Meadow', tile: 60, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='60' height='60' fill='#ecfeff'/><g><g transform='translate(15,15) rotate(20)' fill='#a5b4fc'><ellipse rx='3.5' ry='7' cy='-6'/><ellipse rx='3.5' ry='7' cy='6'/><ellipse rx='7' ry='3.5' cx='-6'/><ellipse rx='7' ry='3.5' cx='6'/><circle r='3' fill='#fde047'/></g><g transform='translate(45,42) rotate(-15)' fill='#67e8f9'><ellipse rx='3.5' ry='7' cy='-6'/><ellipse rx='3.5' ry='7' cy='6'/><ellipse rx='7' ry='3.5' cx='-6'/><ellipse rx='7' ry='3.5' cx='6'/><circle r='3' fill='#fde047'/></g></g></svg>" },
  { key: 'leaves', name: 'Leaves', tile: 56, svg: "<svg xmlns='http://www.w3.org/2000/svg' width='56' height='56'><rect width='56' height='56' fill='#dcfce7'/><g fill='#86efac'><path d='M14 6c8 2 10 12 4 18-8-2-10-12-4-18z'/><path d='M42 32c8 2 10 12 4 18-8-2-10-12-4-18z'/></g></svg>" },
];

// ---- photo effects ----
const EFFECTS = [
  { key: 'none', name: 'None', filter: '' },
  { key: 'noir', name: 'Noir', filter: 'grayscale(1) contrast(1.4) brightness(.93)' },
  { key: 'mono', name: 'B&W', filter: 'grayscale(1) contrast(1.08)' },
  { key: 'sepia', name: 'Sepia', filter: 'sepia(.75) contrast(1.04) brightness(1.05)' },
  { key: 'warm', name: 'Warm', filter: 'sepia(.32) saturate(1.35) brightness(1.03)' },
  { key: 'cool', name: 'Cool', filter: 'saturate(1.1) hue-rotate(12deg) brightness(1.03)' },
  { key: 'vivid', name: 'Vivid', filter: 'saturate(1.7) contrast(1.12)' },
  { key: 'fade', name: 'Fade', filter: 'contrast(.82) brightness(1.12) saturate(.8)' },
  { key: 'drama', name: 'Drama', filter: 'contrast(1.45) brightness(.9) saturate(1.15)' },
  { key: 'clarity', name: 'Clarity', filter: 'contrast(1.18) saturate(1.12) brightness(1.02)' },
  { key: 'soft', name: 'Soft', filter: 'blur(1px) brightness(1.05) saturate(1.05)' },
  { key: 'duotone-violet', name: 'Duotone', filter: 'grayscale(1) contrast(1.1)', duotone: ['#f0abfc', '#4c1d95'] },
  { key: 'duotone-teal', name: 'Ocean', filter: 'grayscale(1) contrast(1.1)', duotone: ['#a7f3d0', '#0c4a6e'] },
  { key: 'vignette', name: 'Vignette', filter: '', overlay: 'vignette' },
  { key: 'grain', name: 'Grain', filter: 'contrast(1.05)', overlay: 'grain' },
  { key: 'scan', name: 'Scanlines', filter: 'contrast(1.05) saturate(1.1)', overlay: 'scan' },
];

// ---- border frames (SVG, viewBox 120) ----
const PETAL = (c) => `<g fill='${c}'><ellipse cy='-7' rx='3.6' ry='6.4'/><ellipse cy='7' rx='3.6' ry='6.4'/><ellipse cx='-7' rx='6.4' ry='3.6'/><ellipse cx='7' rx='6.4' ry='3.6'/><circle r='2.6' fill='#fde047'/></g>`;
const LEAF = (c) => `<path fill='${c}' d='M0 -10c6 2 8 9 3 15-6-2-8-9-3-15z'/>`;
const HEART = (c) => `<path fill='${c}' d='M0 6C-6 0 -9 -4 -6 -8c2 -3 5 -2 6 1c1 -3 4 -4 6 -1c3 4 0 8 -6 14z'/>`;
const STAR = (c) => `<path fill='${c}' d='M0 -10L2.9 -3.1 10 -3.1 4.3 1.4 6.5 8.2 0 4 -6.5 8.2 -4.3 1.4 -10 -3.1 -2.9 -3.1z' transform='scale(.85)'/>`;
const SPARK = (c, s = 1) => `<path fill='${c}' d='M0 -9C1 -3 3 -1 9 0 3 1 1 3 0 9 -1 3 -3 1 -9 0 -3 -1 -1 -3 0 -9z' transform='scale(${s})'/>`;

function ring(n, item, r, box = 120) {
  let g = '';
  for (let i = 0; i < n; i += 1) g += `<g transform='rotate(${(i * 360) / n}) translate(0 -${r})'>${item(i)}</g>`;
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${box} ${box}'><g transform='translate(${box / 2} ${box / 2})'>${g}</g></svg>`;
}
function svgWrap(inner, box = 120, defs = '') {
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${box} ${box}'>${defs}<g transform='translate(${box / 2} ${box / 2})'>${inner}</g></svg>`;
}

const FRAMES = [
  { key: 'bloom-pink', name: 'Bloom', svg: () => ring(11, () => PETAL('#f9a8d4'), 54) },
  { key: 'bloom-rain', name: 'Garden', svg: () => ring(12, (i) => PETAL(['#f9a8d4', '#a5b4fc', '#fca5a5', '#fde047', '#86efac', '#67e8f9'][i % 6]), 54) },
  { key: 'bloom-blue', name: 'Bluebell', svg: () => ring(11, () => PETAL('#93c5fd'), 54) },
  { key: 'leaves', name: 'Vine', svg: () => ring(16, (i) => `<g transform='rotate(${i % 2 ? 18 : -18})'>${LEAF(i % 2 ? '#4ade80' : '#22c55e')}</g>`, 55) },
  { key: 'hearts', name: 'Hearts', svg: (c) => ring(12, () => HEART(c || '#fb7185'), 54) },
  { key: 'stars', name: 'Stars', svg: (c) => ring(12, () => STAR(c || '#fbbf24'), 54) },
  { key: 'sparkle', name: 'Sparkle', svg: (c) => ring(18, (i) => SPARK(c || '#fde047', i % 3 ? 0.7 : 1.1), 55) },
  { key: 'dots', name: 'Dots', svg: (c) => ring(28, () => `<circle r='3.4' fill='${c || '#64748b'}'/>`, 55) },
  { key: 'beads', name: 'Pearls', svg: () => ring(24, () => `<circle r='4.2' fill='#e2e8f0'/><circle r='1.6' cx='-1.3' cy='-1.3' fill='#fff'/>`, 55) },
  { key: 'ticks', name: 'Ticks', svg: (c) => ring(36, () => `<rect x='-1' y='-6' width='2' height='12' rx='1' fill='${c || '#334155'}'/>`, 55) },
  { key: 'dash', name: 'Dashes', svg: (c) => ring(20, () => `<rect x='-2.2' y='-7' width='4.4' height='14' rx='2.2' fill='${c || '#0ea5e9'}'/>`, 55) },
  { key: 'zig', name: 'Zigzag', svg: (c) => ring(1, () => `<path d='${zigPath(55, 40)}' fill='none' stroke='${c || '#8b5cf6'}' stroke-width='3' stroke-linejoin='round'/>`, 0) },
  { key: 'sun', name: 'Sunburst', svg: (c) => ring(28, () => `<path d='M-2.4 -50L2.4 -50 0 -58z' fill='${c || '#f59e0b'}'/>`, 0) },
  { key: 'gold', name: 'Gold ring', svg: () => svgWrap(`<circle r='52' fill='none' stroke='url(#g)' stroke-width='7'/>`, 120, `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fde68a'/><stop offset='.5' stop-color='#d97706'/><stop offset='1' stop-color='#fbbf24'/></linearGradient></defs>`) },
  { key: 'silver', name: 'Silver ring', svg: () => svgWrap(`<circle r='52' fill='none' stroke='url(#s)' stroke-width='7'/>`, 120, `<defs><linearGradient id='s' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f1f5f9'/><stop offset='.5' stop-color='#64748b'/><stop offset='1' stop-color='#e2e8f0'/></linearGradient></defs>`) },
  { key: 'neon-pink', name: 'Neon', svg: () => svgWrap(`<circle r='51' fill='none' stroke='#f472b6' stroke-width='4' filter='url(#b)'/><circle r='51' fill='none' stroke='#fbcfe8' stroke-width='1.6'/>`, 120, `<defs><filter id='b' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='3'/></filter></defs>`) },
  { key: 'neon-cyan', name: 'Cyber', svg: () => svgWrap(`<circle r='51' fill='none' stroke='#22d3ee' stroke-width='4' filter='url(#c)'/><circle r='51' fill='none' stroke='#cffafe' stroke-width='1.6'/>`, 120, `<defs><filter id='c' x='-30%' y='-30%' width='160%' height='160%'><feGaussianBlur stdDeviation='3'/></filter></defs>`) },
  { key: 'rope', name: 'Rope', svg: (c) => svgWrap(`<circle r='52' fill='none' stroke='${c || '#a16207'}' stroke-width='7' stroke-dasharray='9 4' stroke-linecap='round'/>`, 120) },
];

function zigPath(r, points) {
  let d = '';
  for (let i = 0; i <= points; i += 1) {
    const a = (i / points) * Math.PI * 2;
    const rr = r + (i % 2 ? 5 : -5);
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return `${d}Z`;
}

const LINE_STYLES = [
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
  { key: 'fx', label: 'Effects' },
  { key: 'border', label: 'Border' },
  { key: 'shape', label: 'Shape' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const gradCss = ([a, b]) => `linear-gradient(135deg, ${a}, ${b})`;
const patternUrl = (p) => `url("data:image/svg+xml;utf8,${encodeURIComponent(p.svg)}")`;
const svgUrl = (s) => `data:image/svg+xml;utf8,${encodeURIComponent(s)}`;

let _noise;
function noiseCanvas() {
  if (_noise) return _noise;
  const n = document.createElement('canvas');
  n.width = 128; n.height = 128;
  const d = n.getContext('2d').createImageData(128, 128);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 120 + Math.random() * 135;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  n.getContext('2d').putImageData(d, 0, 0);
  _noise = n;
  return n;
}

function shapePath(ctx, S, shape, inset = 0) {
  const i = inset;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(S / 2, S / 2, S / 2 - i, 0, Math.PI * 2);
  else if (shape === 'rounded') {
    const r = Math.max(0, S * 0.18 - i);
    if (ctx.roundRect) ctx.roundRect(i, i, S - 2 * i, S - 2 * i, r);
    else ctx.rect(i, i, S - 2 * i, S - 2 * i);
  } else ctx.rect(i, i, S - 2 * i, S - 2 * i);
}

function paintBg(ctx, S, bg, patImg) {
  if (bg.type === 'solid') { ctx.fillStyle = bg.value; ctx.fillRect(0, 0, S, S); }
  else if (bg.type === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, bg.value[0]); g.addColorStop(1, bg.value[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (bg.type === 'pattern' && patImg) {
    const t = Math.ceil(S / 6);
    for (let y = 0; y < S; y += t) for (let x = 0; x < S; x += t) ctx.drawImage(patImg, x, y, t, t);
  }
}

function applyOverlay(ctx, S, kind) {
  ctx.save();
  if (kind === 'vignette') {
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.32, S / 2, S / 2, S * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  } else if (kind === 'grain') {
    ctx.globalAlpha = 0.09; ctx.globalCompositeOperation = 'overlay';
    const n = noiseCanvas();
    for (let y = 0; y < S; y += 128) for (let x = 0; x < S; x += 128) ctx.drawImage(n, x, y);
  } else if (kind === 'scan') {
    ctx.fillStyle = 'rgba(0,0,0,.16)';
    for (let y = 0; y < S; y += 3) ctx.fillRect(0, y, S, 1);
  }
  ctx.restore();
}

function applyDuotone(ctx, S, [light, dark]) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = light; ctx.fillRect(0, 0, S, S);
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = dark; ctx.fillRect(0, 0, S, S);
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
  const imgCache = useRef({});

  const [removeBg, setRemoveBg] = useState(false);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const [tab, setTab] = useState('bg');
  const [bgSub, setBgSub] = useState('color');
  const [bg, setBg] = useState({ type: 'solid', value: '#ffffff' });
  const [shape, setShape] = useState('circle');
  const [effect, setEffect] = useState('none');
  const [adjust, setAdjust] = useState({ b: 100, c: 100, s: 100 });
  const [border, setBorder] = useState({ kind: 'line', style: 'solid', color: '#334155', width: 0, frame: null });
  const [squareBg, setSquareBg] = useState(false);
  const [flip, setFlip] = useState(false);

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
  const cachedImg = async (key, url) => {
    if (imgCache.current[key]) return imgCache.current[key];
    const im = await loadFromUrl(url);
    imgCache.current[key] = im;
    return im;
  };

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
    setScale(100); setRotate(0); setOffset({ x: 0, y: 0 }); setFlip(false);
    setEffect('none'); setAdjust({ b: 100, c: 100, s: 100 });
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
    setRemoveBg(on); setResult(null);
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
    } finally { setBgBusy(false); }
  };

  const src = removeBg && cutout ? cutout : img;
  const srcUrl = removeBg && cutout ? cutoutUrl : imgUrl;
  const baseScale = useMemo(() => (src ? Math.max(PREVIEW / src.naturalWidth, PREVIEW / src.naturalHeight) : 1), [src]);
  const pattern = bg.type === 'pattern' ? PATTERNS.find((p) => p.key === bg.value) : null;
  const eff = EFFECTS.find((e) => e.key === effect) || EFFECTS[0];
  const frame = border.kind === 'frame' ? FRAMES.find((f) => f.key === border.frame) : null;

  const filterStr = `${eff.filter} brightness(${adjust.b / 100}) contrast(${adjust.c / 100}) saturate(${adjust.s / 100})`.trim();

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
    setOffset({ x: clamp(nx, -Math.max(dw, PREVIEW), Math.max(dw, PREVIEW)), y: clamp(ny, -Math.max(dh, PREVIEW), Math.max(dh, PREVIEW)) });
  };
  const onPointerUp = () => { drag.current = null; };

  const imgStyle = {
    width: src ? src.naturalWidth * baseScale : 0,
    height: src ? src.naturalHeight * baseScale : 0,
    transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${(scale / 100) * (flip ? -1 : 1)}, ${scale / 100}) rotate(${rotate}deg)`,
    filter: filterStr,
  };
  const radiusCss = shape === 'circle' ? '9999px' : shape === 'rounded' ? '18%' : '14px';
  const bgLayerStyle = bg.type === 'gradient' ? { backgroundImage: gradCss(bg.value) }
    : bg.type === 'pattern' && pattern ? { backgroundImage: patternUrl(pattern), backgroundSize: `${(PREVIEW / 6).toFixed(1)}px` }
      : bg.type === 'solid' ? { background: bg.value } : null;

  // preview border overlay
  const borderOverlay = () => {
    if (border.kind === 'frame' && frame) {
      return <img src={svgUrl(frame.svg(border.color))} alt="" className="absolute pointer-events-none" style={{ left: '50%', top: '50%', width: PREVIEW * 1.13, height: PREVIEW * 1.13, transform: 'translate(-50%,-50%)' }} />;
    }
    if (border.kind !== 'line' || !border.width) return null;
    const w = border.width;
    const common = { fill: 'none', stroke: border.color, strokeWidth: w };
    const dash = border.style === 'dashed' ? { strokeDasharray: `${w * 2.4} ${w * 1.6}` }
      : border.style === 'dotted' ? { strokeDasharray: `0.01 ${w * 2}`, strokeLinecap: 'round' } : {};
    const glow = border.style === 'glow' ? { filter: `drop-shadow(0 0 ${w * 1.6}px ${border.color})` } : {};
    const el = (inset, sw) => (shape === 'circle'
      ? <circle cx={PREVIEW / 2} cy={PREVIEW / 2} r={PREVIEW / 2 - inset} {...common} strokeWidth={sw ?? w} {...dash} />
      : <rect x={inset} y={inset} width={PREVIEW - 2 * inset} height={PREVIEW - 2 * inset} rx={shape === 'rounded' ? PREVIEW * 0.18 - inset : 14} {...common} strokeWidth={sw ?? w} {...dash} />);
    return (
      <svg width={PREVIEW} height={PREVIEW} className="absolute inset-0 pointer-events-none" style={glow}>
        {border.style === 'double' ? <>{el(w * 0.17, w * 0.34)}{el(w * 0.74, w * 0.34)}</> : el(w / 2)}
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
      const patImg = pattern ? await cachedImg(`pat:${pattern.key}`, svgUrl(pattern.svg)) : null;

      if (squareBg && bg.type !== 'none') paintBg(ctx, S, bg, patImg);

      const k = S / PREVIEW;
      const drawScale = baseScale * (scale / 100) * k;
      const dw = src.naturalWidth * drawScale;
      const dh = src.naturalHeight * drawScale;

      ctx.save();
      shapePath(ctx, S, shape);
      ctx.clip();
      if (bg.type !== 'none') paintBg(ctx, S, bg, patImg);

      ctx.save();
      ctx.translate(S / 2 + offset.x * k, S / 2 + offset.y * k);
      ctx.rotate((rotate * Math.PI) / 180);
      if (flip) ctx.scale(-1, 1);
      ctx.filter = filterStr || 'none';
      ctx.drawImage(src, -dw / 2, -dh / 2, dw, dh);
      ctx.restore();

      if (eff.duotone) applyDuotone(ctx, S, eff.duotone);
      if (eff.overlay) applyOverlay(ctx, S, eff.overlay);
      ctx.restore();

      if (frame) {
        const fImg = await cachedImg(`frm:${frame.key}:${border.color}`, svgUrl(frame.svg(border.color)));
        const fs = S * 1.13;
        ctx.drawImage(fImg, (S - fs) / 2, (S - fs) / 2, fs, fs);
      } else if (border.kind === 'line' && border.width) {
        drawLineBorder(ctx, S, shape, border, k);
      }

      const type = fmt === 'png' ? 'image/png' : 'image/jpeg';
      let out = canvas;
      if (type === 'image/jpeg') {
        const flat = document.createElement('canvas');
        flat.width = S; flat.height = S;
        const fc = flat.getContext('2d');
        fc.fillStyle = '#ffffff'; fc.fillRect(0, 0, S, S);
        fc.drawImage(canvas, 0, 0);
        out = flat;
      }
      const blob = await new Promise((res) => out.toBlob(res, type, 0.95));
      setResult({ blob, size: blob.size, px: S, type });
    } catch (e) {
      setError(e.message || 'Could not create the image.');
    } finally { setBusy(false); }
  };

  const ext = result?.type === 'image/jpeg' ? 'jpg' : 'png';
  const outName = file ? `${stripExt(file.name)}-profile-${result?.px || OUTPUT_SIZES[sizeIdx].px}.${ext}` : 'profile-picture.png';
  const transparentOut = !squareBg && shape !== 'square';

  if (!file) {
    return (
      <div className="max-w-2xl mx-auto">
        <FileDropzone accept="image/*" onFiles={(fs) => handleFile(fs[0])} title="Drop a photo to start" hint="or click to browse — a selfie works great" formats="JPG · PNG · WebP" />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  if (busy || result) {
    return (
      <div className="max-w-xl mx-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 px-4 py-3">
        <ResultScreen
          working={busy} done={!!result}
          title="Your profile picture is ready" workingLabel="Rendering…"
          subtitle={result ? `${result.px} × ${result.px} px · ${formatBytes(result.size)}` : undefined}
          fileName={outName} fileSize={result?.size}
          onDownload={() => result && downloadBlob(result.blob, outName)}
          onBack={() => setResult(null)} backLabel="Back to editing"
          extra={result ? (
            <div className={`mx-auto mt-1 grid place-items-center rounded-xl p-3 ${transparentOut ? 'bg-checkered' : ''}`} style={{ maxWidth: 220 }}>
              <img src={URL.createObjectURL(result.blob)} alt="Result" className="max-h-40 w-auto rounded-lg" />
            </div>
          ) : null}
          note={transparentOut && ext === 'png'
            ? 'The see-through corners (checkered) show as a clean circle on WhatsApp, Instagram, etc. A plain photo viewer may paint them white — that is normal for a round PNG.'
            : 'The image stays on your device — nothing is uploaded.'}
        />
      </div>
    );
  }

  const sw = (active) => `h-8 w-8 rounded-lg border-2 transition-transform ${active ? 'border-purple-600 scale-110' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`;
  const rng = 'w-full accent-purple-600';

  return (
    <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-6 items-start">
      {/* preview — just the shape, floating */}
      <div className="flex flex-col items-center pt-1">
        <div className="flex w-full max-w-[420px] items-center justify-between mb-4 text-[13px]">
          <span className="truncate font-medium text-gray-900 dark:text-white">{file.name}</span>
          <button type="button" onClick={reset} className="shrink-0 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
            Change photo
          </button>
        </div>

        <div className="relative" style={{ width: PREVIEW, height: PREVIEW }}>
          {squareBg && bgLayerStyle && <div className="absolute inset-0" style={{ ...bgLayerStyle, borderRadius: shape === 'square' ? '14px' : 0 }} />}
          <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: radiusCss }}>
            {bg.type === 'none' && <div className="absolute inset-0 bg-checkered" />}
            {bgLayerStyle && <div className="absolute inset-0" style={bgLayerStyle} />}
            {src && (
              <img
                src={srcUrl} alt="" draggable={false}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
                className="absolute left-1/2 top-1/2 max-w-none cursor-grab active:cursor-grabbing select-none touch-none"
                style={imgStyle}
              />
            )}
            {eff.overlay === 'vignette' && <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 45%, rgba(0,0,0,.55) 100%)' }} />}
            {eff.overlay === 'scan' && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,.16) 0 1px, transparent 1px 3px)' }} />}
            {eff.overlay === 'grain' && <div className="absolute inset-0 pointer-events-none opacity-[0.09] mix-blend-overlay" style={{ backgroundImage: patternUrl({ svg: "<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><filter id='n'><feTurbulence baseFrequency='.9'/></filter><rect width='60' height='60' filter='url(%23n)'/></svg>" }) }} />}
            {eff.duotone && <div className="absolute inset-0 pointer-events-none" style={{ background: eff.duotone[0], mixBlendMode: 'multiply' }} />}
            {eff.duotone && <div className="absolute inset-0 pointer-events-none" style={{ background: eff.duotone[1], mixBlendMode: 'screen' }} />}
            {bgBusy && (
              <div className="absolute inset-0 grid place-items-center bg-white/70 dark:bg-gray-900/70">
                <div className="text-center">
                  <div className="mx-auto h-9 w-9 border-4 border-t-purple-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">Removing background… {Math.round(bgProgress * 100)}%</p>
                </div>
              </div>
            )}
          </div>
          {borderOverlay()}
        </div>

        <div className="w-full max-w-[380px] mt-5 space-y-3">
          <label className="flex items-center gap-3">
            <svg className="h-5 w-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
            <input type="range" min={100} max={400} value={scale} onChange={(e) => { setScale(+e.target.value); setResult(null); }} className={rng} />
          </label>
          <label className="flex items-center gap-3">
            <svg className="h-5 w-5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M20 10a8 8 0 00-14-4M4 14a8 8 0 0014 4" /></svg>
            <input type="range" min={-180} max={180} value={rotate} onChange={(e) => { setRotate(+e.target.value); setResult(null); }} className={rng} />
            {rotate !== 0 && <button type="button" onClick={() => { setRotate(0); setResult(null); }} className="text-[11px] text-gray-400 hover:text-gray-600 shrink-0">reset</button>}
          </label>
          <div className="flex items-center justify-center gap-2 text-[11px]">
            <button type="button" onClick={() => { setFlip((v) => !v); setResult(null); }} className={`px-2 py-1 rounded-lg ${flip ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>Flip</button>
            <span className="text-gray-400 dark:text-gray-500">Drag the photo to reposition it</span>
          </div>
        </div>
      </div>

      {/* panel */}
      <div className="rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col overflow-hidden lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]">
        <div className="p-3.5 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-gray-900 dark:text-white">Edit your profile pic</h2>
          <label className="flex items-center gap-2 text-[13px] font-medium text-gray-600 dark:text-gray-300 select-none">
            Remove BG
            <span className="relative inline-flex">
              <input type="checkbox" checked={removeBg} disabled={bgBusy} onChange={(e) => toggleRemoveBg(e.target.checked)} className="peer sr-only" />
              <span className="h-5 w-9 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-purple-600 transition-colors" />
              <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
            </span>
          </label>
        </div>

        <div className="px-3.5">
          <div className="flex rounded-xl bg-gray-100 dark:bg-gray-700/60 p-1">
            {TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setTab(t.key)}
                className={`flex-1 py-1.5 text-[12.5px] font-medium rounded-lg transition-colors ${tab === t.key ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
          {tab === 'bg' && (
            <>
              {!removeBg && <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-2.5 py-1.5">Turn on <b>Remove BG</b> to put your photo on the background you pick.</p>}
              <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700/60 p-0.5 text-[12px] font-medium">
                {[['color', 'Colour'], ['gradient', 'Gradient'], ['pattern', 'Texture']].map(([kk, l]) => (
                  <button key={kk} type="button" onClick={() => setBgSub(kk)} className={`flex-1 py-1 rounded-md ${bgSub === kk ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>
              <button type="button" onClick={() => { setBg({ type: 'none' }); setResult(null); }} className={`w-full text-[12px] py-1.5 rounded-lg border ${bg.type === 'none' ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                No background (transparent)
              </button>
              {bgSub === 'color' && (
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${sw(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom">
                    <input type="color" onChange={(e) => { setBg({ type: 'solid', value: e.target.value }); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.map((c) => <button key={c} type="button" title={c} onClick={() => { setBg({ type: 'solid', value: c }); setResult(null); }} className={sw(bg.type === 'solid' && bg.value === c)} style={{ background: c }} />)}
                </div>
              )}
              {bgSub === 'gradient' && (
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENTS.map((g, i) => <button key={i} type="button" onClick={() => { setBg({ type: 'gradient', value: g }); setResult(null); }} className={sw(bg.type === 'gradient' && bg.value[0] === g[0] && bg.value[1] === g[1])} style={{ backgroundImage: gradCss(g) }} />)}
                </div>
              )}
              {bgSub === 'pattern' && (
                <div className="grid grid-cols-4 gap-2">
                  {PATTERNS.map((p) => <button key={p.key} type="button" title={p.name} onClick={() => { setBg({ type: 'pattern', value: p.key }); setResult(null); }} className={`h-14 rounded-lg border-2 ${bg.type === 'pattern' && bg.value === p.key ? 'border-purple-600' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`} style={{ backgroundImage: patternUrl(p), backgroundSize: `${p.tile}px` }} />)}
                </div>
              )}
            </>
          )}

          {tab === 'fx' && (
            <>
              <div className="grid grid-cols-4 gap-2">
                {EFFECTS.map((e) => (
                  <button key={e.key} type="button" onClick={() => { setEffect(e.key); setResult(null); }} className="text-center">
                    <span className={`block h-14 w-14 mx-auto rounded-full overflow-hidden relative ring-2 ${effect === e.key ? 'ring-purple-600' : 'ring-transparent'}`}>
                      {srcUrl && <img src={srcUrl} alt="" className="h-full w-full object-cover" style={{ filter: e.filter || 'none' }} />}
                      {e.duotone && <><span className="absolute inset-0" style={{ background: e.duotone[0], mixBlendMode: 'multiply' }} /><span className="absolute inset-0" style={{ background: e.duotone[1], mixBlendMode: 'screen' }} /></>}
                      {e.overlay === 'vignette' && <span className="absolute inset-0" style={{ background: 'radial-gradient(circle,transparent 40%,rgba(0,0,0,.6))' }} />}
                      {e.overlay === 'scan' && <span className="absolute inset-0" style={{ backgroundImage: 'repeating-linear-gradient(0deg,rgba(0,0,0,.2) 0 1px,transparent 1px 3px)' }} />}
                    </span>
                    <span className={`block text-[10px] mt-1 ${effect === e.key ? 'text-purple-600 dark:text-purple-300 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>{e.name}</span>
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-2">
                {[['b', 'Brightness'], ['c', 'Contrast'], ['s', 'Saturation']].map(([kk, l]) => (
                  <label key={kk} className="block">
                    <span className="flex items-center justify-between text-[12px] font-medium text-gray-600 dark:text-gray-300 mb-1">
                      {l} <span className="text-purple-600 dark:text-purple-400 tabular-nums">{adjust[kk]}%</span>
                    </span>
                    <input type="range" min={kk === 's' ? 0 : 50} max={kk === 's' ? 200 : 150} value={adjust[kk]} onChange={(e) => { setAdjust((a) => ({ ...a, [kk]: +e.target.value })); setResult(null); }} className={rng} />
                  </label>
                ))}
                {(adjust.b !== 100 || adjust.c !== 100 || adjust.s !== 100) && (
                  <button type="button" onClick={() => { setAdjust({ b: 100, c: 100, s: 100 }); setResult(null); }} className="text-[11px] text-gray-400 hover:text-gray-600">Reset adjustments</button>
                )}
              </div>
            </>
          )}

          {tab === 'border' && (
            <>
              <div className="grid grid-cols-5 gap-1">
                {LINE_STYLES.map((s) => (
                  <button key={s.key} type="button" onClick={() => { setBorder((b) => ({ ...b, kind: 'line', style: s.key, width: b.width || 8 })); setResult(null); }}
                    className={`py-1.5 text-[11px] font-medium rounded-lg border ${border.kind === 'line' && border.style === s.key && border.width ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-500'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="flex items-center justify-between text-[12px] font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Thickness <span className="text-purple-600 dark:text-purple-400 tabular-nums">{border.width}px</span>
                </span>
                <input type="range" min={0} max={28} value={border.width} onChange={(e) => { setBorder((b) => ({ ...b, kind: b.kind === 'frame' ? 'frame' : 'line', width: +e.target.value })); setResult(null); }} className={rng} />
              </label>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Colour</p>
                <div className="flex flex-wrap gap-1.5">
                  <label className={`${sw(false)} grid place-items-center cursor-pointer`} style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }} title="Custom">
                    <input type="color" onChange={(e) => { setBorder((b) => ({ ...b, color: e.target.value })); setResult(null); }} className="sr-only" />
                  </label>
                  {SOLIDS.filter((_, i) => i % 2 === 0).map((c) => <button key={c} type="button" onClick={() => { setBorder((b) => ({ ...b, color: c })); setResult(null); }} className={sw(border.color === c)} style={{ background: c }} />)}
                </div>
              </div>
              <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1.5">Frames</p>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => { setBorder((b) => ({ ...b, kind: 'line', frame: null })); setResult(null); }}
                    className={`h-14 rounded-lg border-2 grid place-items-center text-[10px] ${border.kind !== 'frame' ? 'border-purple-600 text-purple-600 dark:text-purple-300' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
                    None
                  </button>
                  {FRAMES.map((f) => (
                    <button key={f.key} type="button" title={f.name} onClick={() => { setBorder((b) => ({ ...b, kind: 'frame', frame: f.key })); setResult(null); }}
                      className={`h-14 rounded-lg border-2 bg-gray-100 dark:bg-gray-700/50 bg-center bg-no-repeat ${border.kind === 'frame' && border.frame === f.key ? 'border-purple-600' : 'border-transparent ring-1 ring-black/10 dark:ring-white/15'}`}
                      style={{ backgroundImage: `url("${svgUrl(f.svg(border.color))}")`, backgroundSize: '86%' }} />
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
                  <input type="checkbox" checked={!squareBg} onChange={(e) => { setSquareBg(!e.target.checked); setResult(null); }} className="mt-0.5 h-4 w-4 accent-purple-600" />
                  <span>
                    See-through corners (round PNG sticker)
                    <span className="block text-[11px] text-gray-400 dark:text-gray-500">Off = the background fills the whole square, so the file always looks complete.</span>
                  </span>
                </label>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="p-3.5 border-t border-gray-200 dark:border-gray-700 space-y-2.5">
          <div className="flex items-center gap-2">
            <select value={sizeIdx} onChange={(e) => { setSizeIdx(+e.target.value); setResult(null); }} className="flex-1 min-w-0 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-[13px] p-2">
              {OUTPUT_SIZES.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
            </select>
            <div className="flex rounded-lg bg-gray-100 dark:bg-gray-700 p-0.5 text-[12px] font-medium shrink-0">
              {['png', 'jpg'].map((f) => <button key={f} type="button" onClick={() => { setFmt(f); setResult(null); }} className={`px-2.5 py-1 rounded-md ${fmt === f ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-300' : 'text-gray-500'}`}>{f.toUpperCase()}</button>)}
            </div>
          </div>
          <button type="button" onClick={build} disabled={!src || bgBusy} className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:opacity-95 disabled:opacity-50 transition-opacity">
            Download
          </button>
        </div>
      </div>
    </div>
  );
};

function drawLineBorder(ctx, S, shape, border, k) {
  const bw = border.width * k;
  ctx.save();
  ctx.strokeStyle = border.color;
  ctx.lineJoin = 'round';
  if (border.style === 'double') {
    const seg = Math.max(1, bw * 0.34);
    ctx.lineWidth = seg;
    shapePath(ctx, S, shape, seg / 2); ctx.stroke();
    shapePath(ctx, S, shape, seg + bw * 0.4 + seg / 2); ctx.stroke();
  } else {
    ctx.lineWidth = bw;
    if (border.style === 'dashed') ctx.setLineDash([bw * 2.4, bw * 1.6]);
    else if (border.style === 'dotted') { ctx.setLineDash([0.01, bw * 2]); ctx.lineCap = 'round'; }
    else if (border.style === 'glow') { ctx.shadowColor = border.color; ctx.shadowBlur = bw * 2.6; }
    shapePath(ctx, S, shape, bw / 2); ctx.stroke();
    if (border.style === 'glow') { ctx.shadowBlur = 0; shapePath(ctx, S, shape, bw / 2); ctx.stroke(); }
  }
  ctx.restore();
}

export default ProfilePictureMaker;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ToolWorkspace from '../../tool/ToolWorkspace';
import ResultScreen from '../../tool/ResultScreen';
import { downloadBlob } from '../../tool/DownloadButton';
import { stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';

let seq = 0;
const uid = () => `f${++seq}`;
const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const todayStr = () => new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const COLORS = [
  { name: 'Black', hex: '#111827' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Red', hex: '#b91c1c' },
];
const hexToRgb = (hex) => {
  const h = (hex || '#111827').replace('#', '');
  return rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);
};

/* ---------- icons ---------- */
const I = ({ d, cls = 'h-5 w-5' }) => (
  <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICON = {
  select: 'M6 3l14 8-6 2-2 6-6-16z',
  text: 'M4 7V5h16v2M9 20h6M12 5v15',
  sign: 'M3 17s3-8 7-8 3 6 6 6 5-4 5-4M3 21h18',
  date: 'M8 2v3M16 2v3M4 8h16M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1z',
  check: 'M5 13l4 4L19 7',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M8 7l1 13h6l1-13',
};

/* ================= signature capture modal ================= */
const trimCanvas = (src) => {
  const ctx = src.getContext('2d');
  const { width: w, height: h } = src;
  const d = ctx.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = 0; let y1 = 0; let found = false;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (d[(y * w + x) * 4 + 3] > 8) {
        found = true;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (!found) return null;
  const pad = 6;
  const cw = Math.min(w, x1 - x0 + pad * 2);
  const ch = Math.min(h, y1 - y0 + pad * 2);
  const out = document.createElement('canvas');
  out.width = cw;
  out.height = ch;
  out.getContext('2d').drawImage(src, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
  return out;
};

/** Crop an uploaded image to `cropPct` and optionally key out the white/paper
 *  background (for signatures photographed on paper or in a scan app). */
const processUploadedSignature = (img, c, removeBg) => {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const sx = Math.max(0, Math.round((c.x / 100) * W));
  const sy = Math.max(0, Math.round((c.y / 100) * H));
  const cw = Math.max(1, Math.round((c.width / 100) * W));
  const ch = Math.max(1, Math.round((c.height / 100) * H));
  const cv = document.createElement('canvas');
  cv.width = cw;
  cv.height = ch;
  const ctx = cv.getContext('2d');
  ctx.drawImage(img, sx, sy, cw, ch, 0, 0, cw, ch);
  if (removeBg) {
    const id = ctx.getImageData(0, 0, cw, ch);
    const p = id.data;
    for (let i = 0; i < p.length; i += 4) {
      const lum = (p[i] + p[i + 1] + p[i + 2]) / 3;
      if (lum > 232) p[i + 3] = 0;
      else if (lum > 188) p[i + 3] = Math.round(p[i + 3] * ((232 - lum) / 44));
    }
    ctx.putImageData(id, 0, 0);
  }
  const t = trimCanvas(cv);
  return (t || cv).toDataURL('image/png');
};

const SignatureModal = ({ onClose, onDone }) => {
  const [tab, setTab] = useState('draw');
  const [typed, setTyped] = useState('');
  const typedRef = useRef('');
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  // upload editor
  const [upSrc, setUpSrc] = useState(null);
  const [upCrop, setUpCrop] = useState({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
  const [upBg, setUpBg] = useState(true);
  const upImgRef = useRef(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = 520 * dpr;
    c.height = 200 * dpr;
    const ctx = c.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
  }, [tab]);

  const pos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - r.left, y: t.clientY - r.top };
  };
  const down = (e) => { drawing.current = true; const ctx = canvasRef.current.getContext('2d'); const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const p = pos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    dirty.current = true;
  };
  const up = () => { drawing.current = false; };
  const clear = () => {
    const c = canvasRef.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    dirty.current = false;
  };

  const commit = () => {
    if (tab === 'draw') {
      if (!dirty.current) return;
      const t = trimCanvas(canvasRef.current);
      if (t) onDone(t.toDataURL('image/png'));
      return;
    }
    if (tab === 'type') {
      const text = (typedRef.current || typed).trim();
      if (!text) return;
      const dpr = 3;
      const c = document.createElement('canvas');
      c.width = 700 * dpr;
      c.height = 200 * dpr;
      const ctx = c.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#111827';
      ctx.textBaseline = 'middle';
      ctx.font = "58px 'Segoe Script','Bradley Hand','Snell Roundhand','Apple Chancery',cursive";
      ctx.fillText(text, 12, 105);
      const t = trimCanvas(c);
      if (t) onDone(t.toDataURL('image/png'));
      return;
    }
    if (tab === 'upload' && upImgRef.current) {
      onDone(processUploadedSignature(upImgRef.current, upCrop, upBg));
    }
  };

  const onUpload = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setUpSrc(reader.result);
      setUpCrop({ unit: '%', x: 0, y: 0, width: 100, height: 100 });
    };
    reader.readAsDataURL(f);
  };

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg ${tab === id ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Your signature</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><I d={ICON.x} cls="h-5 w-5" /></button>
        </div>

        <div className="flex gap-1 mb-3">{tabBtn('draw', 'Draw')}{tabBtn('type', 'Type')}{tabBtn('upload', 'Upload')}</div>

        {tab === 'draw' && (
          <>
            <canvas
              ref={canvasRef}
              className="w-full h-[200px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white touch-none cursor-crosshair"
              onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
              onTouchStart={down} onTouchMove={move} onTouchEnd={up}
            />
            <div className="mt-2 flex justify-between">
              <button type="button" onClick={clear} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Clear</button>
              <span className="text-xs text-gray-400 dark:text-gray-500">Draw with your mouse or finger</span>
            </div>
          </>
        )}

        {tab === 'type' && (
          <>
            <input
              type="text"
              value={typed}
              onChange={(e) => { typedRef.current = e.target.value; setTyped(e.target.value); }}
              placeholder="Type your name"
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
            />
            <div className="mt-2 h-[120px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white flex items-center px-4 overflow-hidden">
              <span className="text-4xl text-gray-900" style={{ fontFamily: "'Segoe Script','Bradley Hand','Snell Roundhand','Apple Chancery',cursive" }}>
                {typed || 'Your name'}
              </span>
            </div>
          </>
        )}

        {tab === 'upload' && !upSrc && (
          <label className="mt-1 flex flex-col items-center justify-center h-[160px] rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-purple-400 text-sm text-gray-500 dark:text-gray-400">
            <I d="M12 4v12m0-12l-4 4m4-4l4 4M4 20h16" cls="h-7 w-7 mb-2" />
            Choose a photo / scan of your signature
            <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={onUpload} />
          </label>
        )}

        {tab === 'upload' && upSrc && (
          <>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
              Drag to crop out any app name / stamp. Then keep or drop the paper background.
            </p>
            <div className={`rounded-xl overflow-hidden flex items-center justify-center ${upBg ? 'bg-white' : 'bg-[repeating-conic-gradient(#e5e7eb_0_25%,#f9fafb_0_50%)] bg-[length:16px_16px]'}`}>
              <ReactCrop crop={upCrop} onChange={(_, pct) => setUpCrop({ unit: '%', ...pct })} keepSelection>
                <img
                  ref={upImgRef}
                  src={upSrc}
                  alt="uploaded signature"
                  className="max-h-[220px] max-w-full w-auto object-contain select-none"
                  style={upBg ? undefined : { filter: 'contrast(1.05)' }}
                />
              </ReactCrop>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input type="checkbox" checked={upBg} onChange={(e) => setUpBg(e.target.checked)} className="h-4 w-4 accent-purple-600" />
                Remove paper background
              </label>
              <button type="button" onClick={() => setUpSrc(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                Choose another
              </button>
            </div>
          </>
        )}

        {(tab !== 'upload' || upSrc) && (
          <button
            type="button"
            onClick={commit}
            className="mt-4 w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95"
          >
            Use this signature
          </button>
        )}
      </div>
    </div>
  );
};

/* ================= main ================= */
const PDFFillAndSign = () => {
  const [phase, setPhase] = useState('idle'); // idle | loading | ready
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [fileName, setFileName] = useState('');
  const [pages, setPages] = useState([]); // {index, url, wPt, hPt}
  const [items, setItems] = useState([]); // {id, page, type, xf, yf, wf, hf, text, fontPt, color}
  const [tool, setTool] = useState('select');
  const [signature, setSignature] = useState(null);
  const [signOpen, setSignOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const wrapRefs = useRef({});
  const dragRef = useRef(null);
  const pendingSignPlace = useRef(null);

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setFile(f);
    setPhase('loading');
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab.slice(0));
      const out = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        // eslint-disable-next-line no-await-in-loop
        const canvas = await renderPageToCanvas(doc, i, { scale: 1.6 });
        out.push({ index: i, url: canvas.toDataURL('image/jpeg', 0.82), wPt: vp.width, hPt: vp.height });
      }
      setBytes(ab);
      setFileName(f.name || 'document.pdf');
      setPages(out);
      setItems([]);
      setPhase('ready');
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
      setFile(null);
      setPhase('idle');
    }
  }, []);

  const reset = () => {
    setPhase('idle'); setFile(null); setBytes(null); setFileName(''); setPages([]);
    setItems([]); setSignature(null); setSelectedId(null); setEditingId(null); setResult(null); setError(null);
  };
  const backFromResult = () => setResult(null);

  /* ---- place an item ---- */
  const addItem = (page, xf, yf, type) => {
    const base = { id: uid(), page, xf: clamp01(xf), yf: clamp01(yf), color: '#111827' };
    if (type === 'text') {
      const it = { ...base, type: 'text', text: '', fontPt: 13, hf: 0 };
      setItems((p) => [...p, it]);
      setSelectedId(it.id);
      setEditingId(it.id); // start typing immediately
      setTool('select');
      return;
    }
    if (type === 'date') {
      const it = { ...base, type: 'date', text: todayStr(), fontPt: 12, hf: 0 };
      setItems((p) => [...p, it]);
      setSelectedId(it.id);
      setTool('select');
      return;
    }
    if (type === 'check' || type === 'x') {
      // stay on the tool so several boxes can be ticked in a row
      setItems((p) => [...p, { ...base, type, wf: 0.028, hf: 0.028 }]);
      return;
    }
    if (type === 'sign') {
      if (!signature) { pendingSignPlace.current = { page, xf, yf }; setSignOpen(true); return; }
      const it = { ...base, type: 'sign', img: signature, wf: 0.26, hf: 0.09 };
      setItems((p) => [...p, it]);
      setSelectedId(it.id);
      setTool('select');
    }
  };

  const onPageClick = (e, page) => {
    if (dragRef.current) return;
    if (e.target.closest('[data-item]')) return;
    if (tool === 'select') { setSelectedId(null); return; }
    const wrap = wrapRefs.current[page];
    if (!wrap) return;
    const r = wrap.getBoundingClientRect();
    const xf = (e.clientX - r.left) / r.width;
    const yf = (e.clientY - r.top) / r.height;
    addItem(page, xf, yf, tool);
  };

  const onSignatureReady = (dataUrl) => {
    setSignature(dataUrl);
    setSignOpen(false);
    const pend = pendingSignPlace.current;
    pendingSignPlace.current = null;
    const at = pend || { page: pages[0]?.index || 1, xf: 0.2, yf: 0.2 };
    setItems((p) => [...p, {
      id: uid(), type: 'sign', page: at.page, xf: clamp01(at.xf), yf: clamp01(at.yf),
      wf: 0.26, hf: 0.09, img: dataUrl, color: '#111827',
    }]);
    setTool('select');
  };

  const updateItem = (id, patch) => setItems((p) => p.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id) => { setItems((p) => p.filter((it) => it.id !== id)); setSelectedId(null); };

  /* ---- drag / resize ---- */
  const startDrag = (e, item, mode) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(item.id);
    const wrap = wrapRefs.current[item.page];
    const r = wrap.getBoundingClientRect();
    dragRef.current = {
      id: item.id, mode, r,
      startX: e.clientX, startY: e.clientY,
      xf0: item.xf, yf0: item.yf, wf0: item.wf, hf0: item.hf,
      aspect: item.hf ? item.wf / item.hf : 1,
    };
    window.addEventListener('pointermove', onDragMove);
    window.addEventListener('pointerup', onDragEnd);
  };
  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) / d.r.width;
    const dy = (e.clientY - d.startY) / d.r.height;
    if (d.mode === 'move') {
      updateItem(d.id, { xf: clamp01(d.xf0 + dx), yf: clamp01(d.yf0 + dy) });
    } else {
      const wf = Math.max(0.03, d.wf0 + dx);
      updateItem(d.id, { wf, hf: d.aspect ? wf / d.aspect : d.hf0 + dy });
    }
  };
  const onDragEnd = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onDragMove);
    window.removeEventListener('pointerup', onDragEnd);
  };

  useEffect(() => {
    const onKey = (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const el = document.activeElement;
        if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
        removeItem(selectedId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  /* ---- save ---- */
  const outName = `${stripExt(fileName || 'document')}-signed.pdf`;
  const sanitize = (s) => String(s)
    .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"').replace(/[–—−]/g, '-')
    .replace(/…/g, '...').replace(/\u00A0/g, ' ');

  const save = async () => {
    if (saving) return;
    if (!items.length) { setError('Add a field or signature first.'); return; }
    setSaving(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(bytes);
      const font = await doc.embedFont(StandardFonts.Helvetica);
      const bold = await doc.embedFont(StandardFonts.HelveticaBold);
      const docPages = doc.getPages();
      const pngCache = new Map();

      for (const it of items) {
        const pg = docPages[it.page - 1];
        if (!pg) continue;
        const { width: W, height: H } = pg.getSize();
        const x = it.xf * W;
        const yTop = it.yf * H;

        if (it.type === 'sign' && it.img) {
          let img = pngCache.get(it.img);
          if (!img) {
            // eslint-disable-next-line no-await-in-loop
            img = await doc.embedPng(it.img);
            pngCache.set(it.img, img);
          }
          const w = it.wf * W;
          const h = it.hf * H;
          pg.drawImage(img, { x, y: H - yTop - h, width: w, height: h });
        } else if (it.type === 'check' || it.type === 'x') {
          const s = Math.max(8, it.wf * W);
          const col = hexToRgb(it.color);
          const yb = H - yTop - s;
          if (it.type === 'x') {
            pg.drawLine({ start: { x, y: yb }, end: { x: x + s, y: yb + s }, thickness: 1.8, color: col });
            pg.drawLine({ start: { x, y: yb + s }, end: { x: x + s, y: yb }, thickness: 1.8, color: col });
          } else {
            pg.drawLine({ start: { x, y: yb + s * 0.45 }, end: { x: x + s * 0.4, y: yb + s * 0.05 }, thickness: 1.8, color: col });
            pg.drawLine({ start: { x: x + s * 0.4, y: yb + s * 0.05 }, end: { x: x + s * 1.05, y: yb + s * 0.95 }, thickness: 1.8, color: col });
          }
        } else {
          const text = sanitize(it.text || '');
          if (!text.trim()) continue;
          const size = it.fontPt || 13;
          try {
            pg.drawText(text, {
              x: x + 1,
              y: Math.max(2, H - yTop - size * 0.9),
              size,
              font,
              color: hexToRgb(it.color),
              // one line, from the drop point to the page edge
              maxWidth: Math.max(24, (1 - it.xf) * W - 2),
              lineHeight: size * 1.2,
            });
          } catch (_) { /* skip a bad line */ }
          void bold;
        }
      }

      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size });
    } catch (e) {
      console.error(e);
      setError(`Could not save the PDF: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  /* ---------- render ---------- */
  const TOOLS = [
    { id: 'select', label: 'Move' },
    { id: 'text', label: 'Text' },
    { id: 'sign', label: 'Signature' },
    { id: 'date', label: 'Date' },
    { id: 'check', label: 'Checkmark' },
    { id: 'x', label: 'X mark' },
  ];
  const HINTS = {
    select: 'Drag any field to reposition. Double-click a text or date to edit it.',
    text: 'Click on the page to drop a text field, then type.',
    sign: signature ? 'Click on the page to place your signature.' : 'Make your signature first.',
    date: 'Click to stamp today’s date. Drag it; double-click to change it.',
    check: 'Click to place a checkmark — the tool stays on for several.',
    x: 'Click to place an X — the tool stays on for several.',
  };

  const pickTool = (id) => {
    if (id === 'sign' && !signature) { setSignOpen(true); setTool('sign'); return; }
    setTool(id);
    setSelectedId(null);
    setEditingId(null);
  };

  const sidebar = (
    <>
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{fileName || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">Start over</button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {pages.length} page{pages.length === 1 ? '' : 's'} · {items.length} field{items.length === 1 ? '' : 's'}
        </p>
      </section>

      <section className="space-y-1.5 pt-3 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Add to the page</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => pickTool(t.id)}
              className={`h-10 flex items-center gap-2 px-2.5 rounded-lg text-sm font-medium transition-colors ${
                tool === t.id ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <I d={ICON[t.id]} cls="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug pt-0.5">{HINTS[tool]}</p>
      </section>

      {signature && (
        <section className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Your signature</h3>
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-2 flex items-center justify-center">
            <img src={signature} alt="signature" className="max-h-12 max-w-full object-contain" />
          </div>
          <button type="button" onClick={() => setSignOpen(true)} className="w-full text-xs font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
            Change signature
          </button>
        </section>
      )}

      <section className="pt-3 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-snug">
          Everything runs in your browser. The PDF&apos;s own text and layout stay untouched — your fields go on top.
        </p>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={save}
      disabled={saving || !items.length}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {saving ? 'Saving…' : items.length ? `Save signed PDF · ${items.length} field${items.length > 1 ? 's' : ''}` : 'Add a field first'}
    </button>
  );

  const resultView = (saving || result) ? (
    <ResultScreen
      working={saving}
      done={!!result}
      title="Your PDF is signed"
      workingLabel="Stamping your fields…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => result && downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to editing"
      note="Your fields are stamped onto the page. Nothing was uploaded."
    />
  ) : null;

  return (
    <>
      <ToolWorkspace
        file={file}
        accept="application/pdf,.pdf"
        formats="PDF — fields and signature go on top, nothing uploaded"
        dropTitle="Drop a PDF to fill & sign"
        dropHint="add text, a date, checkmarks and your signature"
        paste={false}
        onFiles={onFiles}
        onBack={(saving || result) ? backFromResult : reset}
        sidebar={sidebar}
        footer={footer}
        result={resultView}
      >
        {phase === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Opening PDF…
          </div>
        ) : (
          <div className="mx-auto flex flex-col items-center gap-5" style={{ maxWidth: 900 }}>
            {pages.map((pg) => (
              <div
                key={pg.index}
                ref={(el) => { wrapRefs.current[pg.index] = el; }}
                onClick={(e) => onPageClick(e, pg.index)}
                className="relative w-full shadow-lg ring-1 ring-black/10 bg-white select-none"
                style={{
                  aspectRatio: `${pg.wPt} / ${pg.hPt}`,
                  containerType: 'inline-size',
                  cursor: tool === 'select' ? 'default' : 'crosshair',
                }}
              >
                <img src={pg.url} alt={`Page ${pg.index}`} draggable={false} className="absolute inset-0 w-full h-full" />

                {items.filter((it) => it.page === pg.index).map((it) => {
                  const sel = it.id === selectedId;
                  const style = { left: `${it.xf * 100}%`, top: `${it.yf * 100}%` };
                  const common = `absolute ${sel ? 'ring-2 ring-purple-500' : 'ring-1 ring-purple-300/60 hover:ring-purple-400'}`;

                  if (it.type === 'sign') {
                    return (
                      <div
                        key={it.id}
                        data-item
                        style={{ ...style, width: `${it.wf * 100}%` }}
                        className={`${common} group rounded`}
                        onPointerDown={(e) => startDrag(e, it, 'move')}
                      >
                        <img src={it.img} alt="signature" draggable={false} className="w-full h-auto pointer-events-none" />
                        {sel && (
                          <>
                            <button type="button" onClick={() => removeItem(it.id)} className="absolute -top-2.5 -right-2.5 h-5 w-5 rounded-full bg-red-600 text-white grid place-items-center text-[10px] shadow">✕</button>
                            <span
                              onPointerDown={(e) => startDrag(e, it, 'resize')}
                              className="absolute -bottom-2 -right-2 h-4 w-4 rounded-full bg-purple-600 border-2 border-white cursor-nwse-resize"
                            />
                          </>
                        )}
                      </div>
                    );
                  }

                  if (it.type === 'check' || it.type === 'x') {
                    return (
                      <div
                        key={it.id}
                        data-item
                        style={{ ...style, width: `${Math.max(it.wf, 0.028) * 100}%`, color: it.color }}
                        className={`${common} rounded`}
                        onPointerDown={(e) => startDrag(e, it, 'move')}
                      >
                        <I d={it.type === 'x' ? ICON.x : ICON.check} cls="w-full h-auto" />
                        {sel && (
                          <div className="absolute -top-9 left-0 flex items-center gap-1 rounded-lg bg-gray-900 text-white px-1.5 py-1 shadow">
                            <button type="button" onClick={() => updateItem(it.id, { wf: Math.max(0.015, it.wf - 0.006), hf: Math.max(0.015, it.hf - 0.006) })} className="h-6 px-1.5 text-xs hover:bg-white/20 rounded">−</button>
                            <button type="button" onClick={() => updateItem(it.id, { wf: Math.min(0.12, it.wf + 0.006), hf: Math.min(0.12, it.hf + 0.006) })} className="h-6 px-1.5 text-sm font-semibold hover:bg-white/20 rounded">+</button>
                            <span className="w-px h-4 bg-white/30 mx-0.5" />
                            {COLORS.map((c) => (
                              <button key={c.hex} type="button" title={c.name} onClick={() => updateItem(it.id, { color: c.hex })}
                                className={`h-5 w-5 rounded-full border-2 ${it.color === c.hex ? 'border-white' : 'border-white/30'}`} style={{ backgroundColor: c.hex }} />
                            ))}
                            <span className="w-px h-4 bg-white/30 mx-0.5" />
                            <button type="button" onClick={() => removeItem(it.id)} className="h-6 w-6 grid place-items-center hover:bg-white/20 rounded"><I d={ICON.trash} cls="h-3.5 w-3.5" /></button>
                          </div>
                        )}
                      </div>
                    );
                  }

                  // text / date — the field auto-sizes to its content (an
                  // invisible sizer span sets the width; the input / display
                  // text overlay it), so long dates never get clipped.
                  const fontSize = `calc(${it.fontPt} / ${pg.wPt} * 100cqw)`;
                  const editing = it.id === editingId;
                  const ph = it.type === 'date' ? 'Date' : 'Text';
                  return (
                    <div
                      key={it.id}
                      data-item
                      style={style}
                      className={`${common} rounded bg-white/70 ${editing ? '' : 'cursor-move'} whitespace-nowrap`}
                      onPointerDown={(e) => { if (!editing) startDrag(e, it, 'move'); }}
                      onDoubleClick={() => { setSelectedId(it.id); setEditingId(it.id); }}
                    >
                      <span className="invisible whitespace-pre px-1 leading-tight" style={{ fontSize }}>
                        {it.text || ph}
                      </span>
                      {editing ? (
                        <input
                          value={it.text}
                          autoFocus
                          onChange={(e) => updateItem(it.id, { text: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur(); }}
                          placeholder={ph}
                          className="absolute inset-0 w-full bg-transparent outline-none leading-tight px-1"
                          style={{ fontSize, color: it.color }}
                        />
                      ) : (
                        <span
                          className="absolute inset-0 px-1 leading-tight pointer-events-none whitespace-pre"
                          style={{ fontSize, color: it.text ? it.color : '#9ca3af' }}
                        >
                          {it.text || ph}
                        </span>
                      )}
                      {sel && !editing && (
                        <div className="absolute -top-9 left-0 flex items-center gap-1 rounded-lg bg-gray-900 text-white px-1.5 py-1 shadow whitespace-nowrap">
                          <button type="button" onClick={() => setEditingId(it.id)} className="h-6 px-1.5 grid place-items-center text-xs hover:bg-white/20 rounded">Edit</button>
                          <span className="w-px h-4 bg-white/30 mx-0.5" />
                          <button type="button" onClick={() => updateItem(it.id, { fontPt: Math.max(6, it.fontPt - 1) })} className="h-6 px-1.5 grid place-items-center text-xs hover:bg-white/20 rounded">A−</button>
                          <span className="text-[10px] tabular-nums w-5 text-center">{it.fontPt}</span>
                          <button type="button" onClick={() => updateItem(it.id, { fontPt: Math.min(60, it.fontPt + 1) })} className="h-6 px-1.5 grid place-items-center text-sm font-semibold hover:bg-white/20 rounded">A+</button>
                          <span className="w-px h-4 bg-white/30 mx-0.5" />
                          {COLORS.map((c) => (
                            <button
                              key={c.hex}
                              type="button"
                              title={c.name}
                              onClick={() => updateItem(it.id, { color: c.hex })}
                              className={`h-5 w-5 rounded-full border-2 ${it.color === c.hex ? 'border-white' : 'border-white/30'}`}
                              style={{ backgroundColor: c.hex }}
                            />
                          ))}
                          <span className="w-px h-4 bg-white/30 mx-0.5" />
                          <button type="button" onClick={() => removeItem(it.id)} className="h-6 w-6 grid place-items-center hover:bg-white/20 rounded"><I d={ICON.trash} cls="h-3.5 w-3.5" /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </ToolWorkspace>

      {signOpen && (
        <SignatureModal
          onClose={() => { setSignOpen(false); pendingSignPlace.current = null; }}
          onDone={onSignatureReady}
        />
      )}
    </>
  );
};

export default PDFFillAndSign;

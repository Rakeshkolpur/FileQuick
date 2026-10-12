import React, { useContext, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- `motion` is used only as <motion.*> JSX
import { AnimatePresence, motion } from 'framer-motion';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, useSortable, arrayMove, horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FileDropzone from '../../tool/FileDropzone';
import Lightbox from '../../tool/Lightbox';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { stripExt } from '../../../lib/format';
import { toolFileName } from '../../../lib/fileNames';
import { zipFiles } from '../../../lib/zip';
import { imagesToPdf } from '../../../lib/imagesToPdf';
import { getCv, preloadCv } from '../../../lib/opencvLoader';
import { detectDocument, detectDocumentAI, orderCorners, scanPage } from '../../../lib/scan';
import { screenFiles, rejectionMessage } from '../../../lib/fileValidation';

const MAX_PDF_PAGES = 300;

const MODES = [
  { key: 'auto', label: 'Auto', hint: 'Flatten lighting, keep colour' },
  { key: 'bw', label: 'B&W', hint: 'Crisp black text on white' },
  { key: 'grey', label: 'Greyscale', hint: 'Neutral, softer' },
  { key: 'colour', label: 'Colour', hint: 'Full colour, cleaned' },
  { key: 'original', label: 'Original', hint: 'Just straighten it' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Scanning works on at most this many pixels on the long side (same cap as
// SCAN_MAX in lib/scan.js), so a rotated copy is only ever built at this size.
const SCAN_EDGE = 2400;

// What the user sees: the photo's size after their 90° turns.
const dispOf = (p) => (p.rotate % 180 ? { w: p.nat.h, h: p.nat.w } : p.nat);
// The starting frame: the whole photo, 6% in from each side.
const frameFor = ({ w, h }) => [
  { x: w * 0.06, y: h * 0.06 }, { x: w * 0.94, y: h * 0.06 },
  { x: w * 0.94, y: h * 0.94 }, { x: w * 0.06, y: h * 0.94 },
];
let _seq = 0;

/* ---------------- corner editor ---------------- */

// The frame the user sets before scanning: drag a corner, or drag a side bar
// to pull that whole edge in or out. Outside the frame is dimmed so it's clear
// what will be kept.
function QuadEditor({ src, corners, nat, rotate = 0, onChange }) {
  const wrapRef = useRef(null);
  // { kind: 'corner', i } | { kind: 'edge', i, start: corners, from: point }
  const drag = useRef(null);

  const toPct = (p) => ({ x: (p.x / nat.w) * 100, y: (p.y / nat.h) * 100 });
  const pointAt = (e) => {
    const r = wrapRef.current.getBoundingClientRect();
    return {
      x: clamp((e.clientX - r.left) / r.width, 0, 1) * nat.w,
      y: clamp((e.clientY - r.top) / r.height, 0, 1) * nat.h,
    };
  };

  const begin = (e, d) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = d.kind === 'edge' ? { ...d, start: corners.map((c) => ({ ...c })), from: pointAt(e) } : d;
  };

  const move = (e) => {
    const d = drag.current;
    if (!d || !wrapRef.current) return;
    const p = pointAt(e);
    if (d.kind === 'corner') {
      const next = corners.slice();
      next[d.i] = p;
      onChange(next);
      return;
    }
    // edge: move both of its corners along the edge's normal only
    const a = d.start[d.i];
    const b = d.start[(d.i + 1) % 4];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const k = (p.x - d.from.x) * nx + (p.y - d.from.y) * ny;
    const next = d.start.map((c) => ({ ...c }));
    [d.i, (d.i + 1) % 4].forEach((j) => {
      next[j] = { x: clamp(d.start[j].x + nx * k, 0, nat.w), y: clamp(d.start[j].y + ny * k, 0, nat.h) };
    });
    onChange(next);
  };
  const end = () => { drag.current = null; };

  const pts = corners.map(toPct);
  // `nat` is the size as displayed (after turning); the <img> keeps its own
  // orientation and is turned with CSS, so rotating costs nothing.
  const turned = rotate % 180 !== 0;
  const imgStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: turned ? `${(nat.h / nat.w) * 100}%` : '100%',
    height: turned ? `${(nat.w / nat.h) * 100}%` : '100%',
    transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
  };
  const poly = pts.map((q) => `${q.x},${q.y}`).join(' ');

  return (
    <div
      ref={wrapRef}
      className="relative max-w-full select-none touch-none overflow-hidden rounded-lg"
      style={{ aspectRatio: `${nat.w} / ${nat.h}`, width: `min(100%, calc(max(260px, 62vh) * ${nat.w / nat.h}))` }}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <img src={src} alt="" draggable={false} style={imgStyle} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        {/* dim everything outside the frame */}
        <path
          d={`M0,0 H100 V100 H0 Z M${pts.map((q) => `${q.x},${q.y}`).join(' L')} Z`}
          fill="rgba(0,0,0,0.45)"
          fillRule="evenodd"
        />
        <polygon points={poly} fill="none" stroke="#a78bfa" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>

      {/* side bars — drag to move a whole edge */}
      {corners.map((c, i) => {
        const n = corners[(i + 1) % 4];
        const mid = toPct({ x: (c.x + n.x) / 2, y: (c.y + n.y) / 2 });
        const angle = (Math.atan2(n.y - c.y, n.x - c.x) * 180) / Math.PI;
        return (
          <button
            key={`e${i}`}
            type="button"
            aria-label={['Top edge', 'Right edge', 'Bottom edge', 'Left edge'][i]}
            onPointerDown={(e) => begin(e, { kind: 'edge', i })}
            className="absolute grid h-8 w-12 cursor-grab touch-none place-items-center active:cursor-grabbing"
            style={{ left: `${mid.x}%`, top: `${mid.y}%`, transform: `translate(-50%, -50%) rotate(${angle}deg)` }}
          >
            <span className="block h-2 w-9 rounded-full border-2 border-white bg-purple-600 shadow-md shadow-black/30" />
          </button>
        );
      })}

      {/* corners */}
      {pts.map((q, i) => (
        <button
          key={`c${i}`}
          type="button"
          aria-label={['Top-left corner', 'Top-right corner', 'Bottom-right corner', 'Bottom-left corner'][i]}
          onPointerDown={(e) => begin(e, { kind: 'corner', i })}
          className="absolute grid h-10 w-10 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center active:cursor-grabbing"
          style={{ left: `${q.x}%`, top: `${q.y}%` }}
        >
          <span className="block h-6 w-6 rounded-full border-2 border-white bg-purple-600 shadow-lg shadow-purple-600/40" />
        </button>
      ))}
    </div>
  );
}

/* ---------------- filmstrip thumb ---------------- */

const stopDrag = (e) => e.stopPropagation();

function PageThumb({ page, active, index, onClick, onRemove, onDownload, onExpand }) {
  const scanning = ['detecting', 'ai', 'scanning'].includes(page.status);
  const thumb = page.result?.url || page.srcUrl;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : undefined,
    opacity: isDragging ? 0.4 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`group relative shrink-0 cursor-grab touch-none select-none overflow-hidden rounded-lg border-2 active:cursor-grabbing ${
        active ? 'border-purple-600' : 'border-transparent hover:border-purple-300 dark:hover:border-purple-700'
      }`}
      onClick={onClick}
    >
      <img
        src={thumb}
        alt=""
        draggable={false}
        className="h-24 w-20 bg-gray-100 object-cover dark:bg-gray-800"
        style={!page.result && page.rotate ? { transform: `rotate(${page.rotate}deg)` } : undefined}
      />
      <button
        type="button"
        onPointerDown={stopDrag}
        onClick={(e) => { e.stopPropagation(); onExpand(); }}
        className="absolute inset-0 hidden place-items-center bg-black/25 text-white group-hover:grid"
        aria-label="View larger"
      >
        <svg className="h-5 w-5 drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
      </button>
      {scanning && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-[scanline_1.1s_ease-in-out_infinite] bg-gradient-to-b from-purple-400/70 to-transparent" />
      )}
      <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
      {page.status === 'ready' && page.result && (
        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-green-500 text-white">
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
      )}
      <button
        type="button"
        onPointerDown={stopDrag}
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
        aria-label="Remove page"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      {page.result && (
        <button
          type="button"
          onPointerDown={stopDrag}
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="absolute bottom-1 left-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
          aria-label="Download page"
        >
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
        </button>
      )}
    </div>
  );
}

/* ---------------- main ---------------- */

const DocumentScanner = () => {
  const [pages, setPages] = useState([]);
  const [selId, setSelId] = useState(null);
  const [runningAll, setRunningAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(null); // { name, done, total } while a PDF rasterises
  const [lightbox, setLightbox] = useState(null); // { src, caption } | null
  const [error, setError] = useState(null);

  // drag-to-reorder the filmstrip — the output PDF / ZIP follows this order
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    setPages((ps) => {
      const from = ps.findIndex((p) => p.id === active.id);
      const to = ps.findIndex((p) => p.id === over.id);
      return from < 0 || to < 0 ? ps : arrayMove(ps, from, to);
    });
  };

  const urlBag = useRef([]);
  const pagesRef = useRef([]);
  const registerBack = useContext(ToolBackContext);

  useEffect(() => { pagesRef.current = pages; }, [pages]);

  // The scan engine (OpenCV, ~9 MB) is loaded only when the user asks for a
  // scan or an auto-detect — unpacking it freezes the page for a moment, so it
  // must never happen on its own. (Hovering a Scan button starts it early.)
  const [cvState, setCvState] = useState('idle'); // idle | loading | ready
  const ensureCv = async () => {
    if (cvState !== 'ready') setCvState('loading');
    await getCv();
    setCvState('ready');
  };
  useEffect(() => () => urlBag.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const sel = pages.find((p) => p.id === selId) || null;
  const scannedCount = pages.filter((p) => p.result).length;

  const patch = (id, up) => setPages((ps) => ps.map((p) => (p.id === id ? { ...p, ...up } : p)));

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(pages.length ? () => reset() : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, pages.length]);

  const reset = () => {
    urlBag.current.forEach((u) => URL.revokeObjectURL(u));
    urlBag.current = [];
    setPages([]); setSelId(null); setError(null); setRunningAll(false);
  };

  const makePage = (blob, name) => {
    const url = URL.createObjectURL(blob);
    urlBag.current.push(url);
    return { id: ++_seq, name, origUrl: url, srcUrl: url, rotate: 0, nat: null, corners: null, mode: 'auto', dewarp: true, status: 'pending', result: null };
  };

  const addFiles = async (files, preRejected = []) => {
    const { accepted, rejected } = screenFiles(files, { accept: 'image/*,application/pdf' });
    const msg = rejectionMessage([...preRejected, ...rejected]);
    const imgs = accepted.filter((f) => f.type.startsWith('image/'));
    const pdfs = accepted.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!imgs.length && !pdfs.length) {
      setError(msg || 'Add photos or a PDF.');
      return;
    }
    setError(msg || null);

    if (imgs.length) {
      const next = imgs.map((f) => makePage(f, f.name));
      setPages((ps) => [...ps, ...next]);
      setSelId((cur) => cur ?? next[0].id);
    }

    for (const file of pdfs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { openPdf, renderPageToCanvas } = await import('../../../lib/pdfjs');
        // eslint-disable-next-line no-await-in-loop
        const doc = await openPdf(await file.arrayBuffer());
        const base = stripExt(file.name) || 'pdf';
        const total = Math.min(doc.numPages, MAX_PDF_PAGES);
        if (doc.numPages > MAX_PDF_PAGES) {
          setError(`"${file.name}" has ${doc.numPages} pages — only the first ${MAX_PDF_PAGES} were loaded.`);
        }
        setImporting({ name: file.name, done: 0, total });
        for (let n = 1; n <= total; n += 1) {
          // eslint-disable-next-line no-await-in-loop
          const pg = await doc.getPage(n);
          const vp = pg.getViewport({ scale: 1 });
          const scale = Math.min(4, Math.max(1.6, 1800 / Math.max(vp.width, vp.height)));
          // eslint-disable-next-line no-await-in-loop
          const canvas = await renderPageToCanvas(doc, n, { scale });
          // eslint-disable-next-line no-await-in-loop
          const blob = await new Promise((r) => canvas.toBlob((b) => r(b), 'image/jpeg', 0.92));
          const page = makePage(blob, `${base}-p${String(n).padStart(2, '0')}`);
          setPages((ps) => [...ps, page]);
          setSelId((cur) => cur ?? page.id);
          setImporting((s) => (s ? { ...s, done: n } : s));
        }
        doc.destroy?.();
      } catch {
        setError(`Could not read ${file.name}.`);
      }
    }
    setImporting(null);
  };

  // New pages: measure the photo and put an adjustable frame on it straight
  // away. No automatic edge detection — the user sets the frame (or presses
  // Auto-detect) and then scans.
  useEffect(() => {
    const fresh = pages.filter((p) => p.status === 'pending');
    if (!fresh.length) return;
    fresh.forEach((p) => patch(p.id, { status: 'measuring' }));
    fresh.forEach(async (p) => {
      try {
        const im = new Image();
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = p.srcUrl; });
        const nat = { w: im.naturalWidth, h: im.naturalHeight };
        patch(p.id, { nat, corners: p.corners || frameFor(nat), status: 'review' });
      } catch {
        patch(p.id, { status: 'error' });
      }
    });
  }, [pages]); // eslint-disable-line react-hooks/exhaustive-deps

  // The photo as the user turned it, at scan resolution — built only when a
  // scan or auto-detect actually runs. `k` maps frame coordinates onto it.
  const scanSource = async (page) => {
    if (!page.rotate) return { url: page.srcUrl, k: 1 };
    // re-scans (e.g. switching Auto -> B&W) reuse the copy for this rotation
    if (page.scanSrc?.rotate === page.rotate) return page.scanSrc;
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = page.srcUrl;
    });
    const k = Math.min(1, SCAN_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * k);
    const h = Math.round(img.naturalHeight * k);
    const turned = page.rotate % 180 !== 0;
    const c = document.createElement('canvas');
    c.width = turned ? h : w;
    c.height = turned ? w : h;
    const ctx = c.getContext('2d');
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((page.rotate * Math.PI) / 180);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.92));
    const url = URL.createObjectURL(blob);
    urlBag.current.push(url);
    const built = { rotate: page.rotate, url, k };
    patch(page.id, { scanSrc: built });
    return built;
  };

  // optional helper: let the detector find the page edges for the selected page
  const autoDetect = async (page, ai) => {
    patch(page.id, { status: ai ? 'ai' : 'detecting', result: null });
    let c = null;
    try {
      await ensureCv();
      const { url, k } = await scanSource(page);
      try { c = ai ? await detectDocumentAI(url) : await detectDocument(url); } catch { /* ignore */ }
      if (!c && ai) { try { c = await detectDocument(url); } catch { /* ignore */ } }
      if (c) c = c.map((pt) => ({ x: pt.x / k, y: pt.y / k }));
    } catch { /* fall through to the message */ }
    if (!c) setError('Couldn’t find the page edges automatically — drag the frame onto the page instead.');
    else setError(null);
    patch(page.id, { corners: c || page.corners, status: 'review' });
  };

  const runOne = async (page, mode = page.mode) => {
    if (!page.corners) return;
    patch(page.id, { status: 'scanning' });
    try {
      await ensureCv();
      const { url, k } = await scanSource(page);
      const corners = page.corners.map((pt) => ({ x: pt.x * k, y: pt.y * k }));
      const { blob, width, height } = await scanPage(url, corners, mode, { dewarp: page.dewarp !== false });
      const out = URL.createObjectURL(blob);
      urlBag.current.push(out);
      patch(page.id, { status: 'ready', mode, result: { url: out, blob, width, height } });
    } catch (e) {
      patch(page.id, { status: 'error' });
      setError(e?.message || 'Could not scan this page.');
    }
  };

  // rotate a page: instant — the photo is turned on screen and the frame is
  // turned with it; the real rotation happens once, at scan time.
  const rotatePage = (page, delta) => {
    if (!page.nat) return;
    const rotate = ((((page.rotate || 0) + delta) % 360) + 360) % 360;
    const { w, h } = dispOf(page);
    const corners = page.corners
      ? orderCorners(page.corners.map((pt) => (delta > 0 ? { x: h - pt.y, y: pt.x } : { x: pt.y, y: w - pt.x })))
      : null;
    patch(page.id, { rotate, corners, result: null, status: 'review' });
  };

  const scanAll = async () => {
    setRunningAll(true);
    setError(null);
    const ids = pagesRef.current.map((p) => p.id);
    const cur = (id) => pagesRef.current.find((x) => x.id === id);
    for (const id of ids) {
      // wait until detection has settled for this page
      // eslint-disable-next-line no-await-in-loop
      while (['pending', 'measuring', 'detecting', 'ai'].includes(cur(id)?.status)) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 150));
      }
      const p = cur(id);
      if (p?.corners && !p.result) {
        // eslint-disable-next-line no-await-in-loop
        await runOne(p);
      }
    }
    setRunningAll(false);
  };

  const exportPdf = async () => {
    const done = pages.filter((p) => p.result);
    if (!done.length) return;
    setExporting(true);
    try {
      const toDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
      const pdfPages = [];
      for (const p of done) {
        // eslint-disable-next-line no-await-in-loop
        pdfPages.push({ dataUrl: await toDataUrl(p.result.blob) });
      }
      const pdf = await imagesToPdf(pdfPages, { pageSize: 'a4', orientation: 'auto', marginMm: 6, fit: 'contain', bg: '#ffffff' });
      downloadBlob(pdf, toolFileName(done[0]?.name || 'scan', 'document-scanner', 'pdf'));
    } finally {
      setExporting(false);
    }
  };

  const downloadOne = (page) => {
    if (!page.result) return;
    const ext = page.result.blob.type === 'image/png' ? 'png' : 'jpg';
    const i = pages.findIndex((p) => p.id === page.id) + 1;
    downloadBlob(page.result.blob, toolFileName(page.name || 'scan', 'document-scanner', ext, String(i).padStart(2, '0')));
  };

  const exportZip = async () => {
    const done = pages.filter((p) => p.result);
    if (!done.length) return;
    setExporting(true);
    try {
      const ext = (b) => (b.type === 'image/png' ? 'png' : 'jpg');
      const zip = await zipFiles(done.map((p, i) => ({ name: toolFileName(p.name || 'scan', 'document-scanner', ext(p.result.blob), i + 1), blob: p.result.blob })));
      downloadBlob(zip, toolFileName(done[0]?.name || 'scan', 'document-scanner', 'zip'));
    } finally {
      setExporting(false);
    }
  };

  /* ---- upload screen ---- */
  if (!pages.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <FileDropzone
          accept="image/*,application/pdf"
          multiple
          onFiles={addFiles}
          title="Drop photos or a PDF"
          hint="one or many — receipts, IDs, forms, notes, or a whole PDF to re-scan"
          formats="JPG · PNG · WebP · PDF up to 50 MB — straightened and cleaned up right here in your browser"
        />
        {importing && (
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-gray-400">
            Reading {importing.name} — page {importing.done} of {importing.total}…
          </p>
        )}
        {error && <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  const anyResult = scannedCount > 0;

  return (
    <div className="space-y-4">
      <style>{'@keyframes scanline{0%{transform:translateY(-100%)}100%{transform:translateY(1100%)}}'}</style>

      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
          <span className="font-semibold text-gray-800 dark:text-gray-200">{pages.length} page{pages.length > 1 ? 's' : ''}</span>
          {anyResult && <span>· {scannedCount} scanned</span>}
          <label className="ml-1 cursor-pointer font-medium text-purple-600 hover:underline dark:text-purple-400">
            + Add
            <input type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
          </label>
          {importing && (
            <span className="text-purple-600 dark:text-purple-400">· reading PDF {importing.done}/{importing.total}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scanAll}
            onPointerEnter={preloadCv}
            onFocus={preloadCv}
            disabled={runningAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-60"
          >
            {runningAll ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2M4 12h16" /></svg>
            )}
            {runningAll ? (cvState === 'loading' ? 'Preparing scanner…' : 'Scanning…') : anyResult ? 'Re-scan all' : 'Scan all'}
          </button>
        </div>
      </div>

      {/* filmstrip — drag a page to reorder; the exported PDF / ZIP follows this order */}
      {pages.length > 1 && (
        <p className="text-[12px] text-gray-400 dark:text-gray-500">Drag a page to reorder it</p>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={pages.map((p) => p.id)} strategy={horizontalListSortingStrategy}>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <PageThumb
                key={p.id}
                page={p}
                index={i}
                active={p.id === selId}
                onClick={() => setSelId(p.id)}
                onExpand={() => setLightbox({ src: p.result?.url || p.srcUrl, caption: p.name })}
                onDownload={() => downloadOne(p)}
                onRemove={() => {
                  setPages((ps) => ps.filter((x) => x.id !== p.id));
                  setSelId((cur) => (cur === p.id ? (pages.find((x) => x.id !== p.id)?.id ?? null) : cur));
                }}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* editor */}
      {sel && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                title={m.hint}
                onClick={() => { patch(sel.id, { mode: m.key }); if (sel.result) runOne(sel, m.key); }}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                  sel.mode === m.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700'
                }`}
              >
                {m.label}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <button
              type="button"
              title="Let FileQuick look for the page edges in this photo"
              onClick={() => autoDetect(sel, false)}
              className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Auto-detect
            </button>
            <button
              type="button"
              title="Smart edge finding for cluttered or low-contrast photos"
              onClick={() => autoDetect(sel, true)}
              className="inline-flex items-center gap-1 rounded-lg bg-purple-50 px-2.5 py-1 text-[12px] font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-500/15 dark:text-purple-300"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l1.4 3.6L10 8 6.4 9.4 5 13 3.6 9.4 0 8l3.6-1.4z" /></svg>
              AI detect
            </button>
            <button
              type="button"
              onClick={() => sel.nat && patch(sel.id, { corners: frameFor(dispOf(sel)), result: null, status: 'review' })}
              className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Reset frame
            </button>
            <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <button
              type="button"
              title="Rotate left"
              onClick={() => rotatePage(sel, -90)}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v6h6M21 17a9 9 0 00-15-6.7L3 13" /></svg>
            </button>
            <button
              type="button"
              title="Rotate right"
              onClick={() => rotatePage(sel, 90)}
              className="grid h-7 w-7 place-items-center rounded-lg bg-white text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7v6h-6M3 17a9 9 0 0115-6.7L21 13" /></svg>
            </button>
            <span className="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600" />
            <label
              title="Straightens text lines on a curled or folded page"
              className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              <input
                type="checkbox"
                checked={sel.dewarp !== false}
                onChange={(e) => {
                  const dewarp = e.target.checked;
                  patch(sel.id, { dewarp });
                  if (sel.result) runOne({ ...sel, dewarp });
                }}
                className="h-3.5 w-3.5 accent-purple-600"
              />
              Fix bent page
            </label>
          </div>

          <div className="flex items-center justify-center rounded-xl bg-checkered p-2">
            {sel.result ? (
              <motion.img
                key={sel.result.url}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                src={sel.result.url}
                alt=""
                title="Click to view larger"
                onClick={() => setLightbox({ src: sel.result.url, caption: `${sel.name} · ${sel.result.width}×${sel.result.height}` })}
                className="max-h-[58vh] w-auto max-w-full cursor-zoom-in rounded-lg shadow-md"
              />
            ) : sel.corners && sel.nat ? (
              <QuadEditor
                rotate={sel.rotate || 0}
                src={sel.srcUrl}
                corners={sel.corners}
                nat={dispOf(sel)}
                onChange={(c) => patch(sel.id, { corners: c, status: 'review' })}
              />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                {sel.status === 'ai' ? 'AI is finding the page…' : sel.status === 'detecting' ? 'Finding the page…' : 'Loading…'}
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {sel.result
                ? 'Scanned — tap a mode to re-run, or edit the frame.'
                : 'Rotate if needed, then drag the corners or side bars onto the page edges and press Scan.'}
            </p>
            <div className="flex gap-2">
              {sel.result && (
                <>
                  <button
                    type="button"
                    onClick={() => downloadOne(sel)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:border-purple-300 dark:border-gray-700 dark:text-gray-200"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
                    Download page
                  </button>
                  <button
                    type="button"
                    onClick={() => patch(sel.id, { result: null, status: 'review' })}
                    className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    Edit frame
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => runOne(sel)}
                onPointerEnter={preloadCv}
                onFocus={preloadCv}
                disabled={!sel.corners || sel.status === 'scanning'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
              >
                {sel.status === 'scanning' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {sel.status === 'scanning'
                  ? (cvState === 'loading' ? 'Preparing scanner…' : 'Scanning…')
                  : sel.result ? 'Re-scan page' : 'Scan page'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* export */}
      <AnimatePresence>
        {anyResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="text-[13px] font-medium text-gray-600 dark:text-gray-300">
              {scannedCount} of {pages.length} pages ready
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={exportZip}
                disabled={exporting}
                className="rounded-xl border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700 hover:border-purple-300 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
              >
                Images (ZIP)
              </button>
              <button
                type="button"
                onClick={exportPdf}
                disabled={exporting}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-[13px] font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-60"
              >
                {exporting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                Download PDF
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}

      {lightbox && (
        <Lightbox src={lightbox.src} caption={lightbox.caption} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
};

export default DocumentScanner;

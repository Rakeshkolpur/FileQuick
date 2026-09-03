import React, { useContext, useEffect, useRef, useState } from 'react';
// eslint-disable-next-line no-unused-vars -- `motion` is used only as <motion.*> JSX
import { AnimatePresence, motion } from 'framer-motion';
import FileDropzone from '../../tool/FileDropzone';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { stripExt } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import { imagesToPdf } from '../../../lib/imagesToPdf';
import { preloadCv } from '../../../lib/opencvLoader';
import { detectDocument, defaultCorners, scanPage } from '../../../lib/scan';

const MODES = [
  { key: 'auto', label: 'Auto', hint: 'Flatten lighting, keep colour' },
  { key: 'bw', label: 'B&W', hint: 'Crisp black text on white' },
  { key: 'grey', label: 'Greyscale', hint: 'Neutral, softer' },
  { key: 'colour', label: 'Colour', hint: 'Full colour, cleaned' },
  { key: 'original', label: 'Original', hint: 'Just straighten it' },
];

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let _seq = 0;

/* ---------------- corner editor ---------------- */

function QuadEditor({ src, corners, nat, onChange }) {
  const wrapRef = useRef(null);
  const dragIdx = useRef(-1);

  // snap-in animation: the quad flies from the full frame onto the detected page
  const [intro, setIntro] = useState(corners);
  const introDone = useRef(false);
  useEffect(() => {
    const frame = [
      { x: 0, y: 0 }, { x: nat.w, y: 0 }, { x: nat.w, y: nat.h }, { x: 0, y: nat.h },
    ];
    const t0 = performance.now();
    const dur = 420;
    let raf;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - (1 - k) ** 3;
      setIntro(corners.map((c, i) => ({
        x: frame[i].x + (c.x - frame[i].x) * e,
        y: frame[i].y + (c.y - frame[i].y) * e,
      })));
      if (k < 1) raf = requestAnimationFrame(tick);
      else introDone.current = true;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // mount only — during drag we render `corners` directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const view = introDone.current ? corners : intro;

  const toPct = (p) => ({ x: (p.x / nat.w) * 100, y: (p.y / nat.h) * 100 });

  const move = (e) => {
    if (dragIdx.current < 0 || !wrapRef.current) return;
    introDone.current = true;
    const r = wrapRef.current.getBoundingClientRect();
    const x = clamp((e.clientX - r.left) / r.width, 0, 1) * nat.w;
    const y = clamp((e.clientY - r.top) / r.height, 0, 1) * nat.h;
    const next = corners.slice();
    next[dragIdx.current] = { x, y };
    onChange(next);
  };
  const end = () => { dragIdx.current = -1; };

  return (
    <div
      ref={wrapRef}
      className="relative inline-block max-w-full select-none touch-none align-top"
      onPointerMove={move}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={end}
    >
      <img src={src} alt="" draggable={false} className="block max-h-[58vh] w-auto max-w-full rounded-lg" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <polygon
          points={view.map((c) => { const q = toPct(c); return `${q.x},${q.y}`; }).join(' ')}
          fill="rgba(139,92,246,0.14)"
          stroke="#8b5cf6"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {view.map((c, i) => {
        const q = toPct(c);
        return (
          <button
            key={i}
            type="button"
            aria-label={`Corner ${i + 1}`}
            onPointerDown={(e) => { dragIdx.current = i; e.currentTarget.setPointerCapture(e.pointerId); }}
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 border-white bg-purple-600 shadow-lg shadow-purple-600/40 active:cursor-grabbing active:scale-110"
            style={{ left: `${q.x}%`, top: `${q.y}%` }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- filmstrip thumb ---------------- */

function PageThumb({ page, active, index, onClick, onRemove }) {
  const scanning = page.status === 'detecting' || page.status === 'scanning';
  const thumb = page.result?.url || page.srcUrl;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      className={`group relative shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 ${
        active ? 'border-purple-600' : 'border-transparent hover:border-purple-300 dark:hover:border-purple-700'
      }`}
      onClick={onClick}
    >
      <img src={thumb} alt="" className="h-24 w-20 bg-gray-100 object-cover dark:bg-gray-800" />
      {scanning && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-8 animate-[scanline_1.1s_ease-in-out_infinite] bg-gradient-to-b from-purple-400/70 to-transparent" />
      )}
      <span className="absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{index + 1}</span>
      {page.status === 'ready' && page.result && (
        <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-green-500 text-white">
          <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </span>
      )}
      {page.status === 'review' && (
        <span className="absolute right-1 top-1 rounded bg-amber-500 px-1 text-[9px] font-bold text-white">edit</span>
      )}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute bottom-1 right-1 hidden rounded bg-black/60 p-0.5 text-white group-hover:block"
        aria-label="Remove page"
      >
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </motion.div>
  );
}

/* ---------------- main ---------------- */

const DocumentScanner = () => {
  const [pages, setPages] = useState([]);
  const [selId, setSelId] = useState(null);
  const [runningAll, setRunningAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const urlBag = useRef([]);
  const detecting = useRef(false);
  const pagesRef = useRef([]);
  const registerBack = useContext(ToolBackContext);

  useEffect(() => { pagesRef.current = pages; }, [pages]);

  useEffect(() => { preloadCv(); }, []);
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

  const addFiles = (files) => {
    const imgs = files.filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) { setError('Please choose photo files (JPG, PNG, WebP).'); return; }
    setError(null);
    const next = imgs.map((f) => {
      const url = URL.createObjectURL(f);
      urlBag.current.push(url);
      return { id: ++_seq, name: f.name, origUrl: url, srcUrl: url, rotate: 0, nat: null, corners: null, mode: 'auto', status: 'pending', result: null };
    });
    setPages((ps) => [...ps, ...next]);
    setSelId((cur) => cur ?? next[0].id);
  };

  // sequential detection queue
  useEffect(() => {
    if (detecting.current) return;
    const next = pages.find((p) => p.status === 'pending');
    if (!next) return;
    detecting.current = true;
    (async () => {
      patch(next.id, { status: 'detecting' });
      try {
        const im = new Image();
        await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = next.srcUrl; });
        const nat = { w: im.naturalWidth, h: im.naturalHeight };
        let corners = null;
        try { corners = await detectDocument(next.srcUrl); } catch { /* fall through */ }
        const auto = !!corners;
        if (!corners) corners = await defaultCorners(next.srcUrl);
        patch(next.id, { nat, corners, status: auto ? 'ready' : 'review' });
      } catch {
        patch(next.id, { status: 'error' });
      } finally {
        detecting.current = false;
        setPages((ps) => [...ps]); // nudge the effect to pick up the next one
      }
    })();
  }, [pages]);

  const runOne = async (page, mode = page.mode) => {
    if (!page.corners) return;
    patch(page.id, { status: 'scanning' });
    try {
      const { blob, width, height } = await scanPage(page.srcUrl, page.corners, mode);
      const url = URL.createObjectURL(blob);
      urlBag.current.push(url);
      patch(page.id, { status: 'ready', mode, result: { url, blob, width, height } });
    } catch (e) {
      patch(page.id, { status: 'error' });
      setError(e?.message || 'Could not scan this page.');
    }
  };

  // rotate a page: re-render the original at the new angle, then re-detect
  const rotatePage = async (page, delta) => {
    const rotate = (((page.rotate || 0) + delta) % 360 + 360) % 360;
    try {
      const img = await new Promise((res, rej) => {
        const im = new Image();
        im.onload = () => res(im);
        im.onerror = rej;
        im.src = page.origUrl;
      });
      const swap = rotate % 180 !== 0;
      const c = document.createElement('canvas');
      c.width = swap ? img.naturalHeight : img.naturalWidth;
      c.height = swap ? img.naturalWidth : img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate((rotate * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.92));
      const url = URL.createObjectURL(blob);
      urlBag.current.push(url);
      patch(page.id, { srcUrl: url, rotate, nat: { w: c.width, h: c.height }, corners: null, result: null, status: 'pending' });
    } catch {
      setError('Could not rotate this page.');
    }
  };

  const scanAll = async () => {
    setRunningAll(true);
    setError(null);
    const ids = pagesRef.current.map((p) => p.id);
    const cur = (id) => pagesRef.current.find((x) => x.id === id);
    for (const id of ids) {
      // wait until detection has settled for this page
      // eslint-disable-next-line no-await-in-loop
      while (['pending', 'detecting'].includes(cur(id)?.status)) {
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
      downloadBlob(pdf, 'scan.pdf');
    } finally {
      setExporting(false);
    }
  };

  const exportZip = async () => {
    const done = pages.filter((p) => p.result);
    if (!done.length) return;
    setExporting(true);
    try {
      const ext = (b) => (b.type === 'image/png' ? 'png' : 'jpg');
      const zip = await zipFiles(done.map((p, i) => ({ name: `${stripExt(p.name) || 'scan'}-${i + 1}.${ext(p.result.blob)}`, blob: p.result.blob })));
      downloadBlob(zip, 'scans.zip');
    } finally {
      setExporting(false);
    }
  };

  /* ---- upload screen ---- */
  if (!pages.length) {
    return (
      <div className="mx-auto max-w-2xl">
        <FileDropzone
          accept="image/*"
          multiple
          onFiles={addFiles}
          title="Drop photos of your documents"
          hint="one or many — receipts, IDs, forms, notes"
          formats="JPG · PNG · WebP — straightened and cleaned up right here in your browser"
        />
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
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles([...e.target.files]); e.target.value = ''; }} />
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={scanAll}
            disabled={runningAll}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-[13px] font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110 disabled:opacity-60"
          >
            {runningAll ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2M4 12h16" /></svg>
            )}
            {runningAll ? 'Scanning…' : anyResult ? 'Re-scan all' : 'Scan all'}
          </button>
        </div>
      </div>

      {/* filmstrip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <AnimatePresence initial={false}>
          {pages.map((p, i) => (
            <PageThumb
              key={p.id}
              page={p}
              index={i}
              active={p.id === selId}
              onClick={() => setSelId(p.id)}
              onRemove={() => {
                setPages((ps) => ps.filter((x) => x.id !== p.id));
                setSelId((cur) => (cur === p.id ? (pages.find((x) => x.id !== p.id)?.id ?? null) : cur));
              }}
            />
          ))}
        </AnimatePresence>
      </div>

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
              onClick={async () => { patch(sel.id, { status: 'detecting' }); let c = null; try { c = await detectDocument(sel.srcUrl); } catch { /* ignore */ } patch(sel.id, { corners: c || await defaultCorners(sel.srcUrl), status: 'review' }); }}
              className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Re-detect edges
            </button>
            <button
              type="button"
              onClick={() => sel.corners && defaultCorners(sel.srcUrl).then((c) => patch(sel.id, { corners: c }))}
              className="rounded-lg bg-white px-2.5 py-1 text-[12px] font-medium text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Full page
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
          </div>

          <div className="flex items-center justify-center rounded-xl bg-checkered p-2">
            {sel.result ? (
              <motion.img
                key={sel.result.url}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                src={sel.result.url}
                alt=""
                className="max-h-[58vh] w-auto max-w-full rounded-lg shadow-md"
              />
            ) : sel.corners && sel.nat ? (
              <QuadEditor
                src={sel.srcUrl}
                corners={sel.corners}
                nat={sel.nat}
                onChange={(c) => patch(sel.id, { corners: c, status: 'review' })}
              />
            ) : (
              <div className="flex h-48 items-center justify-center gap-2 text-sm text-gray-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                Finding the page…
              </div>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {sel.result ? 'Scanned — tap a mode to re-run, or edit corners below.' : 'Drag the four corners onto the page edges.'}
            </p>
            <div className="flex gap-2">
              {sel.result && (
                <button
                  type="button"
                  onClick={() => patch(sel.id, { result: null, status: 'review' })}
                  className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Edit corners
                </button>
              )}
              <button
                type="button"
                onClick={() => runOne(sel)}
                disabled={!sel.corners || sel.status === 'scanning'}
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-purple-700 disabled:opacity-40"
              >
                {sel.status === 'scanning' && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                {sel.result ? 'Re-scan page' : 'Scan page'}
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
    </div>
  );
};

export default DocumentScanner;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, degrees } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const norm = (deg) => ((deg % 360) + 360) % 360;

const Ico = ({ d, className = 'h-4 w-4' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const RotL = (p) => <Ico d="M3 7v6h6M3 13a9 9 0 103-6.7L3 9" {...p} />;
const RotR = (p) => <Ico d="M21 7v6h-6M21 13a9 9 0 11-3-6.7L21 9" {...p} />;

const RotatePDF = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pages, setPages] = useState([]); // {index, thumb, w, h, rotation}
  const [selected, setSelected] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // {blob, size}
  const [error, setError] = useState(null);
  const [thumbW, setThumbW] = useState(150);

  const total = pages.length;
  const thumbToken = useRef(0);
  const lastClick = useRef(null);

  useEffect(() => { setResult(null); }, [pages]);

  const renderThumbs = useCallback(async (doc, token) => {
    for (let i = 1; i <= doc.numPages; i += 1) {
      if (token !== thumbToken.current) return;
      try {
        // eslint-disable-next-line no-await-in-loop
        const t = await renderThumbnail(doc, i, 300);
        if (token !== thumbToken.current) return;
        setPages((prev) => prev.map((p) => (p.index === i ? { ...p, thumb: t.dataUrl, w: t.width, h: t.height } : p)));
      } catch (_) { /* keep placeholder */ }
    }
  }, []);

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    setSelected(new Set());
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab);
      setFile(f);
      setBytes(ab);
      setPages(Array.from({ length: doc.numPages }, (_, i) => ({ index: i + 1, thumb: null, w: 0, h: 0, rotation: 0 })));
      const token = ++thumbToken.current;
      renderThumbs(doc, token);
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
    } finally {
      setLoading(false);
    }
  }, [renderThumbs]);

  const reset = () => {
    thumbToken.current += 1;
    setFile(null); setBytes(null); setPages([]); setSelected(new Set());
    setResult(null); setError(null);
  };
  const backFromResult = () => setResult(null);

  /* ---- selection ---- */
  const allIdx = useMemo(() => pages.map((p) => p.index), [pages]);
  const toggle = (page, e) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e?.shiftKey && lastClick.current != null) {
        const a = Math.min(lastClick.current, page);
        const b = Math.max(lastClick.current, page);
        const adding = !prev.has(page);
        for (let i = a; i <= b; i += 1) adding ? next.add(i) : next.delete(i);
      } else {
        next.has(page) ? next.delete(page) : next.add(page);
      }
      return next;
    });
    lastClick.current = page;
  };
  const selectAll = () => setSelected(new Set(allIdx));
  const selectNone = () => setSelected(new Set());
  const invert = () => setSelected((prev) => new Set(allIdx.filter((n) => !prev.has(n))));

  /* ---- rotation ops ---- */
  const rotate = (delta, onlyIdx) => {
    const targets = onlyIdx != null ? new Set([onlyIdx]) : (selected.size ? selected : new Set(allIdx));
    setPages((prev) => prev.map((p) => (targets.has(p.index) ? { ...p, rotation: norm(p.rotation + delta) } : p)));
  };
  const rotateLandscape = () => {
    setPages((prev) => prev.map((p) => {
      const w = p.w || 1; const h = p.h || 2;
      const swap = p.rotation === 90 || p.rotation === 270;
      const displayLandscape = swap ? h > w : w > h;
      return displayLandscape ? { ...p, rotation: norm(p.rotation + 90) } : p;
    }));
  };
  const resetRotations = () => setPages((prev) => prev.map((p) => ({ ...p, rotation: 0 })));

  const changed = pages.filter((p) => p.rotation !== 0).length;

  const apply = async () => {
    if (!changed) { setError('Rotate at least one page first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(bytes);
      const docPages = doc.getPages();
      pages.forEach((p) => {
        if (p.rotation === 0) return;
        const pg = docPages[p.index - 1];
        const base = pg.getRotation().angle || 0;
        pg.setRotation(degrees(norm(base + p.rotation)));
      });
      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size });
    } catch (e) {
      setError(`Could not rotate the PDF: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-rotated.pdf`;

  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  const scope = selected.size ? `${selected.size} selected` : 'all pages';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatBytes(file?.size)} · {total} page{total === 1 ? '' : 's'}
        </p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rotate</h3>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">{scope}</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => rotate(-90)} className={btn}><RotL className="h-3.5 w-3.5" /> Left 90°</button>
          <button type="button" onClick={() => rotate(90)} className={btn}><RotR className="h-3.5 w-3.5" /> Right 90°</button>
          <button type="button" onClick={() => rotate(180)} className={`${btn} col-span-2`}>Flip 180°</button>
        </div>
        <button type="button" onClick={rotateLandscape} className={`${btn} w-full`} disabled={!total}>
          Turn sideways pages upright
        </button>
        <button type="button" onClick={resetRotations} className={`${btn} w-full`} disabled={!changed}>
          Reset all rotations
        </button>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Selection</h3>
          <span className="text-xs text-gray-400">{selected.size} selected</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={selectAll} className={btn} disabled={!total}>All</button>
          <button type="button" onClick={invert} className={btn} disabled={!total}>Invert</button>
          <button type="button" onClick={selectNone} className={btn} disabled={!selected.size}>None</button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Nothing selected → the rotate buttons act on every page. Shift-click for a range.
        </p>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <RangeSlider label="Thumbnail size" value={thumbW} min={90} max={230} step={10} onChange={setThumbW} suffix="px" />
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={apply}
      disabled={!changed || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Rotating…' : changed ? `Save rotated PDF · ${changed} page${changed > 1 ? 's' : ''}` : 'Rotate a page first'}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Your PDF is rotated"
      workingLabel="Applying rotation…"
      subtitle={result ? `${changed} page${changed > 1 ? 's' : ''} turned · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to pages"
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — turn pages 90° / 180°, save"
      dropTitle="Drop a PDF to rotate"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {changed} of {total} page{total === 1 ? '' : 's'} rotated
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Hover a page for its own rotate buttons · click to select.</p>
        </div>
      </div>

      {loading && pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Reading PDF…
        </div>
      ) : (
        <div className="flex flex-wrap gap-3 content-start">
          {pages.map((p) => {
            const on = selected.has(p.index);
            const w = p.w || 1;
            const h = p.h || Math.SQRT2;
            const swap = p.rotation === 90 || p.rotation === 270;
            const frameAspect = swap ? h / w : w / h;
            return (
              <button
                type="button"
                key={p.index}
                onClick={(e) => toggle(p.index, e)}
                style={{ width: thumbW }}
                className={`group relative shrink-0 rounded-xl border bg-white dark:bg-gray-800 p-2 select-none transition-shadow text-left ${
                  on
                    ? 'border-purple-500 ring-2 ring-purple-500/40'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:shadow-md'
                }`}
              >
                <div
                  className="relative w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900 ring-1 ring-black/5"
                  style={{ aspectRatio: String(frameAspect) }}
                >
                  {p.thumb ? (
                    <img
                      src={p.thumb}
                      alt={`Page ${p.index}`}
                      draggable={false}
                      className="absolute inset-0 m-auto max-w-none transition-transform"
                      style={
                        swap
                          ? { height: `${frameAspect * 100}%`, width: 'auto', transform: `rotate(${p.rotation}deg)` }
                          : { width: '100%', height: 'auto', transform: `rotate(${p.rotation}deg)` }
                      }
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                  )}

                  <span
                    className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-md flex items-center justify-center text-white text-[11px] transition-colors ${
                      on ? 'bg-purple-600' : 'bg-black/30 group-hover:bg-black/50'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>

                  {p.rotation !== 0 && (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-purple-600 text-white text-[10px] px-1 py-0.5 font-medium">
                      {p.rotation}°
                    </span>
                  )}

                  <div
                    className="absolute bottom-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span
                      role="button"
                      tabIndex={0}
                      title="Rotate left"
                      onClick={() => rotate(-90, p.index)}
                      className="h-6 w-6 flex items-center justify-center rounded bg-black/55 text-white hover:bg-black/75 cursor-pointer"
                    >
                      <RotL className="h-3.5 w-3.5" />
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      title="Rotate right"
                      onClick={() => rotate(90, p.index)}
                      className="h-6 w-6 flex items-center justify-center rounded bg-black/55 text-white hover:bg-black/75 cursor-pointer"
                    >
                      <RotR className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>

                <div className="mt-1.5 text-center text-[11px] font-semibold text-gray-600 dark:text-gray-300">{p.index}</div>
              </button>
            );
          })}
        </div>
      )}
    </ToolWorkspace>
  );
};

export default RotatePDF;

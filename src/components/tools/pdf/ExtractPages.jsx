import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';
import { parsePageRange, formatPageRange } from '../../../lib/pageRange';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

const ExtractPages = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pages, setPages] = useState([]); // { index, thumb, w, h }
  const [keep, setKeep] = useState(() => new Set()); // 1-based page numbers
  const [rangeText, setRangeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, size, count }
  const [error, setError] = useState(null);
  const [thumbW, setThumbW] = useState(150);

  const total = pages.length;
  const thumbToken = useRef(0);
  const lastClick = useRef(null);
  const rangeDirty = useRef(false);

  // Keep the range text box in sync with the checkboxes (unless the user is typing).
  useEffect(() => {
    if (!rangeDirty.current) setRangeText(formatPageRange([...keep]));
  }, [keep]);

  useEffect(() => { setResult(null); }, [keep]);

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
    setKeep(new Set());
    setRangeText('');
    rangeDirty.current = false;
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab);
      setFile(f);
      setBytes(ab);
      setPages(Array.from({ length: doc.numPages }, (_, i) => ({ index: i + 1, thumb: null, w: 0, h: 0 })));
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
    setFile(null); setBytes(null); setPages([]); setKeep(new Set());
    setRangeText(''); setResult(null); setError(null);
    rangeDirty.current = false;
  };

  const toggle = (page, e) => {
    rangeDirty.current = false;
    setKeep((prev) => {
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

  const allPages = useMemo(() => pages.map((p) => p.index), [pages]);
  const selectAll = () => { rangeDirty.current = false; setKeep(new Set(allPages)); };
  const selectNone = () => { rangeDirty.current = false; setKeep(new Set()); };
  const invert = () => { rangeDirty.current = false; setKeep((prev) => new Set(allPages.filter((n) => !prev.has(n)))); };

  const onRangeChange = (v) => {
    rangeDirty.current = true;
    setRangeText(v);
    setKeep(new Set(parsePageRange(v, total)));
  };
  const onRangeBlur = () => { rangeDirty.current = false; };

  const kept = useMemo(() => [...keep].sort((a, b) => a - b), [keep]);

  const build = async () => {
    if (!kept.length) return;
    setBusy(true);
    setError(null);
    try {
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, kept.map((n) => n - 1));
      copied.forEach((pg) => out.addPage(pg));
      const outBytes = await out.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, count: kept.length });
    } catch (e) {
      setError(`Could not build the PDF: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-pages.pdf`;

  const backFromResult = () => setResult(null);

  const primaryLabel = kept.length
    ? `Extract ${kept.length} page${kept.length > 1 ? 's' : ''}`
    : 'Select pages to extract';

  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

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
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">Pages to keep</label>
        <input
          type="text"
          value={rangeText}
          onChange={(e) => onRangeChange(e.target.value)}
          onBlur={onRangeBlur}
          placeholder="e.g. 1-3, 5, 8-10"
          className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={selectAll} className={btn} disabled={!total}>All</button>
          <button type="button" onClick={invert} className={btn} disabled={!total}>Invert</button>
          <button type="button" onClick={selectNone} className={btn} disabled={!keep.size}>None</button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Click a page to keep it · shift-click for a range. Kept pages stay in their original order.
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
      onClick={build}
      disabled={!kept.length || busy}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {primaryLabel}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Your PDF is ready"
      workingLabel="Building your PDF…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to page selection"
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — choose the pages to keep as a new file"
      dropTitle="Drop a PDF"
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
            {kept.length} of {total} page{total === 1 ? '' : 's'} selected
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">Click pages to keep them in the new PDF.</p>
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
            const on = keep.has(p.index);
            const aspect = (p.w || 1) / (p.h || Math.SQRT2);
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
                  style={{ aspectRatio: String(aspect) }}
                >
                  {p.thumb ? (
                    <img src={p.thumb} alt={`Page ${p.index}`} draggable={false} className="absolute inset-0 w-full h-full object-contain" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-6 w-6 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                    </div>
                  )}
                  <span
                    className={`absolute top-1.5 left-1.5 h-5 w-5 rounded-md flex items-center justify-center text-white text-[11px] transition-colors ${
                      on ? 'bg-purple-600' : 'bg-black/30 group-hover:bg-black/50'
                    }`}
                  >
                    {on ? '✓' : ''}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                  <span className="font-semibold text-gray-700 dark:text-gray-200">Page {p.index}</span>
                  {on && <span className="text-purple-600 dark:text-purple-400">keep</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </ToolWorkspace>
  );
};

export default ExtractPages;

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { PDFDocument } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const clampPct = (v) => Math.max(0, Math.min(100, v));
const FULL = { unit: '%', x: 0, y: 0, width: 100, height: 100 };
// a crop that actually trims something
const isTrimmed = (c) => !!c && (c.x > 0.5 || c.y > 0.5 || c.width < 99.5 || c.height < 99.5) && c.width > 2 && c.height > 2;

/** Content bounding box (%) of a rendered page — non-near-white pixels. */
const contentBox = (canvas, pad = 0.01) => {
  const { width: W, height: H } = canvas;
  const d = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  let minX = W; let minY = H; let maxX = 0; let maxY = 0; let found = false;
  const step = Math.max(1, Math.round(Math.min(W, H) / 700));
  for (let y = 0; y < H; y += step) {
    for (let x = 0; x < W; x += step) {
      const i = (y * W + x) * 4;
      if (d[i] < 244 || d[i + 1] < 244 || d[i + 2] < 244) {
        found = true;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (!found) return { ...FULL };
  return {
    unit: '%',
    x: clampPct((minX / W - pad) * 100),
    y: clampPct((minY / H - pad) * 100),
    width: clampPct(((maxX - minX) / W + 2 * pad) * 100),
    height: clampPct(((maxY - minY) / H + 2 * pad) * 100),
  };
};

const CropPDF = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(1);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [crops, setCrops] = useState({}); // { [pageNum]: crop }
  const [loading, setLoading] = useState(false);
  const [autoAllBusy, setAutoAllBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const renderTok = useRef(0);
  const lastCanvas = useRef(null);

  useEffect(() => { setResult(null); }, [crops]);

  const currentCrop = crops[previewIdx] || FULL;
  const setCurrentCrop = (c) => setCrops((prev) => ({ ...prev, [previewIdx]: { unit: '%', ...c } }));

  const loadPreview = useCallback(async (doc, idx) => {
    const tok = ++renderTok.current;
    try {
      const canvas = await renderPageToCanvas(doc, idx, { scale: 1.6 });
      if (tok !== renderTok.current) return;
      lastCanvas.current = canvas;
      setPreviewUrl(canvas.toDataURL('image/jpeg', 0.82));
    } catch (_) { /* ignore */ }
  }, []);

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    setCrops({});
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab);
      setFile(f);
      setBytes(ab);
      setPdf(doc);
      setPageCount(doc.numPages);
      setPreviewIdx(1);
      await loadPreview(doc, 1);
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  const reset = () => {
    renderTok.current += 1;
    setFile(null); setBytes(null); setPdf(null); setPageCount(0);
    setPreviewUrl(null); setResult(null); setError(null); setCrops({});
  };
  const backFromResult = () => setResult(null);

  const gotoPage = async (idx) => {
    const n = Math.max(1, Math.min(pageCount, idx));
    setPreviewIdx(n);
    if (pdf) await loadPreview(pdf, n);
  };

  const autoTrimPage = () => {
    if (!lastCanvas.current) return;
    setCurrentCrop(contentBox(lastCanvas.current));
  };

  const autoTrimAll = async () => {
    if (!pdf) return;
    setAutoAllBusy(true);
    try {
      const next = {};
      for (let i = 1; i <= pageCount; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const canvas = await renderPageToCanvas(pdf, i, { scale: 1.3 });
        const box = contentBox(canvas);
        if (isTrimmed(box)) next[i] = box;
      }
      setCrops(next);
      if (lastCanvas.current) { /* keep current preview */ }
    } finally {
      setAutoAllBusy(false);
    }
  };

  const copyToAll = () => {
    const c = crops[previewIdx];
    if (!isTrimmed(c)) return;
    const next = {};
    for (let i = 1; i <= pageCount; i += 1) next[i] = { unit: '%', x: c.x, y: c.y, width: c.width, height: c.height };
    setCrops(next);
  };

  const resetPage = () => setCrops((prev) => {
    const n = { ...prev }; delete n[previewIdx]; return n;
  });
  const resetAll = () => setCrops({});

  const croppedPages = useMemo(
    () => Object.keys(crops).map(Number).filter((k) => isTrimmed(crops[k])).sort((a, b) => a - b),
    [crops],
  );

  const apply = async () => {
    if (!croppedPages.length) { setError('Draw a crop area on at least one page.'); return; }
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(bytes);
      const docPages = doc.getPages();
      croppedPages.forEach((num) => {
        const c = crops[num];
        const pg = docPages[num - 1];
        if (!pg) return;
        let ref;
        try { ref = pg.getCropBox(); } catch (_) { ref = undefined; }
        if (!ref || !ref.width) ref = { x: 0, y: 0, width: pg.getWidth(), height: pg.getHeight() };
        const fx = c.x / 100; const fy = c.y / 100; const fw = c.width / 100; const fh = c.height / 100;
        pg.setCropBox(
          ref.x + fx * ref.width,
          ref.y + (1 - fy - fh) * ref.height, // screen top-down → PDF bottom-up
          fw * ref.width,
          fh * ref.height,
        );
      });
      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, count: croppedPages.length });
    } catch (e) {
      setError(`Could not crop the PDF: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-cropped.pdf`;
  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';
  const thisTrimmed = isTrimmed(crops[previewIdx]);

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
          {formatBytes(file?.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}
        </p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Page {previewIdx}</h3>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {thisTrimmed
            ? `Keeping ${Math.round(crops[previewIdx].width)}% × ${Math.round(crops[previewIdx].height)}% of this page.`
            : 'Drag on the page to crop it. Each page keeps its own box.'}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={autoTrimPage} className={btn} disabled={!previewUrl}>Auto-trim</button>
          <button type="button" onClick={resetPage} className={btn} disabled={!crops[previewIdx]}>Reset page</button>
        </div>
        <button type="button" onClick={copyToAll} className={`${btn} w-full`} disabled={!thisTrimmed || pageCount < 2}>
          Use this crop on every page
        </button>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">All pages</h3>
        <button type="button" onClick={autoTrimAll} className={`${btn} w-full`} disabled={autoAllBusy || !pdf}>
          {autoAllBusy ? 'Scanning pages…' : 'Auto-trim every page'}
        </button>
        <button type="button" onClick={resetAll} className={`${btn} w-full`} disabled={!croppedPages.length}>
          Clear all crops
        </button>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {croppedPages.length
            ? `Will crop ${croppedPages.length} page${croppedPages.length > 1 ? 's' : ''}: ${croppedPages.slice(0, 12).join(', ')}${croppedPages.length > 12 ? '…' : ''}. Untouched pages are left as they are.`
            : 'Only the pages you crop are changed — the rest stay full size.'}
        </p>
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
      disabled={!croppedPages.length || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Cropping…' : croppedPages.length ? `Crop ${croppedPages.length} page${croppedPages.length === 1 ? '' : 's'}` : 'Crop a page first'}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Your PDF is cropped"
      workingLabel="Cropping your PDF…"
      subtitle={result ? `${result.count} page${result.count > 1 ? 's' : ''} cropped · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to the pages"
      note="Cropping changes the visible page box — the original content is still in the file."
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — trim each page's margins / box"
      dropTitle="Drop a PDF to crop"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Cropping page {previewIdx}
          {thisTrimmed && <span className="ml-2 text-[11px] rounded bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5">custom crop</span>}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => gotoPage(previewIdx - 1)} disabled={previewIdx <= 1} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">‹</button>
            <span className="text-gray-500 dark:text-gray-400">{previewIdx} / {pageCount}</span>
            <button type="button" onClick={() => gotoPage(previewIdx + 1)} disabled={previewIdx >= pageCount} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">›</button>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-gray-100 dark:bg-gray-900/40 p-3 sm:p-4 flex items-center justify-center min-h-[240px]">
        {loading && !previewUrl ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Reading PDF…
          </div>
        ) : previewUrl ? (
          <ReactCrop
            key={previewIdx}
            crop={currentCrop}
            onChange={(_, pct) => setCurrentCrop(pct)}
            keepSelection
            ruleOfThirds
            className="w-full max-w-[760px]"
          >
            <img src={previewUrl} alt={`Page ${previewIdx}`} className="w-full h-auto object-contain select-none" />
          </ReactCrop>
        ) : null}
      </div>

      {pageCount > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => gotoPage(n)}
              className={`h-7 min-w-7 px-1.5 rounded-md text-xs font-medium transition-colors ${
                n === previewIdx
                  ? 'bg-purple-600 text-white'
                  : isTrimmed(crops[n])
                    ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              title={isTrimmed(crops[n]) ? `Page ${n} — cropped` : `Page ${n}`}
            >
              {n}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Each page has its own crop box. Set page 1, click ›, set page 2 differently, and so on —
        or use “Use this crop on every page”.
      </p>
    </ToolWorkspace>
  );
};

export default CropPDF;

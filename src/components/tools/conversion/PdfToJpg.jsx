import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { PDF_RENDER_MB } from '../../../lib/fileValidation';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { zipFiles } from '../../../lib/zip';
import { openPdf, renderThumbnail, renderPageToCanvas } from '../../../lib/pdfjs';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

const RES = [
  { value: 1.5, label: 'Standard' },
  { value: 2.5, label: 'High' },
  { value: 4, label: 'Max' },
];

const PdfToJpg = () => {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // {index, thumb}
  const [selected, setSelected] = useState(() => new Set());
  const [format, setFormat] = useState('jpg'); // jpg | png
  const [quality, setQuality] = useState(92);
  const [scale, setScale] = useState(2.5);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // {done,total}
  const [results, setResults] = useState(null); // [{page,blob,url,name,size}]
  const [error, setError] = useState(null);

  const pdfRef = useRef(null);
  const thumbTok = useRef(0);
  const resultsRef = useRef(results);
  useEffect(() => { resultsRef.current = results; }, [results]);
  useEffect(() => () => {
    resultsRef.current?.forEach((r) => URL.revokeObjectURL(r.url));
    pdfRef.current?.destroy?.();
  }, []);

  useEffect(() => { setResults(null); }, [selected, format, quality, scale]);

  const renderThumbs = useCallback(async (pdf, tok) => {
    for (let i = 1; i <= pdf.numPages; i += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const t = await renderThumbnail(pdf, i, 200);
        if (tok !== thumbTok.current) return;
        setPages((prev) => prev.map((p) => (p.index === i ? { ...p, thumb: t.dataUrl } : p)));
      } catch { /* keep placeholder */ }
    }
  }, []);

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setLoading(true);
    setResults(null);
    try {
      const ab = await f.arrayBuffer();
      const pdf = await openPdf(ab);
      pdfRef.current?.destroy?.();
      pdfRef.current = pdf;
      setFile(f);
      setPages(Array.from({ length: pdf.numPages }, (_, i) => ({ index: i + 1, thumb: null })));
      setSelected(new Set(Array.from({ length: pdf.numPages }, (_, i) => i + 1)));
      const tok = ++thumbTok.current;
      renderThumbs(pdf, tok);
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

  useEffect(() => consumePdfHandoff((f) => onFiles([f]), 'document'), [onFiles]);

  const reset = () => {
    thumbTok.current += 1;
    pdfRef.current?.destroy?.();
    pdfRef.current = null;
    resultsRef.current?.forEach((r) => URL.revokeObjectURL(r.url));
    setFile(null); setPages([]); setSelected(new Set()); setResults(null); setError(null);
  };
  const backFromResult = () => setResults(null);

  const toggle = (i) => setSelected((s) => {
    const n = new Set(s);
    if (n.has(i)) n.delete(i); else n.add(i);
    return n;
  });
  const allSelected = pages.length > 0 && selected.size === pages.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(pages.map((p) => p.index)));

  const chosen = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  const base = stripExt(file?.name || 'document');
  const ext = format === 'png' ? 'png' : 'jpg';
  const mime = format === 'png' ? 'image/png' : 'image/jpeg';

  const run = async () => {
    if (!pdfRef.current || !chosen.length || busy) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: chosen.length });
    try {
      const out = [];
      for (let i = 0; i < chosen.length; i += 1) {
        const n = chosen[i];
        // eslint-disable-next-line no-await-in-loop
        const canvas = await renderPageToCanvas(pdfRef.current, n, { scale });
        // eslint-disable-next-line no-await-in-loop
        const blob = await new Promise((res) => canvas.toBlob(res, mime, format === 'jpg' ? quality / 100 : undefined));
        out.push({
          page: n, blob, size: blob.size,
          url: URL.createObjectURL(blob),
          name: `${base}-page-${String(n).padStart(2, '0')}.${ext}`,
        });
        setProgress({ done: i + 1, total: chosen.length });
      }
      setResults(out);
    } catch (e) {
      setError(e.message || 'Could not convert the PDF.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadAll = async () => {
    if (!results) return;
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = await zipFiles(results.map((r) => ({ name: r.name, blob: r.blob })));
    downloadBlob(zip, `${base}-images.zip`);
  };

  const totalSize = results ? results.reduce((s, r) => s + r.size, 0) : 0;

  const sidebar = (
    <>
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">Start over</button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {pages.length} page{pages.length === 1 ? '' : 's'} · {selected.size} selected
        </p>
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Format</span>
          <Segmented
            options={[{ value: 'jpg', label: 'JPG' }, { value: 'png', label: 'PNG' }]}
            value={format}
            onChange={setFormat}
          />
        </div>

        <div>
          <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Resolution</span>
          <Segmented options={RES} value={scale} onChange={setScale} />
          <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">Higher = sharper image, bigger file.</p>
        </div>

        {format === 'jpg' && (
          <RangeSlider label="Quality" value={quality} min={40} max={100} step={1} onChange={setQuality} suffix="%" />
        )}
      </section>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!chosen.length || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {busy ? 'Converting…' : chosen.length ? `Convert ${chosen.length} page${chosen.length > 1 ? 's' : ''} to ${ext.toUpperCase()}` : 'Select a page'}
    </button>
  );

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      workingLabel="Rendering pages…"
      title={results && results.length === 1 ? 'Your image is ready' : 'Your images are ready'}
      subtitle={results ? `${results.length} ${ext.toUpperCase()} · ${formatBytes(totalSize)}` : undefined}
      fileName={results && results.length === 1 ? results[0].name : undefined}
      fileSize={results && results.length === 1 ? results[0].size : undefined}
      downloadLabel={results && results.length > 1 ? 'Download all (ZIP)' : undefined}
      onDownload={downloadAll}
      onBack={backFromResult}
      backLabel="Back to pages"
      note="Pages rendered on your device — nothing is uploaded."
      extra={results && results.length > 1 ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-64 overflow-y-auto">
          {results.map((r) => (
            <button
              key={r.page}
              type="button"
              onClick={() => downloadBlob(r.blob, r.name)}
              title={`Download page ${r.page}`}
              className="group relative rounded-lg overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700 bg-gray-100 dark:bg-gray-900"
            >
              <img src={r.url} alt={`Page ${r.page}`} className="w-full h-full object-contain aspect-[3/4]" />
              <span className="absolute inset-x-0 bottom-0 bg-black/55 text-white text-[10px] py-0.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                Save page {r.page}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      maxMB={PDF_RENDER_MB}
      formats="PDF — each page becomes a JPG or PNG"
      dropTitle="Drop a PDF to turn its pages into images"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || results) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {selected.size} of {pages.length} page{pages.length === 1 ? '' : 's'}
        </p>
        {pages.length > 1 && (
          <button
            type="button"
            onClick={toggleAll}
            className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            {allSelected ? 'Deselect all' : 'Select all'}
          </button>
        )}
      </div>

      {loading && pages.every((p) => !p.thumb) ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Reading the PDF…
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {pages.map((p) => {
            const on = selected.has(p.index);
            return (
              <button
                key={p.index}
                type="button"
                onClick={() => toggle(p.index)}
                className={`group relative rounded-xl overflow-hidden border bg-white dark:bg-gray-800 transition-all ${
                  on ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-gray-200 dark:border-gray-700 opacity-60 hover:opacity-100'
                }`}
              >
                <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-900 grid place-items-center">
                  {p.thumb
                    ? <img src={p.thumb} alt={`Page ${p.index}`} className="w-full h-full object-contain" />
                    : <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />}
                </div>
                <span className="absolute top-1.5 left-1.5 rounded bg-black/55 text-white text-[10px] px-1.5 py-0.5 font-medium">
                  {p.index}
                </span>
                <span className={`absolute top-1.5 right-1.5 h-5 w-5 rounded-full grid place-items-center text-white text-[11px] ${on ? 'bg-purple-600' : 'bg-gray-400/80'}`}>
                  {on ? '✓' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </ToolWorkspace>
  );
};

export default PdfToJpg;

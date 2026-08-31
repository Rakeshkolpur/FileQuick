import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';
import { parsePageRange, formatPageRange } from '../../../lib/pageRange';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const rangeLabel = (a, b) => (a === b ? `Page ${a}` : `Pages ${a}–${b}`);

// split points (page numbers that START a new file) -> [[from,to], ...]
const rangesFromSplits = (splits, total) => {
  const cuts = [...splits].filter((n) => n >= 2 && n <= total).sort((a, b) => a - b);
  const out = [];
  let start = 1;
  for (const c of cuts) { out.push([start, c - 1]); start = c; }
  out.push([start, total]);
  return out;
};

const BADGE = ['bg-purple-600', 'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-pink-600', 'bg-cyan-600', 'bg-indigo-600', 'bg-rose-600'];

const PDFSplit = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pages, setPages] = useState([]); // {index, thumb, w, h}
  const [flow, setFlow] = useState('pick'); // 'pick' (→ 1 PDF) | 'cut' (→ many PDFs)

  // pick flow
  const [selected, setSelected] = useState(() => new Set());
  const [pickText, setPickText] = useState('');
  const pickDirty = useRef(false);
  const lastClick = useRef(null);

  // cut flow
  const [cutMode, setCutMode] = useState('marks'); // marks | every | each
  const [splits, setSplits] = useState(() => new Set());
  const [everyN, setEveryN] = useState(2);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);

  const total = pages.length;
  const thumbToken = useRef(0);

  useEffect(() => { setResults(null); }, [flow, selected, splits, cutMode, everyN]);

  /* ---------- pick flow: selected pages, ascending ---------- */
  const pickList = useMemo(() => [...selected].sort((a, b) => a - b), [selected]);
  useEffect(() => {
    if (flow === 'pick' && !pickDirty.current) setPickText(formatPageRange(pickList));
  }, [pickList, flow]);

  /* ---------- cut flow: derived ranges ---------- */
  const ranges = useMemo(() => {
    if (!total) return [];
    if (cutMode === 'each') return pages.map((p) => [p.index, p.index]);
    if (cutMode === 'every') {
      const n = Math.max(1, Math.min(everyN, total));
      const out = [];
      for (let s = 1; s <= total; s += n) out.push([s, Math.min(s + n - 1, total)]);
      return out;
    }
    return rangesFromSplits(splits, total);
  }, [cutMode, everyN, splits, total, pages]);

  const pageFile = useMemo(() => {
    const map = {};
    ranges.forEach(([a, b], i) => { for (let p = a; p <= b; p += 1) map[p] = i; });
    return map;
  }, [ranges]);

  /* ---------- load ---------- */
  const renderThumbs = useCallback(async (doc, token) => {
    for (let i = 1; i <= doc.numPages; i += 1) {
      if (token !== thumbToken.current) return;
      try {
        // eslint-disable-next-line no-await-in-loop
        const t = await renderThumbnail(doc, i, 260);
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
    setResults(null);
    setSelected(new Set());
    setSplits(new Set());
    setPickText('');
    pickDirty.current = false;
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
    setFile(null); setBytes(null); setPages([]);
    setSelected(new Set()); setSplits(new Set()); setPickText('');
    setFlow('pick'); setCutMode('marks'); setResults(null); setError(null);
    pickDirty.current = false;
  };
  const backFromResult = () => setResults(null);

  /* ---------- pick interactions ---------- */
  const togglePick = (page, e) => {
    pickDirty.current = false;
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
  const onPickText = (v) => {
    pickDirty.current = true;
    setPickText(v);
    setSelected(new Set(parsePageRange(v, total)));
  };
  const allPages = useMemo(() => pages.map((p) => p.index), [pages]);
  const pickAll = () => { pickDirty.current = false; setSelected(new Set(allPages)); };
  const pickNone = () => { pickDirty.current = false; setSelected(new Set()); };
  const pickInvert = () => { pickDirty.current = false; setSelected((prev) => new Set(allPages.filter((n) => !prev.has(n)))); };

  /* ---------- cut interactions ---------- */
  const toggleSplit = (page) => {
    if (flow !== 'cut' || cutMode !== 'marks' || page < 2) return;
    setSplits((prev) => {
      const next = new Set(prev);
      next.has(page) ? next.delete(page) : next.add(page);
      return next;
    });
  };

  /* ---------- build ---------- */
  const buildPick = async () => {
    if (!pickList.length) { setError('Select at least one page.'); return; }
    setBusy(true);
    setError(null);
    try {
      const src = await PDFDocument.load(bytes);
      const out = await PDFDocument.create();
      const copied = await out.copyPages(src, pickList.map((n) => n - 1));
      copied.forEach((pg) => out.addPage(pg));
      const b = await out.save();
      const blob = new Blob([b], { type: 'application/pdf' });
      setResults([{
        name: `${stripExt(file.name)}-pages.pdf`,
        blob,
        size: blob.size,
        label: `${pickList.length} page${pickList.length > 1 ? 's' : ''}`,
        count: pickList.length,
      }]);
    } catch (e) {
      setError(`Could not build the PDF: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const buildCut = async () => {
    if (ranges.length < 2) { setError('Set at least one split point.'); return; }
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: ranges.length });
    try {
      const src = await PDFDocument.load(bytes);
      const base = stripExt(file.name);
      const pad = String(ranges.length).length;
      const out = [];
      for (let i = 0; i < ranges.length; i += 1) {
        const [a, b] = ranges[i];
        // eslint-disable-next-line no-await-in-loop
        const doc = await PDFDocument.create();
        const idx = [];
        for (let p = a; p <= b; p += 1) idx.push(p - 1);
        // eslint-disable-next-line no-await-in-loop
        const copied = await doc.copyPages(src, idx);
        copied.forEach((pg) => doc.addPage(pg));
        // eslint-disable-next-line no-await-in-loop
        const bb = await doc.save();
        const blob = new Blob([bb], { type: 'application/pdf' });
        out.push({
          name: a === b ? `${base}-p${a}.pdf` : `${base}-${String(i + 1).padStart(pad, '0')}_p${a}-${b}.pdf`,
          blob,
          size: blob.size,
          label: rangeLabel(a, b),
          count: b - a + 1,
        });
        setProgress({ done: i + 1, total: ranges.length });
      }
      setResults(out);
    } catch (e) {
      setError(`Could not split the PDF: ${e.message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const run = () => (flow === 'pick' ? buildPick() : buildCut());

  const downloadAll = async () => {
    if (!results) return;
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = await zipFiles(results.map((r) => ({ name: r.name, blob: r.blob })));
    downloadBlob(zip, `${stripExt(file.name)}-split.zip`);
  };

  const btn = 'flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

  const canRun = flow === 'pick' ? pickList.length > 0 : ranges.length > 1;
  const outCount = flow === 'pick' ? 1 : ranges.length;

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

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Segmented
          options={[
            { value: 'pick', label: 'Pick pages → 1 PDF' },
            { value: 'cut', label: 'Cut into many' },
          ]}
          value={flow}
          onChange={setFlow}
        />

        {flow === 'pick' ? (
          <>
            <label className="block text-sm font-semibold text-gray-900 dark:text-white">Pages to keep</label>
            <input
              type="text"
              value={pickText}
              onChange={(e) => onPickText(e.target.value)}
              onBlur={() => { pickDirty.current = false; }}
              placeholder="e.g. 1, 3, 4-5, 7, 22"
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={pickAll} className={btn} disabled={!total}>All</button>
              <button type="button" onClick={pickInvert} className={btn} disabled={!total}>Invert</button>
              <button type="button" onClick={pickNone} className={btn} disabled={!selected.size}>None</button>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Type page numbers or click the pages. They&apos;re combined into one PDF, in page order.
            </p>
          </>
        ) : (
          <>
            <Segmented
              options={[
                { value: 'marks', label: 'Split points' },
                { value: 'every', label: 'Every N' },
                { value: 'each', label: 'Each page' },
              ]}
              value={cutMode}
              onChange={setCutMode}
            />
            {cutMode === 'marks' && (
              <>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  Click a page to start a new file there. A ✂ shows each cut.
                </p>
                <button type="button" onClick={() => setSplits(new Set())} className={`${btn} w-full`} disabled={!splits.size}>
                  Clear split points
                </button>
              </>
            )}
            {cutMode === 'every' && (
              <>
                <RangeSlider label="Pages per file" value={everyN} min={1} max={Math.max(1, total - 1)} onChange={setEveryN} />
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {ranges.length} file{ranges.length === 1 ? '' : 's'} of up to {everyN} page{everyN === 1 ? '' : 's'}.
                </p>
              </>
            )}
            {cutMode === 'each' && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">
                Every page becomes its own 1-page PDF — {total} file{total === 1 ? '' : 's'}.
              </p>
            )}
          </>
        )}
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-sm text-gray-700 dark:text-gray-200">
          Output: <span className="font-semibold">
            {flow === 'pick'
              ? `1 PDF · ${pickList.length} page${pickList.length === 1 ? '' : 's'}`
              : `${outCount} file${outCount === 1 ? '' : 's'}${outCount > 1 ? ' (ZIP)' : ''}`}
          </span>
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
      onClick={run}
      disabled={!canRun || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy
        ? (flow === 'pick' ? 'Building…' : 'Splitting…')
        : flow === 'pick'
          ? (pickList.length ? `Extract ${pickList.length} page${pickList.length > 1 ? 's' : ''}` : 'Select pages')
          : (ranges.length > 1 ? `Split into ${ranges.length} files` : 'Set a split point')}
    </button>
  );

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      workingLabel={flow === 'pick' ? 'Building your PDF…' : 'Splitting your PDF…'}
      title={flow === 'pick' ? 'Your PDF is ready' : 'PDF split'}
      subtitle={results
        ? (results.length === 1
          ? `${results[0].count} page${results[0].count > 1 ? 's' : ''} · ${formatBytes(results[0].size)}`
          : `${results.length} files · ${formatBytes(results.reduce((s, r) => s + r.size, 0))}`)
        : undefined}
      downloadLabel={results && results.length > 1 ? 'Download all (ZIP)' : undefined}
      fileName={results && results.length === 1 ? results[0].name : undefined}
      fileSize={results && results.length === 1 ? results[0].size : undefined}
      onDownload={downloadAll}
      onBack={backFromResult}
      backLabel="Back to page view"
      extra={results && results.length > 1 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.map((r, i) => (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{r.label} · {r.count}p</span>
              <button type="button" onClick={() => downloadBlob(r.blob, r.name)} className="shrink-0 text-purple-600 dark:text-purple-400 hover:underline">
                {formatBytes(r.size)} · save
              </button>
            </div>
          ))}
        </div>
      ) : null}
    />
  ) : null;

  const showScissors = flow === 'cut' && cutMode === 'marks';

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — keep the pages you want, or cut into several files"
      dropTitle="Drop a PDF to split"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || results) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {flow === 'pick'
              ? `${pickList.length} of ${total} page${total === 1 ? '' : 's'} selected`
              : `${total} page${total === 1 ? '' : 's'} → ${ranges.length} file${ranges.length === 1 ? '' : 's'}`}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {flow === 'pick'
              ? 'Click pages to add them · shift-click for a range.'
              : showScissors ? 'Click a page to cut before it.' : 'Adjust the split in the panel.'}
          </p>
        </div>
      </div>

      {loading && pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Reading PDF…
        </div>
      ) : (
        <div className="flex flex-wrap gap-x-1.5 gap-y-3">
          {pages.map((p) => {
            const picked = flow === 'pick' && selected.has(p.index);
            const cut = showScissors && splits.has(p.index);
            const fileIdx = pageFile[p.index] ?? 0;
            const startsFile = flow === 'cut' && ranges.some(([a]) => a === p.index);
            const aspect = (p.w || 1) / (p.h || Math.SQRT2);
            return (
              <React.Fragment key={p.index}>
                {p.index > 1 && flow === 'cut' && (
                  <button
                    type="button"
                    onClick={() => toggleSplit(p.index)}
                    disabled={!showScissors}
                    title={showScissors ? (cut ? 'Remove split' : 'Split here') : undefined}
                    className={`self-stretch w-6 min-h-[120px] rounded flex items-center justify-center transition-colors ${
                      cut
                        ? 'text-purple-600 dark:text-purple-400'
                        : showScissors
                          ? 'text-gray-300 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                          : startsFile ? 'text-gray-400' : 'text-transparent'
                    }`}
                  >
                    {cut || (!showScissors && startsFile)
                      ? <span className="text-lg leading-none">✂</span>
                      : <span className="border-l border-dashed border-current h-3/5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => (flow === 'pick' ? togglePick(p.index, e) : toggleSplit(p.index))}
                  style={{ width: 120 }}
                  className={`group relative shrink-0 rounded-xl border bg-white dark:bg-gray-800 p-1.5 select-none transition-shadow text-left ${
                    picked
                      ? 'border-purple-500 ring-2 ring-purple-500/40'
                      : `border-gray-200 dark:border-gray-700 ${flow === 'pick' || showScissors ? 'cursor-pointer hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600' : ''}`
                  }`}
                >
                  <div className="relative w-full overflow-hidden rounded-md bg-gray-100 dark:bg-gray-900 ring-1 ring-black/5" style={{ aspectRatio: String(aspect) }}>
                    {p.thumb ? (
                      <img src={p.thumb} alt={`Page ${p.index}`} draggable={false} className="absolute inset-0 w-full h-full object-contain" />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                      </div>
                    )}
                    {flow === 'pick' ? (
                      <span className={`absolute top-1 left-1 h-4 w-4 rounded flex items-center justify-center text-white text-[10px] ${picked ? 'bg-purple-600' : 'bg-black/30 group-hover:bg-black/50'}`}>
                        {picked ? '✓' : ''}
                      </span>
                    ) : (
                      <span className={`absolute top-1 left-1 h-4 min-w-4 px-1 rounded text-white text-[10px] font-bold flex items-center justify-center ${BADGE[fileIdx % BADGE.length]}`}>
                        {String.fromCharCode(65 + (fileIdx % 26))}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-center text-[11px] font-semibold text-gray-600 dark:text-gray-300">{p.index}</div>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      )}
    </ToolWorkspace>
  );
};

export default PDFSplit;

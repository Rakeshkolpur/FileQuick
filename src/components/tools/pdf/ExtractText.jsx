import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';
import { parsePageRange } from '../../../lib/pageRange';
import { ocrImage, preloadOcr, terminateOcr } from '../../../lib/ocr';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const nonWs = (s) => s.replace(/\s+/g, '').length;

const MODES = [
  { value: 'auto', label: 'Auto' },
  { value: 'text', label: 'Text layer' },
  { value: 'ocr', label: 'OCR all' },
];

const ExtractText = () => {
  const [file, setFile] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [scanHint, setScanHint] = useState(null); // 'text' | 'scanned' | 'mixed'
  const [mode, setMode] = useState('auto');
  const [rangeText, setRangeText] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null); // { page, total, ocr }
  const [output, setOutput] = useState(null); // { text, pages, ocrPages, words, chars }
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const cancelRef = useRef(false);

  useEffect(() => () => { terminateOcr(); }, []);

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setOutput(null);
    setRangeText('');
    setBusy(true);
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab);
      setFile(f);
      setPdf(doc);
      setPageCount(doc.numPages);
      // sniff the first few pages for a text layer
      let withText = 0;
      const probe = Math.min(doc.numPages, 5);
      for (let i = 1; i <= probe; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await doc.getPage(i);
        // eslint-disable-next-line no-await-in-loop
        const tc = await page.getTextContent();
        if (nonWs(tc.items.map((t) => t.str).join('')) > 20) withText += 1;
        page.cleanup?.();
      }
      const hint = withText === 0 ? 'scanned' : withText === probe ? 'text' : 'mixed';
      setScanHint(hint);
      if (hint !== 'text') { setMode('auto'); preloadOcr(); }
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = () => {
    cancelRef.current = true;
    setFile(null); setPdf(null); setPageCount(0); setScanHint(null);
    setOutput(null); setRangeText(''); setError(null); setProgress(null);
    setMode('auto');
  };

  const targetPages = useMemo(
    () => (rangeText.trim() ? parsePageRange(rangeText, pageCount) : Array.from({ length: pageCount }, (_, i) => i + 1)),
    [rangeText, pageCount],
  );

  const extract = async () => {
    if (!pdf || !targetPages.length) { setError('No pages selected — check the range.'); return; }
    cancelRef.current = false;
    setBusy(true);
    setError(null);
    setOutput(null);
    setProgress({ page: 0, total: targetPages.length, ocr: false });

    const parts = [];
    let ocrPages = 0;
    try {
      for (let idx = 0; idx < targetPages.length; idx += 1) {
        if (cancelRef.current) return;
        const n = targetPages[idx];
        // eslint-disable-next-line no-await-in-loop
        const page = await pdf.getPage(n);
        let text = '';
        if (mode !== 'ocr') {
          // eslint-disable-next-line no-await-in-loop
          const tc = await page.getTextContent();
          text = tc.items.map((t) => (t.hasEOL ? `${t.str}\n` : `${t.str} `)).join('').replace(/[ \t]+\n/g, '\n');
        }
        const needsOcr = mode === 'ocr' || (mode === 'auto' && nonWs(text) < 15);
        if (needsOcr && mode !== 'text') {
          setProgress({ page: idx + 1, total: targetPages.length, ocr: true, ocrProgress: 0 });
          // eslint-disable-next-line no-await-in-loop
          const canvas = await renderPageToCanvas(pdf, n, { scale: 3 });
          // eslint-disable-next-line no-await-in-loop
          text = await ocrImage(canvas, (p) => setProgress((cur) => (cur ? { ...cur, ocrProgress: p } : cur)));
          ocrPages += 1;
        }
        page.cleanup?.();
        parts.push(`──────── Page ${n} ────────\n\n${text.trim()}\n`);
        setProgress({ page: idx + 1, total: targetPages.length, ocr: false });
      }
      const full = parts.join('\n');
      setOutput({
        text: full,
        pages: targetPages.length,
        ocrPages,
        words: (full.match(/\S+/g) || []).length,
        chars: full.length,
      });
    } catch (e) {
      setError(`Extraction failed: ${e.message}`);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(output.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (_) { setError('Could not copy — select the text and copy manually.'); }
  };
  const doDownload = (ext) => {
    const mime = ext === 'md' ? 'text/markdown' : 'text/plain';
    downloadBlob(new Blob([output.text], { type: `${mime};charset=utf-8` }), `${stripExt(file.name)}.${ext}`);
  };

  const HintBadge = () => {
    if (!scanHint) return null;
    const map = {
      text: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'Has a text layer — extraction is instant'],
      scanned: ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'Looks scanned — OCR will read the pages'],
      mixed: ['bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300', 'Mixed — some pages need OCR'],
    };
    const [cls, txt] = map[scanHint];
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{txt}</span>;
  };

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">Start over</button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file?.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
        <HintBadge />
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">How to read it</h3>
        <Segmented options={MODES} value={mode} onChange={(v) => { setMode(v); setOutput(null); if (v !== 'text') preloadOcr(); }} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {mode === 'auto' && 'Uses the real text where it exists, OCR only for pages that are images.'}
          {mode === 'text' && 'Pulls the embedded text layer only — fast, exact, but blank for scans.'}
          {mode === 'ocr' && 'Reads every page as an image with OCR (English). Slower; use for scanned PDFs.'}
        </p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">Pages</label>
        <input
          type="text"
          value={rangeText}
          onChange={(e) => { setRangeText(e.target.value); setOutput(null); }}
          placeholder="all — or e.g. 1-3, 8"
          className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{targetPages.length} page{targetPages.length === 1 ? '' : 's'} will be read.</p>
      </section>

      {output && (
        <section className="pt-4 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
          <p><span className="font-semibold text-gray-700 dark:text-gray-200">{output.words.toLocaleString()}</span> words · {output.chars.toLocaleString()} characters</p>
          {output.ocrPages > 0 && <p>{output.ocrPages} page{output.ocrPages > 1 ? 's' : ''} read with OCR</p>}
        </section>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={busy ? () => { cancelRef.current = true; } : extract}
      disabled={!pdf || !targetPages.length}
      className={`w-full py-3 rounded-xl font-semibold text-white transition-opacity flex items-center justify-center gap-2 ${
        busy ? 'bg-gray-500 hover:bg-gray-600' : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed'
      }`}
    >
      {busy
        ? (progress
          ? `Reading page ${progress.page}/${progress.total}${progress.ocr ? ` · OCR ${Math.round((progress.ocrProgress || 0) * 100)}%` : ''} — tap to stop`
          : 'Working… — tap to stop')
        : output ? 'Extract again' : 'Extract text'}
    </button>
  );

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — text layer + OCR for scanned pages"
      dropTitle="Drop a PDF to extract its text"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={reset}
      sidebar={sidebar}
      footer={footer}
    >
      {output ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {output.pages} page{output.pages === 1 ? '' : 's'} · {output.words.toLocaleString()} words
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={doCopy} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
                {copied ? '✓ Copied' : 'Copy'}
              </button>
              <button type="button" onClick={() => doDownload('txt')} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">.txt</button>
              <button type="button" onClick={() => doDownload('md')} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">.md</button>
            </div>
          </div>
          <textarea
            readOnly
            value={output.text}
            className="w-full h-[calc(100vh-22rem)] min-h-[320px] p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed resize-none focus:ring-2 focus:ring-purple-500"
          />
        </>
      ) : busy && progress ? (
        <div className="flex flex-col items-center justify-center py-24">
          <div className="w-52 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div className="h-full bg-purple-600 transition-all" style={{ width: `${(progress.page / progress.total) * 100}%` }} />
          </div>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">
            Page {progress.page} of {progress.total}
            {progress.ocr && ` · running OCR (${Math.round((progress.ocrProgress || 0) * 100)}%)`}
          </p>
          {progress.ocr && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">First OCR page also downloads the language model (~10 MB).</p>}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center py-20 text-gray-500 dark:text-gray-400">
          <div className="h-14 w-14 rounded-2xl grid place-items-center mb-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </div>
          <p className="font-medium text-gray-800 dark:text-gray-200">{file?.name}</p>
          <p className="text-sm mt-1 max-w-sm">
            {scanHint === 'scanned'
              ? 'This looks like a scan — the Extract button will OCR each page. It runs in your browser.'
              : scanHint === 'mixed'
                ? 'Some pages have text, some are images — “Auto” handles both.'
                : 'Press Extract to pull the text out. It stays on your device.'}
          </p>
        </div>
      )}
    </ToolWorkspace>
  );
};

export default ExtractText;

import React, { useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { api } from '../../../lib/api';
import { renderDocx, docxSectionsToPdf } from '../../../lib/docxToPdf';

const isDocx = (f) =>
  f && (f.name?.toLowerCase().endsWith('.docx')
    || f.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

// Themed overrides for the docx-preview wrapper so the pages sit on our surface.
const PREVIEW_CSS = `
.wtp-preview .docx-wrapper { background: transparent; padding: 0; }
.wtp-preview .docx-wrapper > section.docx {
  margin: 0 auto 1.25rem; box-shadow: 0 1px 4px rgba(0,0,0,.12), 0 8px 24px rgba(0,0,0,.08);
}
@media print {
  body * { visibility: hidden !important; }
  .wtp-preview, .wtp-preview * { visibility: visible !important; }
  .wtp-preview { position: absolute; inset: 0; margin: 0; padding: 0; overflow: visible; }
  .wtp-preview .docx-wrapper > section.docx { margin: 0 !important; box-shadow: none !important; }
  @page { margin: 0; }
}
`;

const WordToPdf = () => {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | rendering | ready | error
  const [pageCount, setPageCount] = useState(0);
  const [server, setServer] = useState('checking'); // checking | online | no-lo | offline
  const [hiRes, setHiRes] = useState('standard'); // browser-fallback only
  const [result, setResult] = useState(null); // { blob, size, engine }
  const [progress, setProgress] = useState(null); // { label }
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const bodyRef = useRef(null);
  const styleRef = useRef(null);
  const renderToken = useRef(0);

  // Probe the local conversion server once.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 3500 });
        if (!alive) return;
        setServer(res.data?.libreoffice ? 'online' : 'no-lo');
      } catch (_) {
        if (alive) setServer('offline');
      }
    })();
    return () => { alive = false; };
  }, []);

  const onFiles = (list) => {
    const f = list[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setNotice(null);
    setPageCount(0);
    if (!isDocx(f)) {
      setFile(null);
      setPhase('idle');
      setError(f?.name?.toLowerCase().endsWith('.doc')
        ? 'The old .doc format isn’t supported here — open it in Word and “Save As” .docx first.'
        : 'Please choose a Word .docx file.');
      return;
    }
    setFile(f);
    setPhase('rendering');
  };

  // Render the document into the preview (also used as the browser-fallback source).
  useEffect(() => {
    if (!file || !bodyRef.current) return;
    const token = ++renderToken.current;
    setPhase('rendering');
    setError(null);
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (token !== renderToken.current) return;
        const sections = await renderDocx(buf, bodyRef.current, styleRef.current);
        if (token !== renderToken.current) return;
        setPageCount(sections.length);
        setPhase('ready');
      } catch (e) {
        if (token !== renderToken.current) return;
        console.error(e);
        setError('Could not read this document. It may be corrupted or password-protected.');
        setPhase('error');
      }
    })();
  }, [file]);

  const reset = () => {
    renderToken.current += 1;
    if (bodyRef.current) bodyRef.current.innerHTML = '';
    setFile(null);
    setPhase('idle');
    setPageCount(0);
    setResult(null);
    setError(null);
    setNotice(null);
    setProgress(null);
  };

  const convertOnServer = async () => {
    const fd = new FormData();
    fd.append('file', file, file.name);
    const res = await api.post('/convert/word-to-pdf', fd, {
      responseType: 'blob',
      timeout: 180000,
    });
    let blob = res.data;
    if (blob && blob.type && blob.type.indexOf('application/pdf') === -1) {
      // Error payloads come back as JSON even with responseType blob.
      const text = await blob.text();
      try { throw new Error(JSON.parse(text).error || text); } catch (e) { throw new Error(e.message); }
    }
    return new Blob([blob], { type: 'application/pdf' });
  };

  const convertInBrowser = async () => {
    const sections = bodyRef.current
      ? [...bodyRef.current.querySelectorAll('.docx-wrapper > section.docx')]
      : [];
    if (!sections.length) throw new Error('The document has no pages to convert.');
    return docxSectionsToPdf(sections, {
      scale: hiRes === 'high' ? 3 : 2,
      onProgress: (done, total) => setProgress({ label: `Rendering page ${done} / ${total}…` }),
    });
  };

  const build = async () => {
    setError(null);
    setNotice(null);
    try {
      if (server === 'online') {
        setProgress({ label: 'Converting with LibreOffice…' });
        try {
          const blob = await convertOnServer();
          setResult({ blob, size: blob.size, engine: 'libreoffice' });
          return;
        } catch (e) {
          console.warn('Server conversion failed, falling back:', e);
          setNotice(`Conversion server error — used the in-browser converter instead. (${e.message})`);
          setServer((s) => (s === 'online' ? 'offline' : s));
        }
      }
      setProgress({ label: 'Rendering in your browser…' });
      const blob = await convertInBrowser();
      setResult({ blob, size: blob.size, engine: 'browser' });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Conversion failed.');
    } finally {
      setProgress(null);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}.pdf`;
  const backFromResult = () => setResult(null);

  const primaryLabel = progress
    ? progress.label
    : server === 'online' ? 'Convert to PDF' : 'Convert to PDF (in browser)';

  const ServerBadge = () => {
    const map = {
      checking: ['bg-gray-100 dark:bg-gray-700 text-gray-500', 'Checking converter…'],
      online: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'LibreOffice engine · connected'],
      'no-lo': ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'LibreOffice not found — using the in-browser renderer instead'],
      offline: ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'Converter offline · using browser'],
    };
    const [cls, label] = map[server] || map.checking;
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
    </span>;
  };

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            {file?.name || 'Document'}
          </h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {phase === 'rendering' && 'Reading document…'}
          {phase === 'ready' && `${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(file?.size)}`}
          {phase === 'error' && 'Could not read the document'}
        </p>
        <ServerBadge />
      </section>

      {server === 'online' ? (
        <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conversion</h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Your document is converted by LibreOffice — the same engine online PDF services use.
            Fonts, styles, tables, images and page layout are kept exactly, and the text stays
            selectable. The file is processed on your machine and deleted right after.
          </p>
        </section>
      ) : (
        <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Browser resolution</h3>
          <Segmented
            options={[{ value: 'standard', label: 'Standard' }, { value: 'high', label: 'High' }]}
            value={hiRes}
            onChange={(v) => { setHiRes(v); setResult(null); }}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            The converter server isn’t running, so the PDF is rendered in your browser from the
            preview — layout is kept but the text becomes an image. Start the local server
            (<code className="text-[10px]">npm run server</code>) for exact, selectable output.
          </p>
        </section>
      )}

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        <button
          type="button"
          onClick={() => window.print()}
          disabled={phase !== 'ready'}
          className="w-full text-sm py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Print / Save as PDF
        </button>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          Prints the preview through your browser (margins → None for an exact copy).
        </p>
      </section>

      {notice && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">{notice}</p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={build}
      disabled={phase !== 'ready' || !!progress}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {progress ? (
        <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> {progress.label}</>
      ) : (
        primaryLabel
      )}
    </button>
  );

  // The preview must stay visible during a browser render (html2canvas needs it),
  // so only switch to the result screen once the PDF is actually built.
  const resultView = result ? (
    <ResultScreen
      done
      title="Your PDF is ready"
      fileName={outName}
      fileSize={result.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Convert another document"
      note={result.engine === 'libreoffice'
        ? 'Converted with LibreOffice — layout and selectable text kept. Stays on your device.'
        : 'Rendered in your browser from the preview — layout kept, text is an image.'}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      formats="Word .docx — fonts, styles, tables and layout are kept"
      dropTitle="Drop a Word document"
      dropHint="or click to browse — .docx"
      paste={false}
      onFiles={onFiles}
      onBack={result ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <style>{PREVIEW_CSS}</style>
      <div ref={styleRef} className="hidden" />

      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {phase === 'ready' ? `Preview · ${pageCount} page${pageCount === 1 ? '' : 's'}` : 'Preview'}
        </p>
        {result && (
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            {result.engine === 'libreoffice' ? 'Converted with LibreOffice' : 'Rendered in browser'}
          </span>
        )}
      </div>

      <div className="rounded-xl bg-gray-100 dark:bg-gray-900/40 p-3 sm:p-5 max-h-[70vh] overflow-auto">
        <div ref={bodyRef} className="wtp-preview" />
        {phase === 'rendering' && pageCount === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Laying out the document…
          </div>
        )}
      </div>
    </ToolWorkspace>
  );
};

export default WordToPdf;

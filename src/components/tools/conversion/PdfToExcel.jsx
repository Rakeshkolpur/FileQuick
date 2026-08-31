import React, { useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { api } from '../../../lib/api';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const PdfToExcel = () => {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | loading | ready | error
  const [pageCount, setPageCount] = useState(0);
  const [thumbs, setThumbs] = useState([]);
  const [server, setServer] = useState('checking'); // checking | ready | unavailable
  const [pagesSpec, setPagesSpec] = useState('');
  const [result, setResult] = useState(null); // { blob, size }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  const token = useRef(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 3500 });
        if (alive) setServer(res.data?.pdf_to_excel ? 'ready' : 'unavailable');
      } catch (_) {
        if (alive) setServer('unavailable');
      }
    })();
    return () => { alive = false; };
  }, []);

  const onFiles = (list) => {
    const f = list[0];
    if (!f) return;
    setResult(null);
    setError(null);
    setThumbs([]);
    setPageCount(0);
    setPagesSpec('');
    if (!isPdf(f)) {
      setFile(null);
      setPhase('idle');
      setError('Please choose a PDF file.');
      return;
    }
    setFile(f);
    setPhase('loading');
  };

  useEffect(() => {
    if (!file) return;
    const t = ++token.current;
    setPhase('loading');
    (async () => {
      try {
        const buf = await file.arrayBuffer();
        if (t !== token.current) return;
        const pdf = await openPdf(buf);
        if (t !== token.current) return;
        setPageCount(pdf.numPages);
        setPhase('ready');
        const n = Math.min(pdf.numPages, 8);
        for (let i = 1; i <= n; i += 1) {
          // eslint-disable-next-line no-await-in-loop
          const th = await renderThumbnail(pdf, i, 300);
          if (t !== token.current) return;
          setThumbs((prev) => [...prev, { page: i, ...th }]);
        }
      } catch (e) {
        if (t !== token.current) return;
        console.error(e);
        setError('Could not read this PDF. It may be damaged or password-protected.');
        setPhase('error');
      }
    })();
  }, [file]);

  const reset = () => {
    token.current += 1;
    setFile(null);
    setPhase('idle');
    setPageCount(0);
    setThumbs([]);
    setPagesSpec('');
    setResult(null);
    setError(null);
  };

  const build = async () => {
    setError(null);
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      if (pagesSpec.trim()) fd.append('pages', pagesSpec.trim());
      const res = await api.post('/convert/pdf-to-excel', fd, { responseType: 'blob', timeout: 300000 });
      let blob = res.data;
      if (blob?.type && blob.type.indexOf('spreadsheet') === -1 && blob.type.indexOf('octet-stream') === -1) {
        const text = await blob.text();
        throw new Error(JSON.parse(text).error || text);
      }
      blob = new Blob([blob], { type: XLSX_MIME });
      setResult({ blob, size: blob.size });
    } catch (e) {
      console.error(e);
      const msg = e.response ? 'Conversion server error.' : e.message;
      setError(msg || 'Conversion failed.');
    } finally {
      setWorking(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}.xlsx`;
  const backFromResult = () => setResult(null);

  const primaryDisabled = working || phase !== 'ready' || server !== 'ready';

  const ServerBadge = () => {
    const map = {
      checking: ['bg-gray-100 dark:bg-gray-700 text-gray-500', 'Checking converter…'],
      ready: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'Conversion engine · connected'],
      unavailable: ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'Converter offline — start it with npm run server'],
    };
    const [cls, label] = map[server] || map.checking;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />{label}
      </span>
    );
  };

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {phase === 'loading' && 'Reading PDF…'}
          {phase === 'ready' && `${pageCount} page${pageCount === 1 ? '' : 's'} · ${formatBytes(file?.size)}`}
          {phase === 'error' && 'Could not read the PDF'}
        </p>
        <ServerBadge />
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">Pages to scan</label>
        <input
          type="text"
          value={pagesSpec}
          onChange={(e) => { setPagesSpec(e.target.value); setResult(null); }}
          placeholder={pageCount ? 'all — or e.g. 1-3, 8' : 'all'}
          className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">One worksheet per page that has a table.</p>
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Tables are detected from the page — cell borders, bold text, headings, font size and
          colour are carried over. Ruled tables come through cleanest; borderless ones are
          reconstructed from the column spacing and may need a tidy-up. Numbers stay numbers.
          Scanned/image-only PDFs need OCR first. Processed on your machine and deleted right after.
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
      onClick={build}
      disabled={primaryDisabled}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {working ? (
        <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> Converting…</>
      ) : (
        'Convert to Excel'
      )}
    </button>
  );

  const resultView = (working || result) ? (
    <ResultScreen
      working={working}
      done={!!result}
      title="Your spreadsheet is ready"
      workingLabel="Pulling out tables…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Convert another PDF"
      note="Tables read from the page layout — check the columns. The file stays on your device."
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — tables pulled into an .xlsx workbook"
      dropTitle="Drop a PDF to convert"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(working || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {phase === 'ready' ? `${pageCount} page${pageCount === 1 ? '' : 's'}` : 'Preview'}
        </p>
      </div>

      <div className="rounded-xl bg-gray-100 dark:bg-gray-900/40 p-3 sm:p-5 max-h-[70vh] overflow-auto">
        {phase === 'loading' && thumbs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Opening PDF…
          </div>
        ) : (
          <div className="flex flex-wrap gap-3 justify-center">
            {thumbs.map((t) => (
              <div key={t.page} className="rounded-lg overflow-hidden bg-white shadow ring-1 ring-black/5" style={{ width: 150 }}>
                <img src={t.dataUrl} alt={`Page ${t.page}`} className="w-full block" />
                <div className="text-[11px] text-center text-gray-500 py-1">{t.page}</div>
              </div>
            ))}
            {pageCount > thumbs.length && phase === 'ready' && (
              <div className="flex items-center justify-center text-xs text-gray-400" style={{ width: 150 }}>
                +{pageCount - thumbs.length} more page{pageCount - thumbs.length === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
      </div>

      {server === 'unavailable' && (
        <p className="mt-4 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          PDF&nbsp;→&nbsp;Excel runs on the conversion server. Start it with <code className="text-[11px]">npm run server</code>,
          then reload this page. (In production it&apos;s the deployed backend — see <code className="text-[11px]">server/README.md</code>.)
        </p>
      )}
    </ToolWorkspace>
  );
};

export default PdfToExcel;

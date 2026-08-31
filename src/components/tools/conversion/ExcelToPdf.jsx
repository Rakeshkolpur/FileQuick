import React, { useEffect, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { api } from '../../../lib/api';

const XL_RE = /\.(xlsx|xls|ods|csv|xlsm|fods|tsv)$/i;
const isSpreadsheet = (f) => f && (
  XL_RE.test(f.name || '')
  || f.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  || f.type === 'application/vnd.ms-excel'
  || f.type === 'text/csv'
);

const ExcelToPdf = () => {
  const [file, setFile] = useState(null);
  const [server, setServer] = useState('checking'); // checking | ready | unavailable
  const [result, setResult] = useState(null); // { blob, size }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 3500 });
        if (alive) setServer(res.data?.excel_to_pdf ? 'ready' : 'unavailable');
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
    if (!isSpreadsheet(f)) {
      setFile(null);
      setError('Please choose a spreadsheet (.xlsx, .xls, .ods or .csv).');
      return;
    }
    setFile(f);
  };

  const reset = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };
  const backFromResult = () => setResult(null);

  const build = async () => {
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      const res = await api.post('/convert/excel-to-pdf', fd, { responseType: 'blob', timeout: 300000 });
      let blob = res.data;
      if (blob?.type && blob.type.indexOf('application/pdf') === -1) {
        const text = await blob.text();
        throw new Error(JSON.parse(text).error || text);
      }
      blob = new Blob([blob], { type: 'application/pdf' });
      setResult({ blob, size: blob.size });
    } catch (e) {
      console.error(e);
      const msg = e.response ? 'Conversion server error.' : e.message;
      setError(msg || 'Conversion failed.');
    } finally {
      setWorking(false);
    }
  };

  const outName = `${stripExt(file?.name || 'spreadsheet')}.pdf`;
  const primaryDisabled = working || !file || server !== 'ready';

  const ServerBadge = () => {
    const map = {
      checking: ['bg-gray-100 dark:bg-gray-700 text-gray-500', 'Checking converter…'],
      ready: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'LibreOffice engine · connected'],
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{file?.name || 'Spreadsheet'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {file ? formatBytes(file.size) : 'Choose a .xlsx, .xls, .ods or .csv file'}
        </p>
        <ServerBadge />
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Conversion</h3>
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Your spreadsheet is converted by LibreOffice — the same engine online PDF services use.
          Each sheet&apos;s print area, gridlines, fonts, number formats, colours and page breaks
          are kept, and the text stays selectable. Processed on your machine and deleted right after.
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
        'Convert to PDF'
      )}
    </button>
  );

  const resultView = (working || result) ? (
    <ResultScreen
      working={working}
      done={!!result}
      title="Your PDF is ready"
      workingLabel="Converting with LibreOffice…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Convert another spreadsheet"
      note="Converted with LibreOffice — sheet layout and selectable text kept. Stays on your device."
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept=".xlsx,.xls,.ods,.csv,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
      formats="Excel .xlsx / .xls / .ods / .csv — sheet layout is kept"
      dropTitle="Drop a spreadsheet"
      dropHint="or click to browse — .xlsx, .xls, .ods, .csv"
      paste={false}
      onFiles={onFiles}
      onBack={(working || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex items-center justify-center py-10">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-6 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 text-white flex items-center justify-center">
            <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h16v16H4zM4 10h16M4 16h16M10 4v16M16 4v16" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{file ? formatBytes(file.size) : ''}</p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Ready to convert — every sheet comes through with its columns, formatting and page breaks intact.
          </p>
        </div>
      </div>

      {server === 'unavailable' && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Excel&nbsp;→&nbsp;PDF runs on the conversion server. Start it with <code className="text-[11px]">npm run server</code>,
          then reload this page. (In production it&apos;s the deployed backend — see <code className="text-[11px]">server/README.md</code>.)
        </p>
      )}
    </ToolWorkspace>
  );
};

export default ExcelToPdf;

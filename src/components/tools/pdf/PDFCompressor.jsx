import React, { useEffect, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { api } from '../../../lib/api';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

const LEVELS = [
  { value: 'light', label: 'Light', hint: 'Lossless — quality untouched, modest saving.' },
  { value: 'medium', label: 'Medium', hint: 'Recompresses images. Good balance for most PDFs.' },
  { value: 'strong', label: 'Strong', hint: 'Smallest file. Images get noticeably softer; text stays sharp.' },
];

const PDFCompressor = () => {
  const [file, setFile] = useState(null);
  const [level, setLevel] = useState('medium');
  const [useTarget, setUseTarget] = useState(false);
  const [targetSize, setTargetSize] = useState('');
  const [sizeUnit, setSizeUnit] = useState('KB');
  const [server, setServer] = useState('checking'); // checking | ready | unavailable
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState(null); // { blob, size, original, reduction, note }
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 3500 });
        if (alive) setServer(res.data?.compress ? 'ready' : 'unavailable');
      } catch (_) {
        if (alive) setServer('unavailable');
      }
    })();
    return () => { alive = false; };
  }, []);

  const onFiles = (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setResult(null);
    setFile(f);
  };

  const reset = () => {
    setFile(null); setResult(null); setError(null);
    setUseTarget(false); setTargetSize('');
  };
  const backFromResult = () => setResult(null);

  const outName = `${stripExt(file?.name || 'document')}-compressed.pdf`;

  const compress = async () => {
    setError(null);
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      fd.append('level', level);
      if (useTarget && targetSize) {
        const kb = sizeUnit === 'MB' ? parseFloat(targetSize) * 1024 : parseFloat(targetSize);
        if (kb > 0) fd.append('targetKb', String(kb));
      }
      const res = await api.post('/pdf/compress', fd, { responseType: 'blob', timeout: 240000 });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      setResult({
        blob,
        size: blob.size,
        original: parseInt(res.headers?.['x-original-size'] || file.size, 10),
        reduction: parseFloat(res.headers?.['x-reduction'] || '0'),
        note: res.headers?.['x-compression-note'] || '',
      });
    } catch (e) {
      let msg = 'Could not compress this PDF.';
      if (e.response?.data) {
        try { msg = JSON.parse(await e.response.data.text()).error || msg; } catch (_) { /* keep */ }
      } else if (e.code === 'ERR_NETWORK') {
        msg = 'Can’t reach the server. Start it with `npm run server`.';
      }
      setError(msg);
    } finally {
      setWorking(false);
    }
  };

  const ServerBadge = () => {
    const map = {
      checking: ['bg-gray-100 dark:bg-gray-700 text-gray-500', 'Checking service…'],
      ready: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'Compression engine · connected'],
      unavailable: ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'Service offline — start with npm run server'],
    };
    const [cls, text] = map[server] || map.checking;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />{text}
      </span>
    );
  };

  const activeLevel = LEVELS.find((l) => l.value === level);

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">
            Start over
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file?.size)}</p>
        <ServerBadge />
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Compression</h3>
        <Segmented
          options={LEVELS.map((l) => ({ value: l.value, label: l.label }))}
          value={level}
          onChange={(v) => { setLevel(v); setResult(null); }}
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">{activeLevel?.hint}</p>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">Text and fonts stay selectable at every level.</p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <input
            type="checkbox"
            checked={useTarget}
            onChange={(e) => { setUseTarget(e.target.checked); setResult(null); }}
            className="h-4 w-4 accent-purple-600"
          />
          Aim for a target size
        </label>
        {useTarget && (
          <>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                value={targetSize}
                onChange={(e) => { setTargetSize(e.target.value); setResult(null); }}
                placeholder="e.g. 500"
                className="flex-1 p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <select
                value={sizeUnit}
                onChange={(e) => { setSizeUnit(e.target.value); setResult(null); }}
                className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              >
                <option value="KB">KB</option>
                <option value="MB">MB</option>
              </select>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              The engine steps up the compression until it fits — or gets as close as it can without wrecking the file.
            </p>
          </>
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
      onClick={compress}
      disabled={!file || server !== 'ready' || working || (useTarget && !targetSize)}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {working ? (
        <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> Compressing…</>
      ) : (
        'Compress PDF'
      )}
    </button>
  );

  const gained = result && result.reduction > 0;

  const resultView = (working || result) ? (
    <ResultScreen
      working={working}
      done={!!result}
      title={gained ? `${result.reduction}% smaller` : 'Already optimised'}
      workingLabel="Compressing your PDF…"
      subtitle={result
        ? gained
          ? `${formatBytes(result.original)} → ${formatBytes(result.size)}`
          : 'This PDF is already about as small as it gets without losing quality.'
        : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Compress another PDF"
      note={result?.note && /target not reached/.test(result.note)
        ? 'Target not reached — this is the smallest it goes without heavy quality loss.'
        : 'Text stays selectable. The file stays on your device.'}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — smaller file, text stays selectable"
      dropTitle="Drop a PDF to compress"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(working || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-col items-center justify-center text-center py-10">
        <div className="h-16 w-16 rounded-2xl grid place-items-center mb-4 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V5m0 0L6 8m3-3l3 3M15 15v4m0 0l3-3m-3 3l-3-3M4 12h16" />
          </svg>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{file?.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          Pick a level in the panel, then compress. Embedded images are recompressed; the text layer
          and fonts are kept, so the result stays selectable and searchable.
        </p>
      </div>

      {server === 'unavailable' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Compression runs on the local service. Start it with <code className="text-[11px]">npm run server</code> and reload.
          (In production it&apos;s the deployed backend — see <code className="text-[11px]">server/README.md</code>.)
        </p>
      )}
    </ToolWorkspace>
  );
};

export default PDFCompressor;

import React, { useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { api } from '../../../lib/api';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

const PDFUnlock = () => {
  const [file, setFile] = useState(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [server, setServer] = useState('checking'); // checking | ready | unavailable
  const [result, setResult] = useState(null); // { blob, size }
  const [working, setWorking] = useState(false);
  const [error, setError] = useState(null);
  const pwRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get('/health', { timeout: 3500 });
        if (alive) setServer(res.data?.unlock ? 'ready' : 'unavailable');
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
    setNeedsPassword(false);
    setPassword('');
    setFile(isPdf(f) ? f : null);
    if (!isPdf(f)) setError('Please choose a PDF file.');
  };

  const reset = () => {
    setFile(null); setPassword(''); setNeedsPassword(false);
    setResult(null); setError(null);
  };

  const unlock = async () => {
    setError(null);
    setWorking(true);
    try {
      const fd = new FormData();
      fd.append('file', file, file.name);
      if (password) fd.append('password', password);
      const res = await api.post('/pdf/unlock', fd, { responseType: 'blob', timeout: 120000 });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      setResult({ blob, size: blob.size });
      setNeedsPassword(false);
    } catch (e) {
      let msg = 'Could not unlock this PDF.';
      let needPw = false;
      if (e.response?.data) {
        try {
          const j = JSON.parse(await e.response.data.text());
          msg = j.error || msg;
          needPw = !!j.needsPassword;
        } catch (_) { /* keep default */ }
      } else if (e.code === 'ERR_NETWORK') {
        msg = 'Can’t reach the unlock server. Start it with `npm run server`.';
      }
      setError(msg);
      if (needPw) { setNeedsPassword(true); setTimeout(() => pwRef.current?.focus(), 50); }
    } finally {
      setWorking(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-unlocked.pdf`;
  const backFromResult = () => setResult(null);

  const ServerBadge = () => {
    const map = {
      checking: ['bg-gray-100 dark:bg-gray-700 text-gray-500', 'Checking unlock service…'],
      ready: ['bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', 'Unlock service · connected'],
      unavailable: ['bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', 'Service offline — start with npm run server'],
    };
    const [cls, text] = map[server] || map.checking;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${cls}`}>
        <span className="h-1.5 w-1.5 rounded-full bg-current" />{text}
      </span>
    );
  };

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
        <label className="block text-sm font-semibold text-gray-900 dark:text-white">
          Password {needsPassword && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            ref={pwRef}
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter' && file && !working) unlock(); }}
            placeholder="Enter the PDF's password"
            className={`w-full pr-9 p-2 rounded-lg border bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
              needsPassword ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
            }`}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            aria-label={showPw ? 'Hide password' : 'Show password'}
          >
            {showPw
              ? <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.1A9.6 9.6 0 0112 5c5 0 9 4 10 7a17 17 0 01-3 4M6.6 6.6C4 8 2.6 10.2 2 12c1 3 5 7 10 7 1.6 0 3-.3 4.3-.9" /></svg>
              : <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {needsPassword
            ? 'This PDF needs a password to open — enter it above.'
            : 'Leave blank if the PDF opens without a password (removing print / copy / edit restrictions only).'}
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
      onClick={unlock}
      disabled={!file || server !== 'ready' || working}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {working ? (
        <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> Unlocking…</>
      ) : (
        'Unlock PDF'
      )}
    </button>
  );

  const resultView = (working || result) ? (
    <ResultScreen
      working={working}
      done={!!result}
      title="PDF unlocked"
      workingLabel="Removing the password…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Unlock another PDF"
      note="The password and restrictions are removed. The file stays on your device."
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — password protection and restrictions removed"
      dropTitle="Drop a locked PDF"
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
          <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
        </div>
        <p className="text-lg font-semibold text-gray-900 dark:text-white">{file?.name}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
          Enter the password in the panel if it needs one, then unlock. Anyone who can open a PDF can remove its restrictions.
        </p>
      </div>

      {server === 'unavailable' && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Unlock runs on the local service. Start it with <code className="text-[11px]">npm run server</code> and reload.
          (In production it&apos;s the deployed backend — see <code className="text-[11px]">server/README.md</code>.)
        </p>
      )}
    </ToolWorkspace>
  );
};

export default PDFUnlock;

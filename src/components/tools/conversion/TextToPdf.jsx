import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes } from '../../../lib/format';
import { textToPdf, sanitizeText, UNSUPPORTED_RE } from '../../../lib/textToPdf';

const TEXT_RE = /\.(txt|md|markdown|csv|tsv|log|text|json|xml|yml|yaml|ini|rtf)$/i;
const isTextFile = (f) => f && (f.type.startsWith('text/') || TEXT_RE.test(f.name || ''));
const MAX_CHARS = 500000;

const PAGE_OPTS = [
  { value: 'a4', label: 'A4' },
  { value: 'letter', label: 'Letter' },
  { value: 'legal', label: 'Legal' },
  { value: 'a5', label: 'A5' },
];
const FAMILY_OPTS = [
  { value: 'mono', label: 'Mono' },
  { value: 'sans', label: 'Sans' },
  { value: 'serif', label: 'Serif' },
];

const card = 'rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800';

const TextToPdf = () => {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragging, setDragging] = useState(false);

  const [family, setFamily] = useState('mono');
  const [fontSize, setFontSize] = useState(11);
  const [pageSize, setPageSize] = useState('a4');
  const [orientation, setOrientation] = useState('portrait');
  const [marginMm, setMarginMm] = useState(18);
  const [lineSpacing, setLineSpacing] = useState(1.4);
  const [pageNumbers, setPageNumbers] = useState(false);
  const [title, setTitle] = useState('');

  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { blob, size }
  const [error, setError] = useState(null);

  const inputRef = useRef(null);
  const registerBack = useContext(ToolBackContext);

  const started = text.trim().length > 0 || !!result;

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(started ? () => {
      if (result) { setResult(null); return; }
      setText(''); setFileName(''); setError(null);
    } : null);
    return () => registerBack(null);
  }, [registerBack, started, result]);

  const stats = useMemo(() => {
    const lines = text ? text.split('\n').length : 0;
    const words = (text.match(/\S+/g) || []).length;
    return { lines, words, chars: text.length };
  }, [text]);

  const hasUnsupported = useMemo(
    () => (text ? UNSUPPORTED_RE.test(sanitizeText(text)) : false),
    [text],
  );

  const loadFile = (f) => {
    if (!f) return;
    if (!isTextFile(f)) { setError('That doesn’t look like a text file. Use .txt, .md, .csv, .log…'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setError(null);
      setResult(null);
      setText(String(reader.result || '').slice(0, MAX_CHARS));
      setFileName(f.name);
      if (!title) setTitle('');
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    loadFile(e.dataTransfer.files?.[0]);
  };

  const build = async () => {
    if (!text.trim()) { setError('Add some text first.'); return; }
    setError(null);
    setBusy(true);
    try {
      const blob = await textToPdf(text, {
        pageSize, orientation, family, fontSize, marginMm, lineSpacing, pageNumbers, title,
      });
      setResult({ blob, size: blob.size });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not build the PDF.');
    } finally {
      setBusy(false);
    }
  };

  const outName = `${(fileName ? fileName.replace(/\.[^/.]+$/, '') : (title.trim() || 'document'))}.pdf`;
  const backFromResult = () => setResult(null);

  const sidebar = (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Typeface</h3>
        <Segmented options={FAMILY_OPTS} value={family} onChange={(v) => { setFamily(v); setResult(null); }} />
        <RangeSlider label="Font size" value={fontSize} min={8} max={16} step={0.5} suffix=" pt"
          onChange={(v) => { setFontSize(v); setResult(null); }} />
        <RangeSlider label="Line spacing" value={lineSpacing} min={1} max={2.2} step={0.1} suffix="×"
          onChange={(v) => { setLineSpacing(v); setResult(null); }} />
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Page</h3>
        <label className="block text-xs">
          <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Size</span>
          <select
            value={pageSize}
            onChange={(e) => { setPageSize(e.target.value); setResult(null); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
          >
            {PAGE_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div>
          <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Orientation</span>
          <Segmented
            options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]}
            value={orientation}
            onChange={(v) => { setOrientation(v); setResult(null); }}
          />
        </div>
        <RangeSlider label="Margin" value={marginMm} min={8} max={40} suffix=" mm"
          onChange={(v) => { setMarginMm(v); setResult(null); }} />
      </section>

      <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="block text-xs">
          <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Title (optional)</span>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setResult(null); }}
            placeholder="Shown in bold at the top"
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
          />
        </label>
        <label className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300">
          <input type="checkbox" checked={pageNumbers} onChange={(e) => { setPageNumbers(e.target.checked); setResult(null); }}
            className="h-4 w-4 rounded accent-purple-600" />
          Add page numbers
        </label>
      </section>

      {hasUnsupported && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
          Some characters (e.g. Hindi or other regional scripts) can’t be embedded here and will show as “?”.
          For those, use <span className="font-medium">Word to PDF</span> instead.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
      )}
    </>
  );

  if (busy || result) {
    return (
      <div className={`max-w-xl mx-auto ${card} px-4 py-3`}>
        <ResultScreen
          working={busy}
          done={!!result}
          title="Your PDF is ready"
          workingLabel="Laying out the pages…"
          subtitle={result ? `${stats.words.toLocaleString()} words · ${formatBytes(result.size)}` : undefined}
          fileName={outName}
          fileSize={result?.size}
          onDownload={() => result && downloadBlob(result.blob, outName)}
          onBack={backFromResult}
          backLabel="Back to the text"
        />
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
      <aside className={`lg:sticky lg:top-24 ${card} flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]`}>
        <div className="flex-1 lg:overflow-y-auto p-5 space-y-5">{sidebar}</div>
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            type="button"
            onClick={build}
            disabled={!text.trim() || busy}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {busy ? 'Building…' : 'Create PDF'}
          </button>
        </div>
      </aside>

      <div className={`min-w-0 ${card} p-4 md:p-6`}>
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.md,.markdown,.csv,.tsv,.log,.text,.json,.xml,.yml,.yaml,.ini,text/*"
          className="hidden"
          onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = ''; }}
        />

        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {fileName || 'Your text'}
            <span className="ml-2 text-xs font-normal text-gray-400 dark:text-gray-500">
              {stats.lines.toLocaleString()} lines · {stats.words.toLocaleString()} words · {stats.chars.toLocaleString()} chars
            </span>
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Upload .txt
            </button>
            {text && (
              <button
                type="button"
                onClick={() => { setText(''); setFileName(''); setResult(null); setError(null); }}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
          onDrop={onDrop}
          className={`relative rounded-xl border-2 ${dragging ? 'border-purple-500 border-dashed' : 'border-transparent'}`}
        >
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value.slice(0, MAX_CHARS)); setResult(null); }}
            placeholder="Paste or type your text here — or drop a .txt file anywhere in this box."
            spellCheck={false}
            className="w-full h-[calc(100vh-20rem)] min-h-[340px] p-3.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-sm text-gray-800 dark:text-gray-200 font-mono leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {dragging && (
            <div className="pointer-events-none absolute inset-0 rounded-xl bg-purple-500/10 flex items-center justify-center text-sm font-medium text-purple-700 dark:text-purple-300">
              Drop the text file to load it
            </div>
          )}
        </div>
        <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
          Everything runs in your browser — the text never leaves your device. Blank lines and indentation are kept;
          a form-feed character starts a new page.
        </p>
      </div>
    </div>
  );
};

export default TextToPdf;

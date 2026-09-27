import React, {
  useCallback, useContext, useEffect, useRef, useState,
} from 'react';
import {
  LuTrash2, LuUndo2, LuCheck, LuDownload, LuLoader2, LuScanLine, LuFileText, LuRotateCcw,
  LuWifiOff, LuType, LuTable, LuShieldCheck, LuArrowRight, LuImage,
} from 'react-icons/lu';
import FileDropzone from '../../tool/FileDropzone';
import { ToolBackContext } from '../../ToolWrapper';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes, stripExt } from '../../../lib/format';
import { SERVER_UPLOAD_MB, screenFiles, rejectionMessage } from '../../../lib/fileValidation';
import { api } from '../../../lib/api';
import { openPdf, renderThumbnail, renderPageToCanvas } from '../../../lib/pdfjs';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { ocrLines } from '../../../lib/ocr';
import {
  buildUploadPdf, cleanDocxFonts, detectRules, gridCells, cropCanvas, maskTables, shiftLines, inkFit, markBold,
} from '../../../lib/pdfToWord';
import { renderDocx } from '../../../lib/docxToPdf';

const PREVIEW_CSS = `
.p2w-preview .docx-wrapper { background: transparent; padding: 0; }
.p2w-preview .docx-wrapper > section.docx {
  margin: 0 auto 1.5rem; box-shadow: 0 2px 10px rgba(15,23,42,.12), 0 12px 32px -12px rgba(15,23,42,.3);
}`;

const STEPS = ['Choose pages', 'Convert', 'Download'];

const Stepper = ({ at }) => (
  <ol className="mx-auto mb-6 flex max-w-xl items-center justify-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
    {STEPS.map((s, i) => (
      <li key={s} className="flex items-center gap-2 sm:gap-3">
        <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 transition-colors ${
          i === at ? 'bg-[#2B579A] text-white shadow-md shadow-blue-700/25'
            : i < at ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500'}`}
        >
          <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${i === at ? 'bg-white/25' : i < at ? 'bg-emerald-500 text-white' : 'bg-white dark:bg-gray-700'}`}>
            {i < at ? <LuCheck className="h-3 w-3" /> : i + 1}
          </span>
          {s}
        </span>
        {i < STEPS.length - 1 && <span className="h-px w-4 bg-gray-300 sm:w-8 dark:bg-gray-600" />}
      </li>
    ))}
  </ol>
);

const JobStep = ({ state, label, detail }) => (
  <li className="flex items-start gap-3">
    <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full ${
      state === 'done' ? 'bg-emerald-500 text-white' : state === 'doing' ? 'bg-blue-50 text-[#2B579A] dark:bg-blue-500/15 dark:text-blue-300' : 'bg-gray-100 text-gray-300 dark:bg-gray-700 dark:text-gray-500'}`}
    >
      {state === 'done' ? <LuCheck className="h-3.5 w-3.5" /> : state === 'doing' ? <LuLoader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
    </span>
    <span className="min-w-0">
      <span className={`block text-sm font-semibold ${state === 'todo' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}>{label}</span>
      {detail && state === 'doing' && <span className="block text-xs text-gray-500 dark:text-gray-400">{detail}</span>}
    </span>
  </li>
);

const PdfToWord = () => {
  const registerBack = useContext(ToolBackContext);
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]); // { index, thumb, scanned, deleted }
  const [loading, setLoading] = useState(false);
  const [server, setServer] = useState('checking'); // checking | ready | offline
  const [ocrMode, setOcrMode] = useState('ocr'); // ocr | image
  const [job, setJob] = useState(null); // { step, detail, pct }
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const docRef = useRef(null); // { bytes, pdf }
  const token = useRef(0);
  const previewRef = useRef(null);
  const previewBox = useRef(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let alive = true;
    api.get('/health', { timeout: 5000 })
      .then((res) => { if (alive) setServer(res.data?.pdf_to_word ? 'ready' : 'offline'); })
      .catch(() => { if (alive) setServer('offline'); });
    return () => { alive = false; };
  }, []);

  const reset = useCallback(() => {
    token.current += 1;
    docRef.current = null;
    setFile(null);
    setPages([]);
    setJob(null);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(file ? (result ? () => setResult(null) : reset) : null);
    return () => registerBack(null);
  }, [file, result, registerBack, reset]);

  /* ---- open: thumbnails + which pages are scans ---- */
  const open = async (f) => {
    const { accepted, rejected } = screenFiles([f], { accept: 'application/pdf,.pdf', maxMB: SERVER_UPLOAD_MB.convert });
    if (!accepted.length) { setError(rejectionMessage(rejected)); return; }
    const t = ++token.current;
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      let pdf;
      try {
        pdf = await openPdf(bytes.slice());
      } catch (e) {
        throw new Error(/password/i.test(e?.name || e?.message || '') ? 'This PDF is password-protected. Unlock it first (Unlock PDF tool), then convert it.' : 'This file couldn’t be opened as a PDF.');
      }
      if (t !== token.current) return;
      docRef.current = { bytes, pdf };
      setFile(f);
      setPages(Array.from({ length: pdf.numPages }, (_, i) => ({ index: i, thumb: null, scanned: false, deleted: false })));
      setLoading(false);
      for (let i = 1; i <= pdf.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await pdf.getPage(i);
        // eslint-disable-next-line no-await-in-loop
        const tc = await page.getTextContent();
        const chars = tc.items.reduce((n, it) => n + (it.str || '').replace(/\s/g, '').length, 0);
        // eslint-disable-next-line no-await-in-loop
        const thumb = await renderThumbnail(pdf, i, 260);
        if (t !== token.current) return;
        setPages((ps) => ps.map((p) => (p.index === i - 1 ? { ...p, thumb, scanned: chars < 8 } : p)));
      }
    } catch (e) {
      if (t !== token.current) return;
      setLoading(false);
      setFile(null);
      setError(e.message);
    }
  };

  useEffect(() => consumePdfHandoff((f) => open(f), 'document'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const kept = pages.filter((p) => !p.deleted);
  const scannedKept = kept.filter((p) => p.scanned);
  const toggle = (index) => setPages((ps) => ps.map((p) => (p.index === index ? { ...p, deleted: !p.deleted } : p)));

  /* ---- convert ---- */
  const convert = async () => {
    const { bytes, pdf } = docRef.current;
    const doOcr = ocrMode === 'ocr' && scannedKept.length > 0;
    setError(null);
    setResult(null);
    setJob({ step: 'prepare' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const plan = [];
      let done = 0;
      for (const p of kept) {
        if (doOcr && p.scanned) {
          done += 1;
          setJob({ step: 'ocr', detail: `Page ${p.index + 1} · ${done} of ${scannedKept.length}` });
          // eslint-disable-next-line no-await-in-loop
          const pg = await pdf.getPage(p.index + 1);
          const vp = pg.getViewport({ scale: 1 });
          const scale = Math.min(4, 2400 / vp.width);
          // eslint-disable-next-line no-await-in-loop
          const canvas = await renderPageToCanvas(pdf, p.index + 1, { scale });
          const rules = detectRules(canvas); // table grid lines, if any
          const tables = gridCells(rules);
          const label = `Page ${p.index + 1} · ${done} of ${scannedKept.length}`;
          // The page text (tables blanked out) …
          // eslint-disable-next-line no-await-in-loop
          const lines = await ocrLines(tables.length ? maskTables(canvas, tables) : canvas, (pr) => setJob({ step: 'ocr', detail: `${label} · ${Math.round(pr * 100)}%` }));
          // … then every table cell on its own, which reads far more reliably.
          const cells = tables.flatMap((t) => t.cells).filter((c) => c.x1 - c.x0 > 14 && c.y1 - c.y0 > 14);
          for (let ci = 0; ci < cells.length; ci += 1) {
            setJob({ step: 'ocr', detail: `${label} · table cell ${ci + 1} of ${cells.length}` });
            const crop = cropCanvas(canvas, cells[ci]);
            // eslint-disable-next-line no-await-in-loop
            // short cell text (a lone '1') scores low — borders are already cropped away
            const got = await ocrLines(crop.canvas, null, { psm: '6', minConf: 8 });
            lines.push(...shiftLines(inkFit(crop.canvas, got), crop.dx, crop.dy));
          }
          const styled = markBold(canvas, lines); // headings etc. keep their bold
          plan.push({
            index: p.index,
            ocr: {
              lines: styled, rules, tables, pxW: canvas.width, pxH: canvas.height, ptW: vp.width, ptH: vp.height,
            },
          });
        } else plan.push({ index: p.index });
      }

      setJob({ step: 'prepare' });
      const untouched = kept.length === pages.length && !plan.some((p) => p.ocr);
      const upload = untouched ? bytes : await buildUploadPdf(bytes, plan);

      const fd = new FormData();
      fd.append('file', new Blob([upload], { type: 'application/pdf' }), `${stripExt(file.name)}.pdf`);
      setJob({ step: 'upload', pct: 0 });
      const res = await api.post('/convert/pdf-to-word', fd, {
        responseType: 'blob',
        timeout: 300000,
        onUploadProgress: (e) => {
          if (!e.total) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setJob(pct >= 100 ? { step: 'rebuild' } : { step: 'upload', pct });
        },
      });
      let blob = res.data;
      if (!blob || /json|text/.test(blob.type || '')) {
        let msg = 'The converter didn’t return a Word document.';
        try { msg = JSON.parse(await blob.text()).error || msg; } catch { /* keep */ }
        throw new Error(msg);
      }
      setJob({ step: 'finish' });
      blob = await cleanDocxFonts(blob);
      setResult({
        blob, size: blob.size, pages: kept.length, ocrPages: doOcr ? scannedKept.length : 0, removed: pages.length - kept.length,
      });
    } catch (e) {
      let msg = e?.message || 'Conversion failed.';
      if (e?.response?.status === 413) msg = `This file is too large to convert (limit ${SERVER_UPLOAD_MB.convert} MB).`;
      else if (e?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).error || msg; } catch { /* keep */ }
      } else if (!e?.response && /network/i.test(msg)) msg = 'The converter isn’t responding right now — please try again in a moment.';
      setError(msg);
    } finally {
      setJob(null);
    }
  };

  /* ---- result preview: the Word document itself ---- */
  useEffect(() => {
    if (!result || !previewRef.current) return undefined;
    let alive = true;
    (async () => {
      try {
        await renderDocx(await result.blob.arrayBuffer(), previewRef.current, previewRef.current);
        if (!alive) return;
        const fit = () => {
          const w = previewBox.current?.clientWidth || 800;
          setZoom(Math.min(1, (w - 32) / 820));
        };
        fit();
      } catch { /* preview is optional */ }
    })();
    return () => { alive = false; };
  }, [result]);

  const outName = `${stripExt(file?.name || 'document')}.docx`;

  /* ---------------- views ---------------- */

  if (!file) {
    return (
      <div className="mx-auto max-w-3xl">
        {loading ? (
          <div className="flex flex-col items-center py-24 text-gray-500">
            <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#2B579A]" />
            Opening your PDF…
          </div>
        ) : (
          <>
            <FileDropzone
              accept="application/pdf,.pdf"
              maxMB={SERVER_UPLOAD_MB.convert}
              onFiles={(fs) => open(fs[0])}
              paste={false}
              title="Drop a PDF to turn into Word"
              hint="or click to choose a PDF"
              formats={`PDF up to ${SERVER_UPLOAD_MB.convert} MB → editable .docx`}
            />
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                [LuType, 'Editable text', 'Paragraphs, fonts, bold and alignment come through as real Word text.'],
                [LuTable, 'Tables & images', 'Tables stay tables and pictures stay in place.'],
                [LuScanLine, 'Scans too', 'Scanned pages are read (OCR) and turned into text you can edit.'],
              ].map(([Icon, t, d]) => (
                <div key={t} className="rounded-2xl border border-gray-200/70 bg-white/70 p-4 dark:border-gray-700/60 dark:bg-gray-800/60">
                  {Icon && <Icon className="h-5 w-5 text-[#2B579A] dark:text-blue-300" />}
                  <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{t}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{d}</p>
                </div>
              ))}
            </div>
          </>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  /* ---- working ---- */
  if (job) {
    const order = ['prepare', 'ocr', 'upload', 'rebuild', 'finish'];
    const hasOcr = ocrMode === 'ocr' && scannedKept.length > 0;
    const steps = [
      ['prepare', 'Preparing your pages', `${kept.length} page${kept.length === 1 ? '' : 's'}`],
      ...(hasOcr ? [['ocr', 'Reading scanned pages (OCR)', job.detail]] : []),
      ['upload', 'Uploading', job.pct != null ? `${job.pct}%` : null],
      ['rebuild', 'Rebuilding the layout', 'Paragraphs, fonts, tables and images'],
      ['finish', 'Final touches', 'Word font names and preview'],
    ];
    const at = order.indexOf(job.step);
    return (
      <div className="mx-auto max-w-xl">
        <Stepper at={1} />
        <div className="rounded-3xl border border-gray-200/70 bg-white p-6 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)] dark:border-gray-700/60 dark:bg-gray-800">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2B579A] to-[#3f7bd6] text-white"><LuFileText className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100">{file.name}</p>
              <p className="text-xs text-gray-400">Converting to Word…</p>
            </div>
          </div>
          <ul className="space-y-4">
            {steps.map(([key, label, detail]) => {
              const i = order.indexOf(key);
              const state = i < at ? 'done' : i === at ? 'doing' : 'todo';
              return <JobStep key={key} state={state} label={label} detail={detail} />;
            })}
          </ul>
          {job.step === 'upload' && job.pct != null && (
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div className="h-full rounded-full bg-gradient-to-r from-[#2B579A] to-[#5b9bf0] transition-all" style={{ width: `${job.pct}%` }} />
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---- done ---- */
  if (result) {
    return (
      <div className="mx-auto max-w-5xl">
        <style>{PREVIEW_CSS}</style>
        <Stepper at={2} />
        <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)] dark:border-gray-700/60 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-4 px-6 py-7 text-center sm:flex-row sm:text-left">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"><LuCheck className="h-7 w-7" /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Your Word document is ready</h2>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">{`${outName} · ${result.pages} page${result.pages === 1 ? '' : 's'} · ${formatBytes(result.size)}`}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => downloadBlob(result.blob, outName)} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[#2B579A] to-[#3f7bd6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-700/25 transition hover:brightness-110">
                <LuDownload className="h-4 w-4" /> Download .docx
              </button>
              <button type="button" onClick={() => setResult(null)} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-blue-300 hover:text-[#2B579A] dark:border-gray-600 dark:text-gray-300">
                <LuUndo2 className="h-4 w-4" /> Change pages
              </button>
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                <LuRotateCcw className="h-4 w-4" /> Another PDF
              </button>
            </div>
          </div>
          {(result.ocrPages > 0 || result.removed > 0) && (
            <div className="flex flex-wrap gap-2 border-t border-gray-100 px-6 py-3 text-xs dark:border-gray-700/70">
              {result.ocrPages > 0 && <span className="rounded-full bg-blue-50 px-2.5 py-1 font-medium text-[#2B579A] dark:bg-blue-500/15 dark:text-blue-300">{`${result.ocrPages} scanned page${result.ocrPages === 1 ? '' : 's'} turned into editable text`}</span>}
              {result.removed > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">{`${result.removed} page${result.removed === 1 ? '' : 's'} left out`}</span>}
            </div>
          )}
        </div>
        <p className="mb-3 mt-6 text-center text-xs font-semibold uppercase tracking-wide text-gray-400">Preview of your Word document</p>
        <div ref={previewBox} className="overflow-hidden rounded-3xl bg-gray-100 px-4 py-8 dark:bg-gray-900/50">
          <div className="p2w-preview" style={{ zoom }} ref={previewRef} />
        </div>
      </div>
    );
  }

  /* ---- choose pages ---- */
  return (
    <div className="mx-auto max-w-6xl pb-28">
      <Stepper at={0} />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200/70 bg-white px-4 py-3 shadow-sm dark:border-gray-700/60 dark:bg-gray-800">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300"><LuFileText className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100" title={file.name}>{file.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {`${kept.length} of ${pages.length} page${pages.length === 1 ? '' : 's'} will be converted`}
            {kept.length < pages.length && (
              <button type="button" onClick={() => setPages((ps) => ps.map((p) => ({ ...p, deleted: false })))} className="ml-2 font-semibold text-[#2B579A] hover:underline dark:text-blue-300">Restore all</button>
            )}
          </p>
        </div>
        <button type="button" onClick={reset} className="rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">Change file</button>
      </div>

      {scannedKept.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <LuScanLine className="h-4 w-4" />
            {`${scannedKept.length} page${scannedKept.length === 1 ? ' is a scan' : 's are scans'} — the text is a picture`}
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ['ocr', LuType, 'Make the text editable', 'Read the words (OCR, English) and rebuild them as Word text. Recommended.'],
              ['image', LuImage, 'Keep as pictures', 'Put each scanned page into Word as an image, exactly as it looks.'],
            ].map(([v, Icon, t, d]) => (
              <button
                key={v}
                type="button"
                onClick={() => setOcrMode(v)}
                className={`flex items-start gap-3 rounded-xl border-2 p-3 text-left transition ${ocrMode === v ? 'border-[#2B579A] bg-white shadow-sm dark:bg-gray-800' : 'border-transparent bg-white/60 hover:border-amber-300 dark:bg-gray-800/40'}`}
              >
                {Icon && <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${ocrMode === v ? 'text-[#2B579A] dark:text-blue-300' : 'text-gray-400'}`} />}
                <span>
                  <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{t}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{d}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {pages.map((p) => (
          <div key={p.index} className={`group relative rounded-2xl bg-white p-2 shadow-sm ring-1 transition dark:bg-gray-800 ${p.deleted ? 'ring-red-200 dark:ring-red-500/30' : 'ring-gray-200/70 hover:shadow-lg hover:ring-blue-300 dark:ring-gray-700'}`}>
            <div className="mb-2 flex items-center justify-between gap-1 px-0.5">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{`Page ${p.index + 1}`}</span>
              <span className="flex items-center gap-1">
                {p.scanned && !p.deleted && <span className="rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">Scan</span>}
                <button
                  type="button"
                  onClick={() => toggle(p.index)}
                  disabled={!p.deleted && kept.length === 1}
                  title={p.deleted ? 'Put this page back' : 'Leave this page out'}
                  aria-label={p.deleted ? `Restore page ${p.index + 1}` : `Delete page ${p.index + 1}`}
                  className={`grid h-7 w-7 place-items-center rounded-lg transition disabled:opacity-30 ${p.deleted ? 'bg-blue-50 text-[#2B579A] hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300' : 'bg-red-50 text-red-500 hover:bg-red-500 hover:text-white dark:bg-red-500/15 dark:text-red-300'}`}
                >
                  {p.deleted ? <LuUndo2 className="h-3.5 w-3.5" /> : <LuTrash2 className="h-3.5 w-3.5" />}
                </button>
              </span>
            </div>
            <div className="relative overflow-hidden rounded-lg bg-gray-50 ring-1 ring-black/5 dark:bg-gray-900" style={{ aspectRatio: p.thumb ? `${p.thumb.width} / ${p.thumb.height}` : '1 / 1.414' }}>
              {p.thumb ? (
                <img src={p.thumb.dataUrl} alt={`Page ${p.index + 1}`} className={`h-full w-full object-contain transition ${p.deleted ? 'scale-95 opacity-30 grayscale' : ''}`} />
              ) : (
                <div className="grid h-full place-items-center"><div className="h-6 w-6 animate-spin rounded-full border-[3px] border-gray-200 border-t-[#2B579A]" /></div>
              )}
              {p.deleted && (
                <button type="button" onClick={() => toggle(p.index)} className="absolute inset-0 grid place-items-center">
                  <span className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 shadow ring-1 ring-red-100 dark:bg-gray-800 dark:text-red-300">Left out · tap to restore</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}

      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex flex-col items-center gap-2 px-4">
        {server === 'offline' && (
          <p className="pointer-events-auto flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-medium text-amber-800 shadow dark:bg-amber-500/20 dark:text-amber-200">
            <LuWifiOff className="h-3.5 w-3.5" /> The converter isn&rsquo;t responding right now — try again in a moment.
          </p>
        )}
        <button
          type="button"
          onClick={convert}
          disabled={!kept.length || server === 'offline'}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#2B579A] to-[#3f7bd6] px-8 py-3.5 text-base font-semibold text-white shadow-xl shadow-blue-700/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-400 disabled:shadow-none"
        >
          {`Convert ${kept.length} page${kept.length === 1 ? '' : 's'} to Word`}
          <LuArrowRight className="h-5 w-5" />
        </button>
        <p className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-[11px] text-gray-500 backdrop-blur dark:bg-gray-800/80 dark:text-gray-400">
          <LuShieldCheck className="h-3.5 w-3.5" /> Deleted from the server as soon as your document is ready
        </p>
      </div>
    </div>
  );
};

export default PdfToWord;

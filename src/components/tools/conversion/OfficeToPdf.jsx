import React, {
  useContext, useEffect, useRef, useState,
} from 'react';
import {
  LuFileText, LuX, LuPlus, LuCheck, LuDownload, LuLoader2, LuAlertCircle,
  LuArchive, LuCombine, LuRotateCcw, LuEye, LuType, LuWifiOff,
} from 'react-icons/lu';
import FileDropzone from '../../tool/FileDropzone';
import OpenInPdfTool from '../../tool/OpenInPdfTool';
import PdfPagesPreview from '../../tool/PdfPagesPreview';
import { ToolBackContext } from '../../ToolWrapper';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes } from '../../../lib/format';
import { toolFileName } from '../../../lib/fileNames';
import { SERVER_UPLOAD_MB, screenFiles, rejectionMessage } from '../../../lib/fileValidation';
import { api } from '../../../lib/api';
import { isDesktop } from '../../../lib/desktop';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';
import { requestLocalFonts } from '../../../lib/localFonts';
import { canEmbedFonts, embedLocalFonts } from '../../../lib/docxFonts';
import { renderDocx, docxSectionsToPdf } from '../../../lib/docxToPdf';

const MAX_FILES = 10;
const extOf = (name = '') => (name.match(/\.([^.]+)$/) || [])[1]?.toLowerCase() || '';

let seq = 0;

/** Brand-coloured file tile with the file type. */
const DocTile = ({ ext, icon: Icon = LuFileText, size = 'md' }) => (
  <span className={`relative grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--brand)] to-[var(--brand2)] text-white shadow-sm ${size === 'lg' ? 'h-14 w-12' : 'h-11 w-10'}`}>
    {Icon && <Icon className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />}
    <span className="absolute -bottom-1.5 rounded bg-white px-1 text-[8.5px] font-bold uppercase tracking-wide text-[var(--brand)] shadow ring-1 ring-black/5">{ext || 'doc'}</span>
  </span>
);

const STEP_LABEL = {
  queued: 'Ready',
  fonts: 'Packing your fonts…',
  upload: 'Uploading…',
  convert: 'Converting with LibreOffice…',
  render: 'Converting in your browser…',
  check: 'Preparing preview…',
};

/**
 * Office file → PDF with LibreOffice on the conversion server. One design
 * for Word, PowerPoint and Excel; `cfg` supplies the endpoint, file types,
 * brand colours and wording. Word files additionally get the user's fonts
 * packed in and an in-browser fallback.
 */
const OfficeToPdf = ({ cfg }) => {
  const isWord = cfg.kind === 'word';
  const brandVars = {
    '--brand': cfg.brand[0], '--brand2': cfg.brand[1], '--brand-soft': cfg.brand[2], '--brand-light': cfg.brand[3],
  };
  const ACCEPT = cfg.accept;
  const registerBack = useContext(ToolBackContext);
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);
  const [server, setServer] = useState('checking'); // checking | online | offline
  const [error, setError] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [busyAll, setBusyAll] = useState(null); // 'zip' | 'merge'
  const [optOn, setOptOn] = useState(cfg.option ? cfg.option.default : false);
  const addInput = useRef(null);
  const offscreen = useRef(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Is the conversion engine reachable?
  useEffect(() => {
    let alive = true;
    api.get('/health', { timeout: 5000 })
      .then((res) => { if (alive) setServer((res.data?.[cfg.healthKey] ?? res.data?.libreoffice) ? 'online' : 'offline'); })
      .catch(() => { if (alive) setServer('offline'); });
    return () => { alive = false; };
  }, [cfg.healthKey]);

  const patch = (id, p) => setItems((list) => list.map((it) => (it.id === id ? { ...it, ...p } : it)));

  const addFiles = (files) => {
    setError(null);
    const { accepted, rejected } = screenFiles(files, { accept: ACCEPT, maxMB: SERVER_UPLOAD_MB.convert });
    const room = MAX_FILES - itemsRef.current.length;
    const take = accepted.slice(0, Math.max(0, room));
    const msgs = [rejectionMessage(rejected)];
    if (accepted.length > take.length) msgs.push(`Up to ${MAX_FILES} documents at a time.`);
    const msg = msgs.filter(Boolean).join(' ');
    if (msg) setError(msg);
    if (!take.length) return;
    setItems((list) => [...list, ...take.map((file) => {
      seq += 1;
      return { id: `w${seq}`, file, status: 'queued', pct: 0 };
    })]);
  };

  const reset = () => {
    setItems([]);
    setError(null);
    setPreviewId(null);
  };

  const allDone = items.length > 0 && items.every((it) => it.status === 'done' || it.status === 'error');
  const doneItems = items.filter((it) => it.status === 'done');
  const showResults = allDone && !running && doneItems.length > 0;

  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(items.length ? reset : null);
    return () => registerBack(null);
  }, [items.length, registerBack]);

  // The result screen is short — show it from the top.
  useEffect(() => { if (showResults) window.scrollTo({ top: 0, behavior: 'smooth' }); }, [showResults]);

  /* ---------------- conversion ---------------- */

  const viaServer = async (it, file) => {
    const fd = new FormData();
    fd.append('file', file, it.file.name);
    patch(it.id, { status: 'upload', pct: 0 });
    const res = await api.post(cfg.endpoint, fd, {
      responseType: 'blob',
      timeout: 240000,
      onUploadProgress: (e) => {
        if (!e.total) return;
        const pct = Math.round((e.loaded / e.total) * 100);
        patch(it.id, pct >= 100 ? { status: 'convert', pct: 100 } : { pct });
      },
    });
    const blob = res.data;
    if (!blob || (blob.type && !blob.type.includes('pdf'))) {
      let msg = 'The converter returned something that isn’t a PDF.';
      try { msg = JSON.parse(await blob.text()).error || msg; } catch { /* keep default */ }
      throw new Error(msg);
    }
    return new Blob([blob], { type: 'application/pdf' });
  };

  const inBrowser = async (it) => {
    if (!isWord || extOf(it.file.name) !== 'docx') throw new Error(`The converter isn’t responding right now — please try again in a moment.`);
    patch(it.id, { status: 'render' });
    const host = offscreen.current;
    const sections = await renderDocx(await it.file.arrayBuffer(), host, host);
    const blob = await docxSectionsToPdf(sections, { scale: 2 });
    host.innerHTML = '';
    return blob;
  };

  const convertOne = async (it, fontsReady) => {
    try {
      let file = it.file;
      let fonts = null;
      let blob;
      let engine = 'libreoffice';
      if (server !== 'offline') {
        if (isWord && fontsReady && extOf(it.file.name) === 'docx') {
          patch(it.id, { status: 'fonts' });
          await fontsReady;
          const r = await embedLocalFonts(it.file);
          file = r.blob;
          fonts = { embedded: r.embedded, missing: r.missing };
        }
        // tool-specific preparation (Excel: fit sheets to the page width)
        if (cfg.option && optOn && cfg.option.exts.includes(extOf(it.file.name))) file = await cfg.option.apply(file);
        try {
          blob = await viaServer(it, file);
        } catch (e) {
          if (e?.response?.status === 413) throw new Error(`This file is too large to convert (limit ${SERVER_UPLOAD_MB.convert} MB).`);
          if (e?.response || !isWord || extOf(it.file.name) !== 'docx') throw e;
          // network failure: the engine is down — fall back to the browser
          setServer('offline');
          blob = await inBrowser(it);
          engine = 'browser';
        }
      } else {
        blob = await inBrowser(it);
        engine = 'browser';
      }
      patch(it.id, { status: 'check' });
      const pdf = await openPdf(new Uint8Array(await blob.arrayBuffer()));
      const thumb = await renderThumbnail(pdf, 1, 420);
      patch(it.id, {
        status: 'done', blob, pages: pdf.numPages, thumb, fonts, engine, size: blob.size,
      });
    } catch (e) {
      let msg = e?.message || 'Conversion failed.';
      if (e?.response?.data instanceof Blob) {
        try { msg = JSON.parse(await e.response.data.text()).error || msg; } catch { /* keep */ }
      }
      if (/timeout/i.test(msg)) msg = 'The conversion took too long — the document may be very large.';
      patch(it.id, { status: 'error', error: msg });
    }
  };

  const convertAll = async () => {
    // Ask for the computer's fonts while we still have the click.
    const wantFonts = isWord && server !== 'offline' && !isDesktop() && canEmbedFonts()
      && itemsRef.current.some((it) => extOf(it.file.name) === 'docx');
    const fontsReady = wantFonts ? requestLocalFonts() : null;
    setRunning(true);
    setError(null);
    for (const it of itemsRef.current) {
      if (it.status === 'done') continue;
      // one at a time: kind to the conversion server
      // eslint-disable-next-line no-await-in-loop
      await convertOne(it, fontsReady);
    }
    setRunning(false);
  };

  /* ---------------- download helpers ---------------- */

  const outName = (it) => toolFileName(it.file, cfg.toolId, 'pdf');

  const downloadZip = async () => {
    setBusyAll('zip');
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const used = new Set();
      doneItems.forEach((it) => {
        let n = outName(it);
        for (let k = 2; used.has(n); k += 1) n = toolFileName(it.file, cfg.toolId, 'pdf', k);
        used.add(n);
        zip.file(n, it.blob);
      });
      downloadBlob(await zip.generateAsync({ type: 'blob' }), toolFileName(doneItems.length === 1 ? doneItems[0].file : null, cfg.toolId, 'zip'));
    } finally { setBusyAll(null); }
  };

  const downloadMerged = async () => {
    setBusyAll('merge');
    try {
      const { PDFDocument } = await import('pdf-lib');
      const out = await PDFDocument.create();
      for (const it of doneItems) {
        // eslint-disable-next-line no-await-in-loop
        const src = await PDFDocument.load(await it.blob.arrayBuffer());
        // eslint-disable-next-line no-await-in-loop
        const pages = await out.copyPages(src, src.getPageIndices());
        pages.forEach((p) => out.addPage(p));
      }
      downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), toolFileName(doneItems[0]?.file, cfg.toolId, 'pdf', 'all'));
    } finally { setBusyAll(null); }
  };

  /* ---------------- views ---------------- */

  const offscreenHost = (
    <div aria-hidden="true" style={{ position: 'fixed', left: -20000, top: 0, width: 900 }}>
      <div ref={offscreen} />
    </div>
  );

  if (!items.length) {
    return (
      <div className="mx-auto max-w-3xl" style={brandVars}>
        <FileDropzone
          accept={ACCEPT}
          multiple
          maxMB={SERVER_UPLOAD_MB.convert}
          onFiles={addFiles}
          paste={false}
          title={cfg.dropTitle}
          hint="or click to choose — convert up to 10 at once"
          formats={`${cfg.formats} · up to ${SERVER_UPLOAD_MB.convert} MB each`}
        />
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {cfg.features.map(([Icon, t, d]) => (
            <div key={t} className="rounded-2xl border border-gray-200/70 bg-white/70 p-4 dark:border-gray-700/60 dark:bg-gray-800/60">
              {Icon && <Icon className="h-5 w-5 text-[var(--brand)] dark:text-[var(--brand-light)]" />}
              <p className="mt-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{t}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{d}</p>
            </div>
          ))}
        </div>
        {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  /* ---- results ---- */
  if (showResults) {
    const single = doneItems.length === 1 && items.length === 1 ? doneItems[0] : null;
    const failed = items.filter((it) => it.status === 'error');
    const fontInfo = (it) => (it.fonts && (it.fonts.embedded.length || it.fonts.missing.length) ? it.fonts : null);
    const previewItem = previewId ? doneItems.find((it) => it.id === previewId) : null;

    return (
      <div className="mx-auto max-w-5xl" style={brandVars}>
        <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)] dark:border-gray-700/60 dark:bg-gray-800">
          <div className="flex flex-col items-center gap-4 px-6 py-7 text-center sm:flex-row sm:text-left">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
              <LuCheck className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {single ? 'Your PDF is ready' : `${doneItems.length} PDFs are ready`}
              </h2>
              <p className="mt-0.5 truncate text-sm text-gray-500 dark:text-gray-400">
                {single
                  ? `${outName(single)} · ${single.pages} page${single.pages === 1 ? '' : 's'} · ${formatBytes(single.size)}`
                  : `${doneItems.reduce((n, it) => n + it.pages, 0)} pages in total`}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {single ? (
                <button
                  type="button"
                  onClick={() => downloadBlob(single.blob, outName(single))}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand2)] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[0_10px_24px_-10px_var(--brand)] transition hover:brightness-110"
                >
                  <LuDownload className="h-4 w-4" /> Download PDF
                </button>
              ) : (
                <>
                  <button type="button" onClick={downloadZip} disabled={!!busyAll} className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand2)] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[0_10px_24px_-10px_var(--brand)] transition hover:brightness-110 disabled:opacity-60">
                    {busyAll === 'zip' ? <LuLoader2 className="h-4 w-4 animate-spin" /> : <LuArchive className="h-4 w-4" />} Download all (ZIP)
                  </button>
                  <button type="button" onClick={downloadMerged} disabled={!!busyAll} className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-[var(--brand)] hover:text-[var(--brand)] disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200">
                    {busyAll === 'merge' ? <LuLoader2 className="h-4 w-4 animate-spin" /> : <LuCombine className="h-4 w-4" />} Merge into one PDF
                  </button>
                </>
              )}
              <button type="button" onClick={reset} className="inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white">
                <LuRotateCcw className="h-4 w-4" /> Convert more
              </button>
            </div>
          </div>

          {single && fontInfo(single) && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 px-6 py-3 text-xs text-gray-500 dark:border-gray-700/70 dark:text-gray-400">
              {single.fonts.embedded.length > 0 && <span className="font-medium text-gray-600 dark:text-gray-300">Used your fonts:</span>}
              {single.fonts.embedded.map((f) => <span key={f} className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">{f}</span>)}
              {single.fonts.missing.length > 0 && <span className="ml-2">Not on this computer (a similar font was used):</span>}
              {single.fonts.missing.map((f) => <span key={f} className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{f}</span>)}
            </div>
          )}
          {single?.engine === 'browser' && (
            <p className="border-t border-gray-100 px-6 py-3 text-xs text-amber-700 dark:border-gray-700/70 dark:text-amber-300">
              The converter was unreachable, so this PDF was made in your browser — the layout is kept but the text is an image.
            </p>
          )}
          {failed.length > 0 && (
            <div className="border-t border-gray-100 px-6 py-3 text-xs text-red-600 dark:border-gray-700/70 dark:text-red-400">
              {failed.map((it) => <p key={it.id}>{`${it.file.name}: ${it.error}`}</p>)}
            </div>
          )}
        </div>

        {/* the real pages */}
        {single ? (
          <div className="mt-6 rounded-3xl bg-gray-100 px-4 py-8 dark:bg-gray-900/50">
            <PdfPagesPreview blob={single.blob} width={300} />
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {doneItems.map((it) => (
              <div key={it.id} className="group overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-sm transition hover:shadow-lg dark:border-gray-700/60 dark:bg-gray-800">
                <button type="button" onClick={() => setPreviewId(it.id)} className="relative block w-full bg-gray-100 p-4 dark:bg-gray-900/50" title="Preview all pages">
                  <img src={it.thumb.dataUrl} alt="" className="mx-auto max-h-64 rounded bg-white shadow ring-1 ring-black/5" />
                  <span className="absolute inset-0 grid place-items-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow"><LuEye className="h-3.5 w-3.5" /> Preview</span>
                  </span>
                </button>
                <div className="flex items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100" title={outName(it)}>{outName(it)}</p>
                    <p className="text-xs text-gray-400">{`${it.pages} page${it.pages === 1 ? '' : 's'} · ${formatBytes(it.size)}`}</p>
                  </div>
                  <button type="button" onClick={() => downloadBlob(it.blob, outName(it))} title="Download" className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] transition hover:bg-[var(--brand)] hover:text-white dark:bg-white/10 dark:text-[var(--brand-light)]">
                    <LuDownload className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {single && (
          <div className="mt-6">
            <OpenInPdfTool getPdf={() => single.blob} exclude={[cfg.toolId]} />
          </div>
        )}

        {previewItem && (
          <div className="fixed inset-0 z-[100] flex flex-col bg-gray-900/70 backdrop-blur-sm" onMouseDown={() => setPreviewId(null)}>
            <div className="flex items-center gap-3 px-5 py-3 text-white" onMouseDown={(e) => e.stopPropagation()}>
              <p className="min-w-0 flex-1 truncate text-sm font-semibold">{outName(previewItem)}</p>
              <button type="button" onClick={() => downloadBlob(previewItem.blob, outName(previewItem))} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-sm font-semibold hover:bg-white/25">
                <LuDownload className="h-4 w-4" /> Download
              </button>
              <button type="button" onClick={() => setPreviewId(null)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-xl hover:bg-white/15"><LuX className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-10" onMouseDown={(e) => e.stopPropagation()}>
              <PdfPagesPreview blob={previewItem.blob} width={340} />
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---- file list / progress ---- */
  const docxCount = items.filter((it) => extOf(it.file.name) === 'docx').length;
  return (
    <div className="mx-auto max-w-3xl" style={brandVars}>
      {offscreenHost}
      <div className="overflow-hidden rounded-3xl border border-gray-200/70 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.25)] dark:border-gray-700/60 dark:bg-gray-800">
        <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-700/70">
          <h2 className="flex-1 text-base font-bold text-gray-900 dark:text-white">
            {running ? 'Converting…' : `${items.length} ${cfg.noun}${items.length === 1 ? '' : 's'}`}
          </h2>
          {!running && items.length < MAX_FILES && (
            <>
              <button type="button" onClick={() => addInput.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-semibold text-[var(--brand)] transition hover:bg-[var(--brand-soft)] dark:text-[var(--brand-light)] dark:hover:bg-white/10">
                <LuPlus className="h-4 w-4" /> Add more
              </button>
              <input ref={addInput} type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
            </>
          )}
        </div>

        <ul className="divide-y divide-gray-100 dark:divide-gray-700/70">
          {items.map((it) => {
            const working = !['queued', 'done', 'error'].includes(it.status);
            return (
              <li key={it.id} className="flex items-center gap-4 px-5 py-4">
                <DocTile ext={extOf(it.file.name)} icon={cfg.icon} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800 dark:text-gray-100" title={it.file.name}>{it.file.name}</p>
                  {working ? (
                    <div className="mt-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand2)] transition-all duration-300 ${it.status === 'upload' ? '' : 'animate-pulse'}`}
                          style={{ width: `${it.status === 'fonts' ? 12 : it.status === 'upload' ? 12 + it.pct * 0.4 : it.status === 'check' ? 95 : 70}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {it.status === 'upload' ? `Uploading… ${it.pct}%` : STEP_LABEL[it.status]}
                      </p>
                    </div>
                  ) : (
                    <p className={`mt-0.5 text-xs ${it.status === 'error' ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}>
                      {it.status === 'error' ? it.error : it.status === 'done' ? `${it.pages} page${it.pages === 1 ? '' : 's'} · converted` : formatBytes(it.file.size)}
                    </p>
                  )}
                </div>
                {it.status === 'done' && <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white"><LuCheck className="h-4 w-4" /></span>}
                {it.status === 'error' && <LuAlertCircle className="h-6 w-6 text-red-500" />}
                {working && <LuLoader2 className="h-5 w-5 animate-spin text-[var(--brand)] dark:text-[var(--brand-light)]" />}
                {!running && it.status !== 'done' && (
                  <button type="button" onClick={() => setItems((l) => l.filter((x) => x.id !== it.id))} aria-label="Remove" className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200">
                    <LuX className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <div className="space-y-3 border-t border-gray-100 bg-gray-50/60 px-5 py-5 dark:border-gray-700/70 dark:bg-gray-900/30">
          {server === 'offline' ? (
            <p className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
              <LuWifiOff className="mt-0.5 h-4 w-4 shrink-0" />
              {isWord
                ? 'The converter isn’t reachable right now. .docx files will be converted in your browser (layout kept, text becomes an image); other formats need the converter — try again shortly.'
                : 'The converter isn’t reachable right now — please try again in a moment.'}
            </p>
          ) : isWord && docxCount > 0 && canEmbedFonts() && !isDesktop() ? (
            <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
              <LuType className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)] dark:text-[var(--brand-light)]" />
              For an exact match, the fonts your document uses are packed in from this computer — your browser may ask once to &ldquo;use fonts on your device&rdquo;.
            </p>
          ) : null}
          {cfg.option && items.some((it) => cfg.option.exts.includes(extOf(it.file.name))) && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-white/80 p-3 ring-1 ring-black/5 dark:bg-gray-800/60 dark:ring-white/10">
              <span className="relative mt-0.5 inline-flex h-5 w-9 shrink-0">
                <input type="checkbox" checked={optOn} disabled={running} onChange={(e) => setOptOn(e.target.checked)} className="peer sr-only" />
                <span className="absolute inset-0 rounded-full bg-gray-300 transition peer-checked:bg-[var(--brand)] dark:bg-gray-600" />
                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{cfg.option.label}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">{cfg.option.desc}</span>
              </span>
            </label>
          )}
          <button
            type="button"
            onClick={convertAll}
            disabled={running || !items.some((it) => it.status !== 'done') || (!isWord && server === 'offline')}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--brand)] to-[var(--brand2)] py-3.5 text-base font-semibold text-white shadow-lg shadow-[0_10px_24px_-10px_var(--brand)] transition hover:brightness-110 disabled:opacity-60"
          >
            {running ? <><LuLoader2 className="h-5 w-5 animate-spin" /> Converting…</> : `Convert to PDF${items.length > 1 ? ` (${items.length})` : ''}`}
          </button>
        </div>
      </div>
      {error && <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default OfficeToPdf;

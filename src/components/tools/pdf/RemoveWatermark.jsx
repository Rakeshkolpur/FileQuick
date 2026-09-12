import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import ResultScreen from '../../tool/ResultScreen';
import WatermarkBrushModal from '../../tool/WatermarkBrushModal';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes, stripExt } from '../../../lib/format';
import { zipFiles } from '../../../lib/zip';
import { openPdf, renderThumbnail } from '../../../lib/pdfjs';
import { findWatermarkCandidates } from '../../../lib/watermarkDetect';
import { loadImageFromFile, outExt, mimeFor } from '../../../lib/imageResize';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { consumeHandoff } from '../../../lib/imageHandoff';

const isPdfFile = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const isImageFile = (f) => f && f.type.startsWith('image/');
const baseImageFormat = (mimeType) => (mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpeg');
const hexRgb = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const COVER_SWATCHES = ['#ffffff', '#f3f4f6', '#000000', '#fef3c7'];

let uid = 0;

/**
 * Redact the chosen candidates from a PDF's bytes — for each occurrence,
 * redraws the SAME string at the SAME position, size and rotation in the
 * cover colour, on top of the original.
 *
 * This deliberately does NOT cover a padded bounding box. A big diagonal
 * watermark's bounding box is much larger than its visible strokes (a wide
 * rotated word's rectangle sweeps corner to corner across the page), so
 * painting that whole box would blank out real content the watermark just
 * happens to cross over. Re-printing the exact text only paints over the
 * actual ink — real content anywhere else under that bounding box, even
 * right next to a letter, is left alone.
 *
 * It hides the watermark visually; it does not strip the original text
 * object from the file (that needs content-stream surgery this tool can't
 * safely do), so treat it as "covered", not "deleted".
 */
async function redactPdf(job) {
  const doc = await PDFDocument.load(job.bytes);
  const pages = doc.getPages();
  // Regular weight, not bold, and NOT scaled up: a bold or larger copy
  // grows each glyph's own advance width, so on a multi-character string
  // every letter after the first drifts a little further from its
  // original spot — by the last letter of a long word the drift is
  // whole pixels, not a hairline. Same font, same size reproduces the
  // exact original layout, so every glyph lands exactly on itself.
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const color = hexRgb(job.coverColor || '#ffffff');
  // A ring of small rigid nudges (same size, just shifted) swallows the
  // anti-aliased edge pixels a single same-position redraw might leave
  // peeking out from under the original glyph strokes.
  const nudges = [
    [0, 0], [0.6, 0], [-0.6, 0], [0, 0.6], [0, -0.6], [0.6, 0.6], [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6],
  ];

  job.candidates
    .filter((c) => job.selected.has(c.text))
    .forEach((c) => {
      c.occurrences.forEach((o) => {
        const page = pages[o.page - 1];
        if (!page) return;
        const size = o.height || 12;
        const th = (o.angle * Math.PI) / 180;
        nudges.forEach(([ndx, ndy]) => {
          const x = o.x + ndx * Math.cos(th) - ndy * Math.sin(th);
          const y = o.y + ndx * Math.sin(th) + ndy * Math.cos(th);
          page.drawText(c.text, { x, y, size, font, color, rotate: degrees(o.angle) });
        });
      });
    });
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

const RemoveWatermark = () => {
  const [jobs, setJobs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null); // [{ id, name, blob, size }]
  const [error, setError] = useState(null);
  const [brushJobId, setBrushJobId] = useState(null);
  const addInputRef = useRef(null);

  const patchJob = (id, patch) => setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const loadPdfJob = async (job) => {
    try {
      const ab = await job.file.arrayBuffer();
      const doc = await openPdf(ab);
      const [candidates, thumb] = await Promise.all([
        findWatermarkCandidates(doc),
        renderThumbnail(doc, 1, 240).catch(() => null),
      ]);
      const selected = new Set(candidates.filter((c) => c.confidence === 'high').map((c) => c.text));
      patchJob(job.id, {
        bytes: ab, pageCount: doc.numPages, candidates, selected, thumb, coverColor: '#ffffff', loading: false,
      });
    } catch (e) {
      patchJob(job.id, {
        loading: false,
        loadError: e?.message?.toLowerCase().includes('password')
          ? 'Password-protected — unlock it first.'
          : 'Could not read this PDF.',
      });
    }
  };

  const loadImageJob = async (job) => {
    try {
      const img = await loadImageFromFile(job.file);
      const maxDim = 320;
      const s = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * s));
      c.height = Math.max(1, Math.round(img.naturalHeight * s));
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      patchJob(job.id, { img, previewUrl: c.toDataURL('image/jpeg', 0.85), loading: false });
    } catch (e) {
      patchJob(job.id, { loading: false, loadError: 'Could not read this image.' });
    }
  };

  const addFiles = (list) => {
    const files = [...list].filter((f) => isPdfFile(f) || isImageFile(f));
    if (!files.length) { setError('Choose PDF files, or JPG / PNG / WebP images.'); return; }
    setError(null);
    setResults(null);
    const newJobs = files.map((f) => ({
      id: ++uid, file: f, kind: isPdfFile(f) ? 'pdf' : 'image', loading: true,
    }));
    setJobs((prev) => [...prev, ...newJobs]);
    newJobs.forEach((j) => (j.kind === 'pdf' ? loadPdfJob(j) : loadImageJob(j)));
  };

  useEffect(() => consumePdfHandoff((f) => addFiles([f]), 'document'), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => consumeHandoff((f) => addFiles([f]), 'photo'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeJob = (id) => setJobs((prev) => prev.filter((j) => j.id !== id));
  const reset = () => { setJobs([]); setResults(null); setError(null); setBrushJobId(null); };
  const backFromResult = () => setResults(null);

  const toggleCandidate = (jobId, text) => {
    setJobs((prev) => prev.map((j) => {
      if (j.id !== jobId) return j;
      const next = new Set(j.selected);
      if (next.has(text)) next.delete(text); else next.add(text);
      return { ...j, selected: next };
    }));
  };

  const brushJob = jobs.find((j) => j.id === brushJobId);
  const handleBrushApply = (canvas) => {
    patchJob(brushJobId, { editedCanvas: canvas, edited: true });
    setBrushJobId(null);
  };

  const ready = jobs.length > 0
    && jobs.every((j) => !j.loading)
    && jobs.some((j) => (j.kind === 'pdf' && j.selected?.size > 0) || (j.kind === 'image' && j.edited));

  const process = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const out = [];
      for (let i = 0; i < jobs.length; i += 1) {
        const job = jobs[i];
        if (job.kind === 'pdf' && job.selected?.size > 0) {
          // eslint-disable-next-line no-await-in-loop
          const blob = await redactPdf(job);
          out.push({ id: job.id, name: `${stripExt(job.file.name)}-cleaned.pdf`, blob, size: blob.size });
        } else if (job.kind === 'image' && job.edited) {
          const fmt = baseImageFormat(job.file.type);
          // eslint-disable-next-line no-await-in-loop
          const blob = await new Promise((resolve, reject) => {
            job.editedCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export the image.'))), mimeFor(fmt), 0.92);
          });
          out.push({ id: job.id, name: `${stripExt(job.file.name)}-cleaned.${outExt(fmt)}`, blob, size: blob.size });
        }
      }
      setResults(out);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const downloadAll = async () => {
    if (!results?.length) return;
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = await zipFiles(results.map((r) => ({ name: r.name, blob: r.blob })));
    downloadBlob(zip, 'watermarks-removed.zip');
  };

  const totalSize = results ? results.reduce((s, r) => s + r.size, 0) : 0;

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      title="Watermarks removed"
      workingLabel="Working through your files…"
      subtitle={results ? `${results.length} file${results.length === 1 ? '' : 's'} · ${formatBytes(totalSize)}` : undefined}
      downloadLabel={results && results.length > 1 ? 'Download all (ZIP)' : undefined}
      fileName={results && results.length === 1 ? results[0].name : undefined}
      fileSize={results && results.length === 1 ? results[0].size : undefined}
      onDownload={downloadAll}
      onBack={backFromResult}
      backLabel="Back to files"
      note="Everything happens on your device — nothing is uploaded."
      extra={results && results.length > 1 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{r.name}</span>
              <button type="button" onClick={() => downloadBlob(r.blob, r.name)} className="shrink-0 text-purple-600 dark:text-purple-400 hover:underline">
                {formatBytes(r.size)} · save
              </button>
            </div>
          ))}
        </div>
      ) : null}
    />
  ) : null;

  const skippedCount = jobs.filter((j) => !j.loading && !j.loadError
    && ((j.kind === 'pdf' && !(j.selected?.size > 0)) || (j.kind === 'image' && !j.edited))).length;

  return (
    <ToolWorkspace
      file={jobs[0]?.file || null}
      accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
      multiple
      formats="PDF, JPG, PNG or WebP — one or many at once"
      dropTitle="Drop PDFs or photos to remove a watermark"
      dropHint="or click to browse"
      paste={false}
      onFiles={addFiles}
      onBack={(busy || results) ? backFromResult : reset}
      sidebar={(
        <>
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{jobs.length} file{jobs.length === 1 ? '' : 's'}</h3>
              <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Start over</button>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
              <strong className="text-gray-600 dark:text-gray-300">PDFs:</strong> text that repeats on most pages is
              found automatically — tick which ones to cover.
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed">
              <strong className="text-gray-600 dark:text-gray-300">Photos:</strong> paint over the mark by hand — an
              image/logo watermark can’t be auto-detected.
            </p>
          </section>
          <section className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
            <button type="button" onClick={() => addInputRef.current?.click()} className="w-full text-xs font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">
              + Add more files
            </button>
          </section>
          {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
        </>
      )}
      footer={(
        <button
          type="button"
          onClick={process}
          disabled={!ready || busy}
          className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
        >
          {busy ? 'Removing…' : `Remove watermark${jobs.length === 1 ? '' : 's'}`}
        </button>
      )}
      result={resultView}
    >
      <input
        ref={addInputRef}
        type="file"
        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      <div className="space-y-3">
        {jobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3">
            <div className="flex items-start gap-3">
              <div className="h-16 w-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-900 grid place-items-center">
                {job.loading ? (
                  <div className="h-5 w-5 border-2 border-gray-300 border-t-purple-500 rounded-full animate-spin" />
                ) : job.kind === 'pdf' && job.thumb ? (
                  <img src={job.thumb.dataUrl} alt="" className="h-full w-full object-cover" />
                ) : job.kind === 'image' && job.previewUrl ? (
                  <img src={job.edited ? job.editedCanvas.toDataURL('image/jpeg', 0.7) : job.previewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-[10px] text-gray-400">{job.kind === 'pdf' ? 'PDF' : 'IMG'}</span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">{job.file.name}</p>
                  <button type="button" onClick={() => removeJob(job.id)} className="shrink-0 text-xs text-gray-400 hover:text-red-500">Remove</button>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500">
                  {formatBytes(job.file.size)}{job.kind === 'pdf' && job.pageCount ? ` · ${job.pageCount} page${job.pageCount === 1 ? '' : 's'}` : ''}
                </p>

                {job.loading && <p className="mt-1 text-xs text-gray-400">Scanning…</p>}
                {job.loadError && <p className="mt-1 text-xs text-red-500">{job.loadError}</p>}

                {job.kind === 'pdf' && !job.loading && !job.loadError && (
                  job.candidates.length ? (() => {
                    const high = job.candidates.filter((c) => c.confidence === 'high');
                    const medium = job.candidates.filter((c) => c.confidence === 'medium');
                    const visible = job.showMore ? job.candidates : high;
                    return (
                      <div className="mt-2 space-y-1.5">
                        {high.length > 0 && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Found and ready to remove — just click <span className="font-medium">Remove watermark</span> below.
                          </p>
                        )}
                        {visible.map((c) => (
                          <label key={c.text} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                            <input
                              type="checkbox"
                              checked={job.selected.has(c.text)}
                              onChange={() => toggleCandidate(job.id, c.text)}
                              className="h-3.5 w-3.5 accent-purple-600"
                            />
                            <span className="truncate font-medium text-gray-800 dark:text-gray-100">“{c.text}”</span>
                            <span className="shrink-0 text-gray-400">{c.pagesHit}/{c.totalPages} pages</span>
                          </label>
                        ))}
                        {medium.length > 0 && (
                          <button
                            type="button"
                            onClick={() => patchJob(job.id, { showMore: !job.showMore })}
                            className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline"
                          >
                            {job.showMore ? 'Hide extra matches' : high.length
                              ? `Show ${medium.length} more possible match${medium.length === 1 ? '' : 'es'}`
                              : `No obvious watermark found — show ${medium.length} weaker match${medium.length === 1 ? '' : 'es'}`}
                          </button>
                        )}
                        {(job.selected.size > 0) && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <span className="text-[11px] text-gray-400">Cover with</span>
                            {COVER_SWATCHES.map((sw) => (
                              <button
                                key={sw}
                                type="button"
                                title={sw}
                                onClick={() => patchJob(job.id, { coverColor: sw })}
                                className={`h-4 w-4 rounded-full border ${job.coverColor === sw ? 'border-purple-500 ring-1 ring-purple-500' : 'border-gray-300 dark:border-gray-600'}`}
                                style={{ backgroundColor: sw }}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })() : (
                    <p className="mt-1 text-xs text-gray-400">
                      No repeated watermark text found. If it’s a logo/image stamp, this tool can’t auto-detect it yet.
                    </p>
                  )
                )}

                {job.kind === 'image' && !job.loading && !job.loadError && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => setBrushJobId(job.id)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      {job.edited ? '✓ Marked — touch up again' : '✏️ Paint over the watermark'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {jobs.length > 0 && skippedCount > 0 && (
        <p className="mt-3 text-xs text-amber-600 dark:text-amber-400">
          {skippedCount} file{skippedCount === 1 ? ' has' : 's have'} nothing selected yet, so it will be left as-is.
        </p>
      )}

      {brushJob && (
        <WatermarkBrushModal image={brushJob.img} onApply={handleBrushApply} onClose={() => setBrushJobId(null)} />
      )}
    </ToolWorkspace>
  );
};

export default RemoveWatermark;

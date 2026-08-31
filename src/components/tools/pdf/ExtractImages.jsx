import React, { useCallback, useEffect, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf } from '../../../lib/pdfjs';
import { extractImages } from '../../../lib/pdfImages';
import { zipFiles } from '../../../lib/zip';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));

const ExtractImages = () => {
  const [file, setFile] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | scanning | done
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [images, setImages] = useState([]);
  const [error, setError] = useState(null);
  const [dl, setDl] = useState('idle');
  const abortRef = useRef(null);
  const imagesRef = useRef([]);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => {
    abortRef.current?.abort();
    imagesRef.current.forEach((im) => URL.revokeObjectURL(im.url));
  }, []);

  const clearImages = () => {
    imagesRef.current.forEach((im) => URL.revokeObjectURL(im.url));
    setImages([]);
  };

  const scan = useCallback(async (f) => {
    clearImages();
    setError(null);
    setPhase('scanning');
    setProgress({ done: 0, total: 0 });
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const ab = await f.arrayBuffer();
      const pdf = await openPdf(ab);
      setProgress({ done: 0, total: pdf.numPages });
      const found = await extractImages(pdf, {
        signal: controller.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (controller.signal.aborted) return;
      setImages(found);
      setPhase('done');
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
      setPhase('idle');
    }
  }, []);

  const onFiles = (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setFile(f);
    scan(f);
  };

  const reset = () => {
    abortRef.current?.abort();
    clearImages();
    setFile(null);
    setPhase('idle');
    setError(null);
    setProgress({ done: 0, total: 0 });
  };

  const baseName = stripExt(file?.name || 'document');

  const downloadOne = (im, i) => {
    downloadBlob(im.blob, `${baseName}-p${im.page}-img${i + 1}.png`);
  };

  const onPrimary = async () => {
    if (dl !== 'idle' || !images.length) return;
    setDl('working');
    await sleep(350);
    try {
      const zip = await zipFiles(
        images.map((im, i) => ({ name: `${baseName}-p${im.page}-img${i + 1}.png`, blob: im.blob })),
      );
      downloadBlob(zip, `${baseName}-images.zip`);
      await sleep(150);
    } finally {
      setDl('done');
      setTimeout(() => setDl('idle'), 1800);
    }
  };

  const totalBytes = images.reduce((s, im) => s + im.size, 0);

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
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        {phase === 'scanning' && (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-200">Scanning pages…</p>
            <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full bg-purple-600 transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Page {progress.done} of {progress.total}</p>
            <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Cancel
            </button>
          </>
        )}
        {phase === 'done' && (
          <>
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {images.length} image{images.length === 1 ? '' : 's'} found
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {images.length ? `${formatBytes(totalBytes)} total · saved as PNG` : 'This PDF has no embedded raster images.'}
            </p>
            <button type="button" onClick={() => scan(file)} className="text-xs text-purple-600 dark:text-purple-400 hover:underline">
              Scan again
            </button>
          </>
        )}
      </section>

      <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-[11px] text-gray-500 dark:text-gray-400">
          Pulls out photos, scans and logos embedded in the PDF at their original resolution.
          Vector drawings and text aren&apos;t images and won&apos;t appear here. Everything runs in your browser.
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
      onClick={onPrimary}
      disabled={phase !== 'done' || !images.length || dl !== 'idle'}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {dl === 'working' ? (
        <><svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" /></svg> Preparing…</>
      ) : dl === 'done' ? (
        <><svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Downloaded</>
      ) : (
        images.length ? `Download all · ${images.length} PNG${images.length > 1 ? 's' : ''} (ZIP)` : 'No images to download'
      )}
    </button>
  );

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — embedded photos and graphics saved as PNG"
      dropTitle="Drop a PDF"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={reset}
      sidebar={sidebar}
      footer={footer}
    >
      {phase === 'scanning' && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Looking for images… (page {progress.done}/{progress.total})
        </div>
      )}

      {phase === 'done' && images.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center text-gray-500 dark:text-gray-400">
          <svg className="h-12 w-12 mb-3 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
          </svg>
          <p className="font-medium text-gray-700 dark:text-gray-200">No embedded images</p>
          <p className="text-sm mt-1 max-w-xs">This PDF is text or vector graphics only — there are no raster images to pull out.</p>
        </div>
      )}

      {phase === 'done' && images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((im, i) => (
            <div key={im.id} className="group relative rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
              <div className="aspect-square bg-[conic-gradient(at_50%_50%,#f3f4f6_0deg,#e5e7eb_90deg,#f3f4f6_180deg,#e5e7eb_270deg)] dark:bg-gray-900 flex items-center justify-center p-2">
                <img src={im.url} alt={`Image ${i + 1}`} className="max-w-full max-h-full object-contain" />
              </div>
              <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <span>p.{im.page} · {im.width}×{im.height}</span>
                <button
                  type="button"
                  onClick={() => downloadOne(im, i)}
                  className="inline-flex items-center gap-1 text-purple-600 dark:text-purple-400 hover:underline"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" /></svg>
                  PNG
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === 'idle' && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400">
          <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
          Opening PDF…
        </div>
      )}
    </ToolWorkspace>
  );
};

export default ExtractImages;

import React, { useContext, useEffect, useRef, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import { downloadBlob } from '../../tool/DownloadButton';
import { ToolBackContext } from '../../ToolWrapper';
import { formatBytes, stripExt } from '../../../lib/format';
import { upscaleImage, preloadUpscaleModel, dataUrlBytes } from '../../../lib/upscale';

const FACTORS = [
  { f: 2, label: '2×', hint: 'Twice the pixels — great for most photos' },
  { f: 4, label: '4×', hint: 'Four times — small or low-res shots' },
];

const dataUrlToBlob = (u) => fetch(u).then((r) => r.blob());

const ImageUpscaler = () => {
  const [file, setFile] = useState(null);
  const [srcUrl, setSrcUrl] = useState(null);
  const [srcDims, setSrcDims] = useState(null);
  const [factor, setFactor] = useState(2);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { url, width, height, capped }

  const [pos, setPos] = useState(50);
  const barRef = useRef(null);
  const abortRef = useRef(null);
  const urlRef = useRef(null);
  const registerBack = useContext(ToolBackContext);

  useEffect(() => { preloadUpscaleModel(2); }, []);
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const reset = () => {
    abortRef.current?.abort();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setFile(null); setSrcUrl(null); setSrcDims(null);
    setResult(null); setError(null); setBusy(false); setProgress(0); setPos(50);
  };

  const started = !!file;
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(started ? () => { if (result) { setResult(null); setPos(50); } else reset(); } : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, started, result]);

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) { setError('Please choose an image file (JPG, PNG, WebP).'); return; }
    reset();
    setError(null); setFile(f);
    const url = URL.createObjectURL(f);
    urlRef.current = url;
    setSrcUrl(url);
    const im = new Image();
    im.onload = () => setSrcDims({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = url;
  };

  const run = async () => {
    if (!srcUrl || busy) return;
    setBusy(true); setError(null); setProgress(0); setResult(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const out = await upscaleImage(srcUrl, factor, setProgress, ctrl.signal);
      setResult({ ...out, bytes: dataUrlBytes(out.url) });
      setPos(50);
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'Upscaling failed. Try a smaller image or the 2× option.');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const download = async () => {
    if (!result) return;
    const blob = await dataUrlToBlob(result.url);
    downloadBlob(blob, `${stripExt(file.name)}-upscaled-${factor}x.png`);
  };

  // before / after divider drag
  const moveTo = (clientX) => {
    const el = barRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  const onDown = (e) => { e.currentTarget.setPointerCapture?.(e.pointerId); moveTo(e.clientX); };
  const onMove = (e) => { if (e.buttons) moveTo(e.clientX); };

  // ---- upload screen ----
  if (!file) {
    return (
      <div className="max-w-2xl mx-auto">
        <FileDropzone
          accept="image/*"
          onFiles={(fs) => handleFile(fs[0])}
          title="Drop a photo to upscale"
          hint="or click to browse"
          formats="JPG · PNG · WebP — enlarge 2× or 4×, right here in your browser"
        />
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  const outW = result?.width || (srcDims ? srcDims.w * factor : 0);
  const outH = result?.height || (srcDims ? srcDims.h * factor : 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* ---- result: before / after ---- */}
      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Upscaled {factor}×</h2>
              <p className="text-[13px] text-gray-500 dark:text-gray-400">
                {outW} × {outH} px · {formatBytes(result.bytes)} · PNG
                {result.capped && <span className="ml-1">· source was scaled to fit</span>}
              </p>
            </div>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" /></svg>
              Download image
            </button>
          </div>

          <div
            ref={barRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            className="relative w-full overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-900 select-none touch-none cursor-ew-resize"
            style={{ aspectRatio: outW && outH ? `${outW} / ${outH}` : '1 / 1' }}
          >
            {/* upscaled = base layer */}
            <img src={result.url} alt="Upscaled" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
            {/* original = clipped to the left of the handle, shown at the same box size (browser-stretched) */}
            <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
              <img
                src={srcUrl}
                alt="Original"
                draggable={false}
                className="absolute inset-0 h-full object-contain max-w-none"
                style={{ width: barRef.current?.clientWidth || '100%' }}
              />
            </div>
            <span className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">Original</span>
            <span className="absolute right-2 top-2 rounded-md bg-purple-600/90 px-2 py-0.5 text-[11px] font-medium text-white">Upscaled</span>
            {/* handle */}
            <div className="absolute inset-y-0" style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}>
              <div className="h-full w-0.5 bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-white shadow-lg">
                <svg className="h-4 w-4 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7l-4 5 4 5M16 7l4 5-4 5" /></svg>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[13px]">
            <span className="text-gray-400 dark:text-gray-500">Drag the slider to compare ·</span>
            {factor === 2 && (
              <button type="button" onClick={() => { setFactor(4); setResult(null); }} className="font-medium text-purple-600 dark:text-purple-400 hover:underline">Try 4×</button>
            )}
            {factor === 4 && (
              <button type="button" onClick={() => { setFactor(2); setResult(null); }} className="font-medium text-purple-600 dark:text-purple-400 hover:underline">Back to 2×</button>
            )}
            <span className="text-gray-300 dark:text-gray-600">·</span>
            <button type="button" onClick={reset} className="font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">New image</button>
          </div>
        </div>
      ) : (
        /* ---- setup / processing ---- */
        <div className="space-y-5">
          <div className="mx-auto max-w-sm overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <img src={srcUrl} alt="" className="mx-auto max-h-72 w-auto object-contain" />
            <div className="border-t border-gray-200 dark:border-gray-700 px-3 py-2 text-center text-[12px] text-gray-500 dark:text-gray-400">
              {file.name} {srcDims && `· ${srcDims.w} × ${srcDims.h} px`}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {FACTORS.map((o) => (
              <button
                key={o.f}
                type="button"
                onClick={() => setFactor(o.f)}
                disabled={busy}
                className={`rounded-xl border-2 p-3 text-left transition-colors disabled:opacity-50 ${
                  factor === o.f
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-500/10'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700'
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-extrabold text-gray-900 dark:text-white">{o.label}</span>
                  {srcDims && <span className="text-[12px] text-gray-500 dark:text-gray-400">{srcDims.w * o.f} × {srcDims.h * o.f}</span>}
                </div>
                <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{o.hint}</p>
              </button>
            ))}
          </div>

          {busy ? (
            <div className="rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between text-[13px] font-medium text-gray-600 dark:text-gray-300">
                <span>{progress < 0.02 ? 'Loading the AI model…' : 'Upscaling…'}</span>
                <span className="tabular-nums">{Math.round(progress * 100)}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-pink-600 transition-[width] duration-200" style={{ width: `${Math.max(4, progress * 100)}%` }} />
              </div>
              <button type="button" onClick={() => abortRef.current?.abort()} className="mt-3 text-[12px] text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">Cancel</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={run}
              className="w-full rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-600/25 hover:brightness-110"
            >
              Upscale to {factor}× {srcDims ? `— ${srcDims.w * factor} × ${srcDims.h * factor} px` : ''}
            </button>
          )}

          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
            Runs entirely in your browser — the photo never leaves your device. The AI model (~a few MB) downloads once on first use.
          </p>
          {error && <p className="text-center text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
};

export default ImageUpscaler;

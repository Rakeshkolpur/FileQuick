import React, { useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInTool from '../../tool/OpenInTool';
import { formatBytes, stripExt } from '../../../lib/format';
import { consumeHandoff } from '../../../lib/imageHandoff';
import {
  encodeImage, webpSupported, loadImageFromFile, OUTPUT_FORMATS, OUTPUT_FORMAT_MAP,
} from '../../../lib/imageResize';
import { singleImageToPdf } from '../../../lib/imagesToPdf';
import { cutoutBackground, loadCutout, compositeOnColor } from '../../../lib/backgroundRemoval';
import MatteBrush from '../../tool/MatteBrush';

const SWATCHES = ['transparent', '#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

const BackgroundRemover = () => {
  const [file, setFile] = useState(null);
  const [cutout, setCutout] = useState(null); // HTMLImageElement (transparent PNG)
  const [original, setOriginal] = useState(null); // HTMLImageElement, source for the Restore brush
  const [showBrush, setShowBrush] = useState(false);
  const [bgColor, setBgColor] = useState('transparent');
  const [outFmt, setOutFmt] = useState(webpSupported() ? 'webp' : 'png');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const token = useRef(0);

  const run = async (f) => {
    const t = ++token.current;
    setBusy(true);
    setError(null);
    setProgress(0);
    setCutout(null);
    setOriginal(null);
    try {
      const [blob, orig] = await Promise.all([
        cutoutBackground(f, (p) => t === token.current && setProgress(p)),
        loadImageFromFile(f),
      ]);
      const img = await loadCutout(blob);
      if (t === token.current) { setCutout(img); setOriginal(orig); }
    } catch (e) {
      if (t === token.current) setError('Background removal failed — the model may still be downloading. Try again in a moment.');
    } finally {
      if (t === token.current) setBusy(false);
    }
  };

  const handleFile = (f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setFile(f);
    setBgColor('transparent');
    run(f);
  };

  useEffect(() => consumeHandoff((f) => handleFile(f), 'image'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    token.current += 1;
    setFile(null);
    setCutout(null);
    setOriginal(null);
    setShowBrush(false);
    setError(null);
    setBusy(false);
  };

  const handleBrushApply = (img) => {
    setCutout(img);
    setShowBrush(false);
  };

  const transparent = bgColor === 'transparent';
  const fmtInfo = OUTPUT_FORMAT_MAP[outFmt] || OUTPUT_FORMAT_MAP.png;
  const isPdf = outFmt === 'pdf';
  // JPG/JPEG/PDF can't hold transparency — encodeImage's own JPEG path fills
  // it white when exporting one of those, so every format stays selectable.
  const willFlattenAlpha = transparent && fmtInfo.enc === 'jpeg';

  const previewUrl = useMemo(() => {
    if (!cutout) return null;
    return compositeOnColor(cutout, bgColor).toDataURL('image/png');
  }, [cutout, bgColor]);

  const [result, setResult] = useState(null); // { blob, size }
  const [encoding, setEncoding] = useState(false);
  useEffect(() => { setResult(null); }, [cutout, bgColor, outFmt]);

  const outName = file ? `${stripExt(file.name)}_no-bg.${fmtInfo.ext}` : `image_no-bg.${fmtInfo.ext}`;
  const backFromResult = () => setResult(null);

  const makeDownload = async () => {
    if (!cutout || encoding) return;
    setEncoding(true);
    try {
      const canvas = compositeOnColor(cutout, bgColor);
      let blob = await encodeImage(canvas, {
        width: canvas.width,
        height: canvas.height,
        format: fmtInfo.enc,
        quality: 0.92,
      });
      if (isPdf) blob = await singleImageToPdf(blob);
      setResult({ blob, size: blob.size });
    } catch (_) {
      setError('Could not export the image. Try a different format.');
    } finally {
      setEncoding(false);
    }
  };

  const sidebar = (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Background</h3>
        {busy ? (
          <div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-purple-600 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Cutting out the subject… {Math.round(progress * 100)}%</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setBgColor(c)}
                title={c === 'transparent' ? 'Transparent' : c}
                className={`h-8 w-8 rounded-lg border-2 ${bgColor === c ? 'border-purple-600' : 'border-gray-200 dark:border-gray-600'} ${c === 'transparent' ? 'bg-checkered' : ''}`}
                style={c === 'transparent' ? undefined : { backgroundColor: c }}
              />
            ))}
            <label
              className={`h-8 w-8 rounded-lg border-2 overflow-hidden cursor-pointer ${!SWATCHES.includes(bgColor) ? 'border-purple-600' : 'border-gray-200 dark:border-gray-600'}`}
              style={{ backgroundColor: SWATCHES.includes(bgColor) ? '#888' : bgColor }}
              title="Custom colour"
            >
              <input
                type="color"
                value={SWATCHES.includes(bgColor) ? '#888888' : bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="opacity-0 w-full h-full cursor-pointer"
              />
            </label>
          </div>
        )}
        {!busy && cutout && original && (
          <button
            type="button"
            onClick={() => setShowBrush(true)}
            className="w-full text-xs font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            ✏️ Touch up edges (erase / restore)
          </button>
        )}
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Download format</h3>
        <select
          value={outFmt}
          onChange={(e) => setOutFmt(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
        >
          {OUTPUT_FORMATS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {willFlattenAlpha
            ? `${outFmt.toUpperCase()} can’t hold transparency — the background will be filled white. Pick PNG or WebP to keep it transparent.`
            : 'WebP is smallest, PNG is lossless (and keeps transparency), JPG is most compatible, PDF puts the image on one page.'}
        </p>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={makeDownload}
      disabled={busy || !cutout || encoding}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? `Removing background… ${Math.round(progress * 100)}%` : encoding ? 'Exporting…' : 'Download'}
    </button>
  );

  const resultView = (encoding || result) ? (
    <ResultScreen
      working={encoding}
      done={!!result}
      title="Background removed"
      workingLabel="Exporting your image…"
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to editing"
      note="Transparent or coloured background baked in. The file stays on your device."
      extra={result && !isPdf ? (
        <OpenInTool
          getImage={() => result.blob}
          exclude={['remove-background']}
          heading="Keep going with this cut-out — send it to"
        />
      ) : null}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="image/*"
      formats="JPG · PNG · WebP — one image"
      dropTitle="Drop an image to remove its background"
      dropHint="or click to browse"
      onFiles={(fs) => handleFile(fs[0])}
      onBack={(encoding || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[16rem]">{file?.name}</span>
        <button
          type="button"
          onClick={reset}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Choose another
        </button>
      </div>

      <div
        className={`rounded-xl flex items-center justify-center p-3 min-h-[320px] relative ${
          transparent ? 'bg-checkered' : 'bg-gray-100 dark:bg-gray-900/50'
        }`}
        style={transparent ? undefined : { backgroundColor: undefined }}
      >
        {busy && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/70 dark:bg-gray-900/70 rounded-xl">
            <div className="w-10 h-10 border-4 border-t-purple-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
            <p className="text-xs text-gray-500 dark:text-gray-400">Removing background… {Math.round(progress * 100)}%</p>
          </div>
        )}
        {previewUrl && <img src={previewUrl} alt="Background removed" className="max-h-[340px] max-w-full w-auto object-contain" />}
      </div>

      {cutout && (
        <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
          {formatBytes(file?.size)} original · exports as {outFmt.toUpperCase()}
          {result ? ` · ${formatBytes(result.size)}` : ''}
        </p>
      )}

      {showBrush && cutout && original && (
        <MatteBrush original={original} cutout={cutout} onApply={handleBrushApply} onClose={() => setShowBrush(false)} />
      )}
    </ToolWorkspace>
  );
};

export default BackgroundRemover;

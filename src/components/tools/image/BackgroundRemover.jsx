import React, { useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { encodeImage, webpSupported } from '../../../lib/imageResize';
import { cutoutBackground, loadCutout, compositeOnColor } from '../../../lib/backgroundRemoval';

const SWATCHES = ['transparent', '#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7'];

const BackgroundRemover = () => {
  const [file, setFile] = useState(null);
  const [cutout, setCutout] = useState(null); // HTMLImageElement (transparent PNG)
  const [bgColor, setBgColor] = useState('transparent');
  const [format, setFormat] = useState(webpSupported() ? 'webp' : 'png');
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
    try {
      const blob = await cutoutBackground(f, (p) => t === token.current && setProgress(p));
      const img = await loadCutout(blob);
      if (t === token.current) setCutout(img);
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

  useEffect(() => {
    let cancelled = false;
    let pending = null;
    try {
      pending = sessionStorage.getItem('pendingImageUpload');
      if (pending) sessionStorage.removeItem('pendingImageUpload');
    } catch (_) { /* ignore */ }
    if (!pending) return undefined;
    fetch(pending)
      .then((r) => r.blob())
      .then((blob) => {
        if (cancelled) return;
        const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
        handleFile(new File([blob], `image.${ext}`, { type: blob.type }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    token.current += 1;
    setFile(null);
    setCutout(null);
    setError(null);
    setBusy(false);
  };

  const transparent = bgColor === 'transparent';
  const effFormat = transparent && format === 'jpeg' ? 'webp' : format;

  const previewUrl = useMemo(() => {
    if (!cutout) return null;
    return compositeOnColor(cutout, bgColor).toDataURL('image/png');
  }, [cutout, bgColor]);

  const [result, setResult] = useState(null); // { blob, size }
  const [encoding, setEncoding] = useState(false);
  useEffect(() => { setResult(null); }, [cutout, bgColor, format]);

  const outName = file ? `${stripExt(file.name)}_no-bg.${effFormat === 'jpeg' ? 'jpg' : effFormat}` : 'image_no-bg.png';
  const backFromResult = () => setResult(null);

  const makeDownload = async () => {
    if (!cutout || encoding) return;
    setEncoding(true);
    try {
      const canvas = compositeOnColor(cutout, bgColor);
      const blob = await encodeImage(canvas, {
        width: canvas.width,
        height: canvas.height,
        format: effFormat,
        quality: 0.92,
      });
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
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Download format</h3>
        <Segmented
          options={
            transparent
              ? [{ value: 'webp', label: 'WebP' }, { value: 'png', label: 'PNG' }]
              : [{ value: 'webp', label: 'WebP' }, { value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPG' }]
          }
          value={effFormat}
          onChange={setFormat}
        />
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {transparent ? 'Transparent background needs WebP or PNG.' : 'WebP is smallest; PNG is lossless.'}
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
          {formatBytes(file?.size)} original · exports as {effFormat.toUpperCase()}
          {result ? ` · ${formatBytes(result.size)}` : ''}
        </p>
      )}
    </ToolWorkspace>
  );
};

export default BackgroundRemover;

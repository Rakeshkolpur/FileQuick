import React, { useEffect, useMemo, useRef, useState } from 'react';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInTool from '../../tool/OpenInTool';
import { formatBytes, stripExt } from '../../../lib/format';
import { consumeHandoff } from '../../../lib/imageHandoff';
import {
  encodeImage, loadImageFromFile, OUTPUT_FORMATS, OUTPUT_FORMAT_MAP,
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
  const [outFmt, setOutFmt] = useState('jpg');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const token = useRef(0);

  // Editing screen: which tab of the right-hand panel is open.
  const [activeTab, setActiveTab] = useState('tools');

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
    setActiveTab('tools');
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

  const getCurrentImage = () => new Promise((resolve) => {
    if (!cutout) { resolve(null); return; }
    compositeOnColor(cutout, bgColor).toBlob((b) => resolve(b), 'image/png');
  });

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

  const tabBtn = (id, label) => (
    <button
      type="button"
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
        activeTab === id
          ? 'border-blue-600 text-blue-600 dark:text-blue-400'
          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
      }`}
    >
      {label}
    </button>
  );

  const resultView = (busy || encoding || result) ? (
    <ResultScreen
      working={busy || encoding}
      done={!!result}
      progress={busy ? Math.round(progress * 100) : null}
      title="Background removed"
      workingLabel={busy ? `Cutting out the subject… ${Math.round(progress * 100)}%` : 'Exporting your image…'}
      fileName={result ? outName : undefined}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to editing"
      note={busy ? undefined : 'Transparent or coloured background baked in. The file stays on your device.'}
      extra={result && !isPdf ? (
        <OpenInTool
          getImage={() => result.blob}
          exclude={['remove-background']}
          heading="Keep going with this cut-out — send it to"
        />
      ) : null}
    />
  ) : null;

  // Dedicated editing layout: canvas card + a tabbed panel (Tools / Download)
  // on the right, matching Crop Image / Resize Image's editing screen. The
  // empty dropzone, the busy cutout step and the result screen still go
  // through <ToolWorkspace> below.
  if (file && cutout && !busy && !encoding && !result) {
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[16rem]">{file.name}</span>
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Choose another
            </button>
          </div>

          <div
            className={`rounded-xl flex items-center justify-center p-3 min-h-[280px] relative ${
              transparent ? 'bg-checkered' : 'bg-gray-100 dark:bg-gray-900/50'
            }`}
          >
            {previewUrl && <img src={previewUrl} alt="Background removed" className="max-h-[340px] max-w-full w-auto object-contain" />}
          </div>

          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {formatBytes(file.size)} original · exports as {outFmt.toUpperCase()}
          </p>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <OpenInTool getImage={getCurrentImage} exclude={['remove-background']} heading="Or send this image to" />
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
          <div className="flex border-b border-gray-200 dark:border-gray-700 px-2">
            {tabBtn('tools', 'Tools')}
            {tabBtn('download', 'Download')}
          </div>

          <div className="flex-1 lg:overflow-y-auto p-3.5 space-y-3">
            {activeTab === 'tools' ? (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Background</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setBgColor(c)}
                        title={c === 'transparent' ? 'Transparent' : c}
                        className={`h-8 w-8 rounded-lg border-2 ${bgColor === c ? 'border-blue-600' : 'border-gray-200 dark:border-gray-600'} ${c === 'transparent' ? 'bg-checkered' : ''}`}
                        style={c === 'transparent' ? undefined : { backgroundColor: c }}
                      />
                    ))}
                    <label
                      className={`h-8 w-8 rounded-lg border-2 overflow-hidden cursor-pointer ${!SWATCHES.includes(bgColor) ? 'border-blue-600' : 'border-gray-200 dark:border-gray-600'}`}
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
                  {original && (
                    <button
                      type="button"
                      onClick={() => setShowBrush(true)}
                      className="w-full text-xs font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                    >
                      ✏️ Touch up edges (erase / restore)
                    </button>
                  )}
                </section>

                {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              </>
            ) : (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
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
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <button
              type="button"
              onClick={makeDownload}
              disabled={encoding}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
            >
              Download
            </button>
          </div>
        </aside>

        {showBrush && cutout && original && (
          <MatteBrush original={original} cutout={cutout} onApply={handleBrushApply} onClose={() => setShowBrush(false)} />
        )}
      </div>
    );
  }

  return (
    <ToolWorkspace
      file={file}
      accept="image/*"
      formats="JPG · PNG · WebP — one image"
      dropTitle="Drop an image to remove its background"
      dropHint="or click to browse"
      onFiles={(fs) => handleFile(fs[0])}
      onBack={(busy || encoding || result) ? backFromResult : reset}
      sidebar={error && !cutout ? (
        <>
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>
          <button
            type="button"
            onClick={reset}
            className="w-full text-sm font-medium py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Choose another image
          </button>
        </>
      ) : null}
      result={resultView}
    />
  );
};

export default BackgroundRemover;

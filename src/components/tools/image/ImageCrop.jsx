import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { ToolBackContext } from '../../ToolWrapper';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInTool from '../../tool/OpenInTool';
import { formatBytes, stripExt } from '../../../lib/format';
import { consumeHandoff } from '../../../lib/imageHandoff';
import { encodeImage, outExt } from '../../../lib/imageResize';
import { transformToCanvas } from '../../../lib/imageTransform';

const RATIOS = [
  { label: 'Free', value: 0 },
  { label: 'Original', value: -1 },
  { label: '1:1', value: 1 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];

const PRESETS = [
  { label: 'Custom size', w: 0, h: 0 },
  { label: 'Instagram post — 1080×1080', w: 1080, h: 1080 },
  { label: 'Instagram story — 1080×1920', w: 1080, h: 1920 },
  { label: 'Facebook cover — 851×315', w: 851, h: 315 },
  { label: 'Twitter / X header — 1500×500', w: 1500, h: 500 },
  { label: 'YouTube thumbnail — 1280×720', w: 1280, h: 720 },
  { label: 'LinkedIn banner — 1584×396', w: 1584, h: 396 },
  { label: 'Passport photo — 413×531', w: 413, h: 531 },
  { label: 'A4 @ 300 dpi — 2480×3508', w: 2480, h: 3508 },
];

const FORMATS = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

const numField =
  'w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
// Only ever rendered from this tool's own editing screen — safe to give it
// this tool's own blue accent instead of the site-wide purple.
const chip =
  'px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-blue-100 dark:hover:bg-blue-900/40';
const chipActive = 'px-2.5 py-1 text-xs rounded-md bg-blue-600 text-white';

const IconBtn = ({ active, title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
      active
        ? 'bg-blue-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`}
  >
    {children}
  </button>
);

const centeredAspect = (aspect, w, h) => centerCrop(makeAspectCrop({ unit: '%', width: 90 }, aspect, w, h), w, h);
const centeredFree = () => ({ unit: '%', x: 5, y: 5, width: 90, height: 90 });

const ImageCrop = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const loadToken = useRef(0);
  const registerBack = useContext(ToolBackContext);

  const [rotation, setRotation] = useState(0);
  const [straighten, setStraighten] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);

  const [ratio, setRatio] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [circle, setCircle] = useState(false);
  const [grid, setGrid] = useState(true);

  const [crop, setCrop] = useState(null);
  const [completed, setCompleted] = useState(null);

  const [format, setFormat] = useState('jpeg');
  const [quality, setQuality] = useState(92);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  // Editing screen: which tab of the right-hand panel is open.
  const [activeTab, setActiveTab] = useState('tools');
  const [showBox, setShowBox] = useState(false);

  const preset = PRESETS[presetIdx];
  const hasPreset = preset.w > 0;

  const loadImage = (f) =>
    new Promise((resolve, reject) => {
      const url = URL.createObjectURL(f);
      const im = new Image();
      im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
      im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
      im.src = url;
    });

  const handleFile = async (f) => {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    const t = ++loadToken.current;
    setError(null);
    setResult(null);
    setFile(f);
    setRotation(0);
    setStraighten(0);
    setFlipH(false);
    setFlipV(false);
    setActiveTab('tools');
    try {
      const im = await loadImage(f);
      if (t === loadToken.current) setImg(im);
    } catch (e) {
      if (t === loadToken.current) setError(e.message);
    }
  };

  useEffect(() => consumeHandoff((f) => handleFile(f), 'image'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    loadToken.current += 1;
    setFile(null);
    setImg(null);
    setResult(null);
    setError(null);
  };

  // Fully transformed source
  const workCanvas = useMemo(
    () => (img ? transformToCanvas(img, { rotation, straighten, flipH, flipV }) : null),
    [img, rotation, straighten, flipH, flipV],
  );
  const workUrl = useMemo(() => (workCanvas ? workCanvas.toDataURL('image/png') : null), [workCanvas]);
  const natW = workCanvas?.width || 0;
  const natH = workCanvas?.height || 0;

  const effAspect = circle
    ? 1
    : hasPreset
      ? preset.w / preset.h
      : ratio === -1
        ? (natW && natH ? natW / natH : undefined)
        : ratio || undefined;

  // (re)seed crop whenever the transform or the requested aspect changes
  const aspectKey = `${natW}x${natH}:${circle}:${hasPreset ? preset.label : ratio}`;
  useEffect(() => {
    if (!natW || !natH) return;
    setResult(null);
    const c = effAspect ? centeredAspect(effAspect, natW, natH) : centeredFree();
    setCrop(c);
    setCompleted(c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspectKey]);

  const cropPx = useMemo(() => {
    if (!completed || !completed.width || !natW) return null;
    return {
      x: Math.round((completed.x / 100) * natW),
      y: Math.round((completed.y / 100) * natH),
      width: Math.round((completed.width / 100) * natW),
      height: Math.round((completed.height / 100) * natH),
    };
  }, [completed, natW, natH]);

  const setBox = (patch) => {
    if (!cropPx || !natW) return;
    setResult(null);
    let { x, y, width, height } = { ...cropPx, ...patch };
    width = Math.max(1, Math.min(width, natW));
    height = Math.max(1, Math.min(height, natH));
    x = Math.max(0, Math.min(x, natW - width));
    y = Math.max(0, Math.min(y, natH - height));
    const c = { unit: '%', x: (x / natW) * 100, y: (y / natH) * 100, width: (width / natW) * 100, height: (height / natH) * 100 };
    setCrop(c);
    setCompleted(c);
  };

  const rotate = (d) => {
    setResult(null);
    setRotation((r) => (((r + d) % 360) + 360) % 360);
  };
  const resetTransform = () => {
    setResult(null);
    setRotation(0);
    setStraighten(0);
    setFlipH(false);
    setFlipV(false);
  };

  const outW = hasPreset ? preset.w : cropPx?.width || 0;
  const outH = hasPreset ? preset.h : cropPx?.height || 0;
  const effFormat = circle && format === 'jpeg' ? 'png' : format;

  const getCurrentImage = () => new Promise((resolve) => {
    if (!workCanvas || !cropPx) { resolve(file || null); return; }
    const c = document.createElement('canvas');
    c.width = cropPx.width;
    c.height = cropPx.height;
    c.getContext('2d').drawImage(workCanvas, cropPx.x, cropPx.y, cropPx.width, cropPx.height, 0, 0, cropPx.width, cropPx.height);
    c.toBlob((b) => resolve(b || file), 'image/png');
  });

  const run = async () => {
    if (!workCanvas || !cropPx) return;
    setBusy(true);
    setError(null);
    try {
      // crop from the transformed canvas
      const cw = cropPx.width;
      const ch = cropPx.height;
      let canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(workCanvas, cropPx.x, cropPx.y, cw, ch, 0, 0, cw, ch);

      if (circle) {
        const c2 = document.createElement('canvas');
        c2.width = cw;
        c2.height = ch;
        const ctx = c2.getContext('2d');
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvas, 0, 0);
        ctx.restore();
        canvas = c2;
      }

      const blob = await encodeImage(canvas, {
        width: hasPreset ? preset.w : cw,
        height: hasPreset ? preset.h : ch,
        format: effFormat,
        quality: quality / 100,
        highQuality: true,
      });
      setResult({ blob, width: hasPreset ? preset.w : cw, height: hasPreset ? preset.h : ch, size: blob.size, format: effFormat });
    } catch (e) {
      setError(e.message || 'Cropping failed.');
    } finally {
      setBusy(false);
    }
  };

  const downloadName = file ? `${stripExt(file.name)}_${outW}x${outH}.${outExt(effFormat)}` : 'cropped';
  const backFromResult = () => setResult(null);

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Your image is cropped"
      workingLabel="Cropping your image…"
      subtitle={result ? `${result.width} × ${result.height} · ${formatBytes(result.size)}` : undefined}
      fileName={downloadName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, downloadName)}
      onBack={backFromResult}
      backLabel="Back to cropping"
      extra={result ? (
        <OpenInTool getImage={() => result.blob} exclude={['crop-image']} />
      ) : null}
    />
  ) : null;

  const showQuality = effFormat !== 'png';

  // The Back button normally routes through ToolWorkspace, but the editor
  // below renders its own layout instead of <ToolWorkspace> — wire the same
  // "Back returns to the upload screen" behaviour here too.
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(file ? ((busy || result) ? backFromResult : reset) : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, busy, result, registerBack]);

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

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!cropPx || busy}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Cropping…' : 'Crop & download'}
    </button>
  );

  // Dedicated editing layout: canvas card + a tabbed panel (Tools / Download)
  // on the right, matching Resize Image's editing screen. The empty dropzone
  // and the result/download screen still go through <ToolWorkspace> below.
  if (file && !busy && !result) {
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <div className="min-w-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white truncate max-w-[12rem]">{file.name}</span>
              {cropPx && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="rounded-md bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-blue-700 dark:text-blue-300 font-medium">
                    {outW} × {outH}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Choose another
            </button>
          </div>

          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <IconBtn title="Rotate left" onClick={() => rotate(-90)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v6h6M3 13a9 9 0 103-6.7L3 9" />
              </svg>
            </IconBtn>
            <IconBtn title="Rotate right" onClick={() => rotate(90)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 7v6h-6M21 13a9 9 0 11-3-6.7L21 9" />
              </svg>
            </IconBtn>
            <IconBtn active={flipH} title="Flip horizontal" onClick={() => { setFlipH((v) => !v); setResult(null); }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M7 8l-3 4 3 4M17 8l3 4-3 4" />
              </svg>
            </IconBtn>
            <IconBtn active={flipV} title="Flip vertical" onClick={() => { setFlipV((v) => !v); setResult(null); }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M8 7l4-3 4 3M8 17l4 3 4-3" />
              </svg>
            </IconBtn>
            {(rotation || straighten || flipH || flipV) ? (
              <button type="button" onClick={resetTransform} className="text-xs px-2 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                Reset
              </button>
            ) : null}
          </div>

          <div className="rounded-xl bg-checkered flex items-center justify-center p-3 min-h-[200px] relative overflow-hidden">
            {busy && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-xl">
                <div className="w-10 h-10 border-4 border-t-blue-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
              </div>
            )}
            {workUrl && (
              <ReactCrop
                crop={crop}
                onChange={(_, p) => { setCrop(p); setResult(null); }}
                onComplete={(_, p) => setCompleted(p)}
                aspect={effAspect}
                circularCrop={circle}
                ruleOfThirds={grid}
                keepSelection
              >
                {/* react-image-crop's own CSS sets `max-height: inherit` on this
                    img with higher specificity than a Tailwind class can
                    reach, so the cap has to go through an inline style. */}
                <img
                  src={workUrl}
                  alt="To crop"
                  className="max-w-full w-auto object-contain select-none"
                  style={{ maxHeight: 260 }}
                />
              </ReactCrop>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <OpenInTool getImage={getCurrentImage} exclude={['crop-image']} heading="Or send this image to" />
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
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Aspect ratio</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {RATIOS.map((r) => (
                      <button
                        key={r.label}
                        type="button"
                        onClick={() => { setRatio(r.value); setPresetIdx(0); setCircle(false); }}
                        className={!circle && !hasPreset && ratio === r.value ? chipActive : chip}
                      >
                        {r.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => { setCircle((v) => !v); setPresetIdx(0); }}
                      className={circle ? chipActive : chip}
                    >
                      ◯ Circle
                    </button>
                  </div>
                </section>

                <section className="space-y-2 pt-2.5 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Sized crop</h3>
                  <select
                    value={presetIdx}
                    onChange={(e) => { setPresetIdx(Number(e.target.value)); setCircle(false); }}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
                  >
                    {PRESETS.map((p, i) => (
                      <option key={p.label} value={i}>{p.label}</option>
                    ))}
                  </select>
                  {hasPreset && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Output is scaled to exactly {preset.w} × {preset.h} px.
                    </p>
                  )}
                </section>

                <section className="pt-2.5 border-t border-gray-200 dark:border-gray-700">
                  <RangeSlider label="Straighten" value={straighten} min={-15} max={15} onChange={(v) => { setStraighten(v); setResult(null); }} suffix="°" accent="blue" />
                </section>

                {cropPx && (
                  <section className="space-y-2 pt-2.5 border-t border-gray-200 dark:border-gray-700">
                    <button
                      type="button"
                      onClick={() => setShowBox((v) => !v)}
                      className="flex w-full items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
                    >
                      Crop box (px)
                      <svg className={`h-4 w-4 text-gray-400 transition-transform ${showBox ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {showBox && (
                    <div className="grid grid-cols-2 gap-2">
                      <label className="text-xs">
                        <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Width</span>
                        <input type="number" min="1" value={cropPx.width} onChange={(e) => setBox({ width: Number(e.target.value) || 1 })} className={numField} disabled={hasPreset || circle} />
                      </label>
                      <label className="text-xs">
                        <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Height</span>
                        <input type="number" min="1" value={cropPx.height} onChange={(e) => setBox({ height: Number(e.target.value) || 1 })} className={numField} disabled={hasPreset || circle} />
                      </label>
                      <label className="text-xs">
                        <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">X</span>
                        <input type="number" min="0" value={cropPx.x} onChange={(e) => setBox({ x: Number(e.target.value) || 0 })} className={numField} />
                      </label>
                      <label className="text-xs">
                        <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Y</span>
                        <input type="number" min="0" value={cropPx.y} onChange={(e) => setBox({ y: Number(e.target.value) || 0 })} className={numField} />
                      </label>
                    </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <>
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
                  <Segmented
                    options={circle ? FORMATS.filter((f) => f.value !== 'jpeg') : FORMATS}
                    value={effFormat}
                    onChange={(v) => { setFormat(v); setResult(null); }}
                    accent="blue"
                  />
                  {showQuality && (
                    <RangeSlider label="Quality" value={quality} min={40} max={100} onChange={(v) => { setQuality(v); setResult(null); }} suffix="%" accent="blue" />
                  )}
                </section>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-2">
                  <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  Show grid
                </label>

                {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
              </>
            )}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {footer}
          </div>
        </aside>
      </div>
    );
  }

  return (
    <ToolWorkspace
      file={file}
      accept="image/*"
      formats="JPG · PNG · WebP · GIF · SVG"
      dropTitle="Drop an image to crop"
      dropHint="or click to browse"
      onFiles={(fs) => handleFile(fs[0])}
      onBack={(busy || result) ? backFromResult : reset}
      result={resultView}
    />
  );
};

export default ImageCrop;

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ToolWorkspace from '../../tool/ToolWorkspace';
import { ToolBackContext } from '../../ToolWrapper';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInTool from '../../tool/OpenInTool';
import Lightbox from '../../tool/Lightbox';
import { formatBytes } from '../../../lib/format';
import { toolFileName } from '../../../lib/fileNames';
import { zipFiles } from '../../../lib/zip';
import { consumeHandoff } from '../../../lib/imageHandoff';
import { encodeImage, OUTPUT_FORMATS, OUTPUT_FORMAT_MAP } from '../../../lib/imageResize';
import { singleImageToPdf } from '../../../lib/imagesToPdf';
import { transformToCanvas } from '../../../lib/imageTransform';

// JPG/JPEG/PDF can't hold transparency — a circular crop falls back to PNG.
const NO_ALPHA_FORMATS = ['jpg', 'jpeg', 'pdf'];

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

const loadImage = (f) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
    im.src = url;
  });

const pctToPx = (c, w, h) => ({
  x: Math.round((c.x / 100) * w),
  y: Math.round((c.y / 100) * h),
  width: Math.max(1, Math.round((c.width / 100) * w)),
  height: Math.max(1, Math.round((c.height / 100) * h)),
});

let uid = 0;

/**
 * Crop one or many images. Each image keeps its own crop box and transform
 * (rotate / straighten / flip); the shape settings (aspect ratio, circle,
 * sized-crop preset) and the output format are shared.
 */
const ImageCrop = () => {
  // { id, file, url, img, rotation, straighten, flipH, flipV, crop, completed, seedKey }
  const [items, setItems] = useState([]);
  const [selId, setSelId] = useState(null);
  const registerBack = useContext(ToolBackContext);

  const [ratio, setRatio] = useState(0);
  const [presetIdx, setPresetIdx] = useState(0);
  const [circle, setCircle] = useState(false);
  const [grid, setGrid] = useState(true);

  const [format, setFormat] = useState('jpg');
  const [quality, setQuality] = useState(92);

  const [results, setResults] = useState(null); // [{ id, name, blob, width, height, size, format, ext }]
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { src, caption } — click-to-enlarge popup

  // Editing screen: which tab of the right-hand panel is open.
  const [activeTab, setActiveTab] = useState('tools');
  const [showBox, setShowBox] = useState(false);
  const addInputRef = useRef(null);

  const preset = PRESETS[presetIdx];
  const hasPreset = preset.w > 0;
  const cur = items.find((it) => it.id === selId) || null;
  const isBatch = items.length > 1;

  // object URLs are released when the tool goes away
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => () => itemsRef.current.forEach((it) => URL.revokeObjectURL(it.url)), []);

  const updateCur = (patch) => setItems((ps) => ps.map((it) => (it.id === selId
    ? { ...it, ...(typeof patch === 'function' ? patch(it) : patch) } : it)));

  const addFiles = async (list) => {
    const imgs = [...(list || [])].filter((f) => f && f.type.startsWith('image/'));
    if (!imgs.length) { setError('Please choose image files.'); return; }
    setError(null);
    setResults(null);
    const fresh = imgs.map((file) => ({
      id: ++uid, file, url: URL.createObjectURL(file), img: null,
      rotation: 0, straighten: 0, flipH: false, flipV: false, crop: null, completed: null, seedKey: null,
    }));
    setItems((ps) => [...ps, ...fresh]);
    setSelId((cur0) => cur0 ?? fresh[0].id);
    setActiveTab('tools');
    await Promise.all(fresh.map(async (f) => {
      try {
        const img = await loadImage(f.file);
        setItems((ps) => ps.map((it) => (it.id === f.id ? { ...it, img } : it)));
      } catch (e) {
        setError(e.message);
        setItems((ps) => ps.filter((it) => it.id !== f.id));
      }
    }));
  };

  useEffect(() => consumeHandoff((f) => addFiles([f]), 'image'), []); // eslint-disable-line react-hooks/exhaustive-deps

  const removeItem = (id) => {
    setResults(null);
    setItems((ps) => {
      const gone = ps.find((it) => it.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      const next = ps.filter((it) => it.id !== id);
      if (id === selId) setSelId(next[0]?.id ?? null);
      return next;
    });
  };

  const reset = () => {
    items.forEach((it) => URL.revokeObjectURL(it.url));
    setItems([]);
    setSelId(null);
    setResults(null);
    setError(null);
  };

  // ---- the selected image, transformed
  const rotation = cur?.rotation || 0;
  const straighten = cur?.straighten || 0;
  const flipH = !!cur?.flipH;
  const flipV = !!cur?.flipV;

  const workCanvas = useMemo(
    () => (cur?.img ? transformToCanvas(cur.img, { rotation, straighten, flipH, flipV }) : null),
    [cur?.img, rotation, straighten, flipH, flipV],
  );
  const workUrl = useMemo(() => (workCanvas ? workCanvas.toDataURL('image/png') : null), [workCanvas]);
  const natW = workCanvas?.width || 0;
  const natH = workCanvas?.height || 0;

  const aspectFor = (w, h) => (circle
    ? 1
    : hasPreset
      ? preset.w / preset.h
      : ratio === -1
        ? (w && h ? w / h : undefined)
        : ratio || undefined);
  const effAspect = aspectFor(natW, natH);
  // what a crop box was made for — a different shape or image size needs a new one
  const seedKeyFor = (w, h) => `${w}x${h}:${circle}:${hasPreset ? preset.label : ratio}`;
  const seedKey = seedKeyFor(natW, natH);
  const defaultCrop = (w, h) => {
    const a = aspectFor(w, h);
    return a ? centeredAspect(a, w, h) : centeredFree();
  };

  // (re)seed the crop when this image has none yet, or its shape/size changed
  useEffect(() => {
    if (!cur || !natW || !natH) return;
    if (cur.completed && cur.seedKey === seedKey) return; // keep the user's box
    setResults(null);
    const c = defaultCrop(natW, natH);
    updateCur({ crop: c, completed: c, seedKey });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selId, seedKey]);

  const crop = cur?.crop || null;
  const completed = cur?.completed || null;
  const cropPx = useMemo(
    () => (completed && completed.width && natW ? pctToPx(completed, natW, natH) : null),
    [completed, natW, natH],
  );

  const setBox = (patch) => {
    if (!cropPx || !natW) return;
    setResults(null);
    let { x, y, width, height } = { ...cropPx, ...patch };
    width = Math.max(1, Math.min(width, natW));
    height = Math.max(1, Math.min(height, natH));
    x = Math.max(0, Math.min(x, natW - width));
    y = Math.max(0, Math.min(y, natH - height));
    const c = { unit: '%', x: (x / natW) * 100, y: (y / natH) * 100, width: (width / natW) * 100, height: (height / natH) * 100 };
    updateCur({ crop: c, completed: c, seedKey });
  };

  const rotate = (d) => {
    setResults(null);
    updateCur((it) => ({ rotation: (((it.rotation + d) % 360) + 360) % 360 }));
  };
  const resetTransform = () => {
    setResults(null);
    updateCur({ rotation: 0, straighten: 0, flipH: false, flipV: false });
  };

  const outW = hasPreset ? preset.w : cropPx?.width || 0;
  const outH = hasPreset ? preset.h : cropPx?.height || 0;
  const effFormat = circle && NO_ALPHA_FORMATS.includes(format) ? 'png' : format;
  const fmtInfo = OUTPUT_FORMAT_MAP[effFormat] || OUTPUT_FORMAT_MAP.jpg;
  const isPdf = effFormat === 'pdf';

  // The current crop as an image (for "send to another tool" and Preview)
  const getCurrentImage = () => new Promise((resolve) => {
    if (!workCanvas || !cropPx) { resolve(cur?.file || null); return; }
    const c = document.createElement('canvas');
    c.width = cropPx.width;
    c.height = cropPx.height;
    c.getContext('2d').drawImage(workCanvas, cropPx.x, cropPx.y, cropPx.width, cropPx.height, 0, 0, cropPx.width, cropPx.height);
    c.toBlob((b) => resolve(b || cur?.file), 'image/png');
  });

  const showCropPreview = async () => {
    const b = await getCurrentImage();
    if (!b) return;
    setPreview({ src: URL.createObjectURL(b), caption: `${cur.file.name} · crop ${outW} × ${outH}`, revoke: true });
  };
  const closePreview = () => {
    setPreview((p) => { if (p?.revoke) URL.revokeObjectURL(p.src); return null; });
  };

  // Crop one item with its own box (or the default box for the current shape)
  const cropOne = async (it) => {
    const src = transformToCanvas(it.img, {
      rotation: it.rotation, straighten: it.straighten, flipH: it.flipH, flipV: it.flipV,
    });
    const w = src.width;
    const h = src.height;
    const box = it.completed && it.seedKey === seedKeyFor(w, h) ? it.completed : defaultCrop(w, h);
    const px = pctToPx(box, w, h);
    let canvas = document.createElement('canvas');
    canvas.width = px.width;
    canvas.height = px.height;
    canvas.getContext('2d').drawImage(src, px.x, px.y, px.width, px.height, 0, 0, px.width, px.height);
    if (circle) {
      const c2 = document.createElement('canvas');
      c2.width = px.width;
      c2.height = px.height;
      const ctx = c2.getContext('2d');
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(px.width / 2, px.height / 2, px.width / 2, px.height / 2, 0, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
      canvas = c2;
    }
    const ow = hasPreset ? preset.w : px.width;
    const oh = hasPreset ? preset.h : px.height;
    let blob = await encodeImage(canvas, {
      width: ow, height: oh, format: fmtInfo.enc, quality: quality / 100, highQuality: true,
    });
    if (isPdf) blob = await singleImageToPdf(blob);
    return {
      id: it.id,
      name: toolFileName(it.file, 'crop-image', fmtInfo.ext),
      blob, width: ow, height: oh, size: blob.size, format: effFormat, ext: fmtInfo.ext,
    };
  };

  const ready = items.length > 0 && items.every((it) => it.img) && !!cropPx;

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    setProgress({ done: 0, total: items.length });
    try {
      const out = [];
      for (let i = 0; i < items.length; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        out.push(await cropOne(items[i]));
        setProgress({ done: i + 1, total: items.length });
      }
      setResults(out);
    } catch (e) {
      setError(e.message || 'Cropping failed.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const downloadAll = async () => {
    if (!results) return;
    if (results.length === 1) { downloadBlob(results[0].blob, results[0].name); return; }
    const zip = await zipFiles(results.map((r) => ({ name: r.name, blob: r.blob })));
    downloadBlob(zip, toolFileName(items[0]?.file, 'crop-image', 'zip'));
  };
  const backFromResult = () => setResults(null);
  const total = results ? results.reduce((s, r) => s + r.size, 0) : 0;
  const r0 = results?.[0];

  const resultView = (busy || results) ? (
    <ResultScreen
      working={busy}
      done={!!results}
      progress={progress && progress.total > 1 ? Math.round((progress.done / progress.total) * 100) : null}
      title={results && results.length > 1 ? 'Your images are cropped' : 'Your image is cropped'}
      workingLabel={items.length > 1 ? 'Cropping your images…' : 'Cropping your image…'}
      subtitle={results
        ? (results.length > 1 ? `${results.length} files · ${formatBytes(total)}` : `${r0.width} × ${r0.height} · ${formatBytes(r0.size)}`)
        : undefined}
      fileName={results && results.length === 1 ? r0.name : undefined}
      fileSize={results && results.length === 1 ? r0.size : undefined}
      downloadLabel={results && results.length > 1 ? 'Download all (ZIP)' : undefined}
      onDownload={downloadAll}
      onBack={backFromResult}
      backLabel="Back to cropping"
      extra={results && results.length > 1 ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{r.name}</span>
              <button type="button" onClick={() => downloadBlob(r.blob, r.name)} className="shrink-0 text-blue-600 dark:text-blue-400 hover:underline">
                {r.width}×{r.height} · {formatBytes(r.size)} · save
              </button>
            </div>
          ))}
        </div>
      ) : (r0 && r0.format !== 'pdf' ? (
        <OpenInTool getImage={() => r0.blob} exclude={['crop-image']} />
      ) : null)}
    />
  ) : null;

  const showQuality = fmtInfo.enc !== 'png';

  // The Back button normally routes through ToolWorkspace, but the editor
  // below renders its own layout instead of <ToolWorkspace> — wire the same
  // "Back returns to the upload screen" behaviour here too.
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(items.length ? ((busy || results) ? backFromResult : reset) : null);
    return () => registerBack(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, busy, results, registerBack]);

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
      disabled={!ready || busy}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Cropping…' : isBatch ? `Crop & download all ${items.length}` : 'Crop & download'}
    </button>
  );

  // Dedicated editing layout: canvas card + a tabbed panel (Tools / Download)
  // on the right, matching Resize Image's editing screen. The empty dropzone
  // and the result/download screen still go through <ToolWorkspace> below.
  if (items.length && !busy && !results) {
    return (
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] gap-6 items-start">
        <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

        <div className="min-w-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-900 dark:text-white truncate max-w-[12rem]">{cur?.file.name}</span>
              {cropPx && (
                <>
                  <span className="text-gray-400">·</span>
                  <span className="rounded-md bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-blue-700 dark:text-blue-300 font-medium">
                    {outW} × {outH}
                  </span>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => addInputRef.current?.click()}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Add images
              </button>
              <button
                type="button"
                onClick={reset}
                className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Start over
              </button>
            </div>
          </div>

          {/* every uploaded image — click to edit its crop; click again (or ⤢) to see it large */}
          {/* phones with a single photo don't need the strip — "Add images" is right above */}
          {items.length > 0 && (
            <div className={`mb-3 ${items.length === 1 ? 'hidden md:block' : ''}`}>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {items.map((it, i) => {
                  const on = it.id === selId;
                  const caption = `${it.file.name}${it.img ? ` · ${it.img.naturalWidth}×${it.img.naturalHeight}` : ''}`;
                  return (
                    <div
                      key={it.id}
                      className={`group relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-gray-100 dark:bg-gray-900 ${on ? 'border-blue-600' : 'border-transparent hover:border-blue-300 dark:hover:border-blue-700'}`}
                    >
                      <button
                        type="button"
                        title={on ? 'Click to view larger' : 'Edit this image'}
                        onClick={() => (on ? setPreview({ src: it.url, caption }) : setSelId(it.id))}
                        className={`block h-full w-full ${on ? 'cursor-zoom-in' : ''}`}
                      >
                        <img src={it.url} alt={it.file.name} draggable={false} className="h-full w-full object-contain" />
                      </button>
                      <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/55 px-1 text-[10px] font-semibold text-white">{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => setPreview({ src: it.url, caption })}
                        aria-label="View larger"
                        className="absolute bottom-0.5 left-0.5 rounded bg-black/60 p-0.5 text-white"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        aria-label="Remove image"
                        className="absolute bottom-0.5 right-0.5 rounded bg-black/60 p-0.5 text-white"
                      >
                        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
                      </button>
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => addInputRef.current?.click()}
                  className="grid h-20 w-20 shrink-0 place-items-center rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-blue-400 dark:border-gray-600 dark:text-gray-400"
                >
                  + Add
                </button>
              </div>
              <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                {isBatch
                  ? 'Each image keeps its own crop. Click an image to edit it — click it again to see it large.'
                  : 'Click the photo to see it large, or add more images to crop them together.'}
              </p>
            </div>
          )}

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
            <IconBtn active={flipH} title="Flip horizontal" onClick={() => { updateCur((it) => ({ flipH: !it.flipH })); setResults(null); }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M7 8l-3 4 3 4M17 8l3 4-3 4" />
              </svg>
            </IconBtn>
            <IconBtn active={flipV} title="Flip vertical" onClick={() => { updateCur((it) => ({ flipV: !it.flipV })); setResults(null); }}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 12h16M8 7l4-3 4 3M8 17l4 3 4-3" />
              </svg>
            </IconBtn>
            <button
              type="button"
              title="See the crop large"
              onClick={showCropPreview}
              disabled={!cropPx}
              className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
              </svg>
              Preview
            </button>
            {(rotation || straighten || flipH || flipV) ? (
              <button type="button" onClick={resetTransform} className="text-xs px-2 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
                Reset
              </button>
            ) : null}
          </div>

          <div className="rounded-xl bg-checkered flex items-center justify-center p-3 min-h-[200px] relative overflow-hidden">
            {!workUrl && (
              <div className="w-10 h-10 border-4 border-t-blue-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
            )}
            {workUrl && (
              <ReactCrop
                crop={crop}
                onChange={(_, p) => { updateCur({ crop: p }); setResults(null); }}
                onComplete={(_, p) => updateCur({ completed: p, seedKey })}
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
                  className="w-auto object-contain select-none"
                  style={{ maxHeight: 'min(60vh, 520px)', maxWidth: '100%' }}
                />
              </ReactCrop>
            )}
          </div>

          <div className="mt-4 hidden border-t border-gray-200 pt-3 md:block dark:border-gray-700">
            <OpenInTool getImage={getCurrentImage} exclude={['crop-image']} heading="Or send this image to" editing />
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
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Aspect ratio{isBatch && <span className="font-normal text-gray-400"> · all images</span>}
                  </h3>
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
                  <RangeSlider label="Straighten" value={straighten} min={-15} max={15} onChange={(v) => { updateCur({ straighten: v }); setResults(null); }} suffix="°" accent="blue" />
                </section>

                {cropPx && (
                  // exact pixel box: a desktop nicety — phones drag the frame
                  <section className="hidden space-y-2 border-t border-gray-200 pt-2.5 md:block dark:border-gray-700">
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
                  <select
                    value={effFormat}
                    onChange={(e) => { setFormat(e.target.value); setResults(null); }}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2"
                  >
                    {OUTPUT_FORMATS.filter((f) => !(circle && NO_ALPHA_FORMATS.includes(f.value))).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {circle && NO_ALPHA_FORMATS.includes(format) && (
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      Circle crop needs transparency — exporting as PNG instead.
                    </p>
                  )}
                  {showQuality && (
                    <RangeSlider label="Quality" value={quality} min={40} max={100} onChange={(v) => { setQuality(v); setResults(null); }} suffix="%" accent="blue" />
                  )}
                </section>

                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-2">
                  <input type="checkbox" checked={grid} onChange={(e) => setGrid(e.target.checked)} className="h-4 w-4 accent-blue-600" />
                  Show grid
                </label>
              </>
            )}

            {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
          </div>

          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            {footer}
          </div>
        </aside>

        {preview && <Lightbox src={preview.src} caption={preview.caption} onClose={closePreview} />}
      </div>
    );
  }

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="image/*"
      multiple
      formats="JPG · PNG · WebP · GIF · SVG — one or many"
      dropTitle="Drop images to crop"
      dropHint="one or many · or click to browse"
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || results) ? backFromResult : reset}
      result={resultView}
    />
  );
};

export default ImageCrop;

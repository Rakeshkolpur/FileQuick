import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import useObjectUrl from '../../../hooks/useObjectUrl';
import { formatBytes, pct, stripExt } from '../../../lib/format';
import { consumeHandoff } from '../../../lib/imageHandoff';
import { zipFiles } from '../../../lib/zip';
import {
  loadImageFromFile,
  rotateToCanvas,
  encodeImage,
  encodeToTargetBytes,
  outExt,
  isLossy,
  webpSupported,
} from '../../../lib/imageResize';
import { cutoutBackground, loadCutout, compositeOnColor } from '../../../lib/backgroundRemoval';
import CropModal from '../../tool/CropModal';

const BG_SWATCHES = ['transparent', '#ffffff', '#000000', '#f43f5e', '#3b82f6', '#22c55e', '#f59e0b'];

let uid = 0;

const ASPECTS = [
  { label: 'Free', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];
const SAVE_AS = [
  { value: 'original', label: 'Original format' },
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];
const SIZE_FORMATS = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
  { value: 'auto', label: 'Smallest' },
];
const SCALES = [0.25, 0.5, 0.75, 1];

const inputFmt = (file) => {
  const t = (file?.type || '').split('/')[1];
  if (t === 'jpeg' || t === 'jpg') return 'jpeg';
  if (t === 'png') return 'png';
  if (t === 'webp') return 'webp';
  return 'jpeg';
};
const initialCrop = (aspect, w, h) =>
  aspect
    ? centerCrop(makeAspectCrop({ unit: '%', width: 80 }, aspect, w, h), w, h)
    : { unit: '%', x: 8, y: 8, width: 84, height: 84 };

const qualityWord = (q) => {
  if (q >= 0.82) return 'looks great';
  if (q >= 0.65) return 'good quality';
  if (q >= 0.5) return 'acceptable';
  return 'reduced quality';
};

const numField =
  'w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent';
const chip =
  'px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40';
const chipActive = 'px-2.5 py-1 text-xs rounded-md bg-purple-600 text-white';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const Spinner = () => (
  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
  </svg>
);
const Check = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const rectFromPercent = (c, w, h) =>
  c && c.width
    ? { x: (c.x / 100) * w, y: (c.y / 100) * h, width: (c.width / 100) * w, height: (c.height / 100) * h }
    : null;

const IconBtn = ({ active, title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`h-8 w-8 flex items-center justify-center rounded-lg transition-colors ${
      active
        ? 'bg-purple-600 text-white'
        : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
    }`}
  >
    {children}
  </button>
);

const BatchCard = ({ item, result, onRemove, onDownload, onCrop }) => {
  const url = useObjectUrl(item.file);
  const [dl, setDl] = useState('idle');

  const croppedUrl = useMemo(() => {
    if (!item.cropRect || !item.img) return null;
    const { x, y, width, height } = item.cropRect;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(width));
    c.height = Math.max(1, Math.round(height));
    c.getContext('2d').drawImage(item.img, x, y, width, height, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  }, [item.cropRect, item.img]);

  const shownDims = item.cropRect
    ? `${Math.round(item.cropRect.width)}×${Math.round(item.cropRect.height)}`
    : `${item.w || '?'}×${item.h || '?'}`;

  const dlClick = async () => {
    if (dl !== 'idle') return;
    setDl('working');
    await sleep(300);
    try {
      onDownload();
      await sleep(150);
    } finally {
      setDl('done');
      setTimeout(() => setDl('idle'), 1500);
    }
  };
  return (
    <div className="rounded-xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-2">
      <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
        {(croppedUrl || url) && (
          <img src={croppedUrl || url} alt={item.file.name} className={`w-full h-full ${croppedUrl ? 'object-contain' : 'object-cover'}`} />
        )}
        {item.cropRect && (
          <span className="absolute bottom-1 left-1 rounded bg-purple-600 text-white text-[10px] px-1 py-0.5">Cropped</span>
        )}
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/50 text-white text-xs hover:bg-black/70"
          title="Remove"
        >
          ✕
        </button>
        <button
          type="button"
          onClick={onCrop}
          className="absolute top-1 left-1 h-6 px-1.5 rounded-full bg-black/50 text-white text-[10px] hover:bg-black/70 flex items-center gap-1"
          title="Crop this image"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
          </svg>
          Crop
        </button>
      </div>
      <p className="mt-1.5 text-xs font-medium text-gray-800 dark:text-gray-100 truncate" title={item.file.name}>
        {item.file.name}
      </p>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">
        {shownDims} · {formatBytes(item.file.size)}
      </p>
      {result && (
        <>
          <p className={`text-[11px] ${result.fits === false ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}`}>
            → {result.width}×{result.height} · {formatBytes(result.size)}
          </p>
          <button
            type="button"
            onClick={dlClick}
            className="mt-1 w-full text-xs py-1 rounded-md bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1"
          >
            {dl === 'working' ? (
              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
            ) : dl === 'done' ? (
              <><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Saved</>
            ) : (
              `Download .${outExt(result.format)}`
            )}
          </button>
        </>
      )}
    </div>
  );
};

// Keep previews compact so the controls below stay in view (portrait photos
// otherwise fill the screen and force a scroll).
const PREVIEW_IMG = 'max-h-[340px] max-w-full w-auto object-contain';

const ResultImg = ({ blob }) => {
  const url = useObjectUrl(blob);
  return url ? <img src={url} alt="Result" className={PREVIEW_IMG} /> : null;
};

const ImageResize = () => {
  const [items, setItems] = useState([]);
  const loadToken = useRef(0);
  const addInputRef = useRef(null);

  const [singleMode, setSingleMode] = useState('filesize'); // filesize | percent | dimensions
  const [batchMode, setBatchMode] = useState('filesize'); // filesize | percent | fit
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [dimsTouched, setDimsTouched] = useState(false);
  const [percent, setPercent] = useState(50);
  const [fitW, setFitW] = useState(1920);
  const [fitH, setFitH] = useState(1080);
  const [allowUpscale, setAllowUpscale] = useState(false);

  // file-size mode
  const [targetValue, setTargetValue] = useState('100');
  const [targetUnit, setTargetUnit] = useState('KB');
  const [sizeFormat, setSizeFormat] = useState(webpSupported() ? 'auto' : 'jpeg');
  const [allowResize, setAllowResize] = useState(false);

  // output (dimensions/percentage modes)
  const [saveAs, setSaveAs] = useState('original');
  const [quality, setQuality] = useState(90);
  const [highQuality, setHighQuality] = useState(true);

  // single transform
  const [rotation, setRotation] = useState(0);
  const [cropOn, setCropOn] = useState(false); // editing the crop right now
  const [cropApplied, setCropApplied] = useState(false); // a crop is committed
  const [cropAspect, setCropAspect] = useState(0);
  const [crop, setCrop] = useState(null);
  const [completedCrop, setCompletedCrop] = useState(null);

  // batch per-image crop
  const [cropModalId, setCropModalId] = useState(null);

  // background removal (single)
  const [bgRemove, setBgRemove] = useState(false);
  const [bgColor, setBgColor] = useState('transparent');
  const [cutoutImg, setCutoutImg] = useState(null);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgError, setBgError] = useState(null);

  const [results, setResults] = useState([]);
  const [, setDirty] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);

  const isBatch = items.length > 1;
  const single = items.length === 1 ? items[0] : null;
  const mode = isBatch ? batchMode : singleMode;
  const isSizeMode = mode === 'filesize';

  const markDirty = () => {
    setDirty(true);
    setResults([]);
    setProgress(null);
  };

  const loadItem = async (file, id) => {
    try {
      const img = await loadImageFromFile(file);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, img, w: img.naturalWidth, h: img.naturalHeight } : it)));
    } catch (e) {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, error: e.message } : it)));
    }
  };

  const addFiles = (fileList) => {
    const imgs = [...fileList].filter((f) => f.type.startsWith('image/'));
    if (!imgs.length) {
      setError('Please choose image files.');
      return;
    }
    setError(null);
    markDirty();
    setRotation(0);
    setCropOn(false);
    setDimsTouched(false);
    setBgRemove(false);
    setCutoutImg(null);
    setBgError(null);
    setCropOn(false);
    setCropApplied(false);
    setCompletedCrop(null);
    const next = imgs.map((file) => ({ id: ++uid, file, img: null, w: 0, h: 0 }));
    setItems((prev) => [...prev, ...next]);
    next.forEach((it) => loadItem(it.file, it.id));
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
    markDirty();
  };
  const reset = () => {
    loadToken.current += 1;
    setItems([]);
    setResults([]);
    setError(null);
    setRotation(0);
    setCropOn(false);
    setDimsTouched(false);
    setBgRemove(false);
    setCutoutImg(null);
    setBgError(null);
    setCropApplied(false);
    setCompletedCrop(null);
  };

  const setItemCrop = (id, rect) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, cropRect: rect || undefined } : it)));
    setCropModalId(null);
    markDirty();
  };

  const toggleBg = async () => {
    if (bgRemove) {
      setBgRemove(false);
      markDirty();
      return;
    }
    markDirty();
    if (cutoutImg) {
      setBgRemove(true);
      return;
    }
    if (!single?.file) return;
    setBgBusy(true);
    setBgError(null);
    setBgProgress(0);
    try {
      const blob = await cutoutBackground(single.file, setBgProgress);
      const img = await loadCutout(blob);
      setCutoutImg(img);
      setBgRemove(true);
      setDimsTouched(false);
    } catch (e) {
      setBgError('Background removal failed. The model may still be downloading — try again in a moment.');
    } finally {
      setBgBusy(false);
    }
  };

  useEffect(() => consumeHandoff((f) => addFiles([f]), 'image'), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- single work source: (bg-removed + colour) -> rotated ----
  const needsAlpha = bgRemove && bgColor === 'transparent';
  const baseSource = useMemo(() => {
    if (bgRemove && cutoutImg) return compositeOnColor(cutoutImg, bgColor);
    return single?.img || null;
  }, [bgRemove, cutoutImg, bgColor, single?.img]);

  const workSource = useMemo(
    () => (baseSource ? rotateToCanvas(baseSource, rotation) : null),
    [baseSource, rotation],
  );
  const workUrl = useMemo(() => (workSource ? workSource.toDataURL('image/png') : null), [workSource]);
  const natW = workSource?.width || single?.w || 0;
  const natH = workSource?.height || single?.h || 0;

  const cropRect = useMemo(() => {
    if (!cropApplied || !completedCrop || !completedCrop.width || !natW) return null;
    return rectFromPercent(completedCrop, natW, natH);
  }, [cropApplied, completedCrop, natW, natH]);

  const srcW = cropRect ? Math.round(cropRect.width) : natW;
  const srcH = cropRect ? Math.round(cropRect.height) : natH;
  const ratio = srcH ? srcW / srcH : 1;

  // preview of the committed crop
  const croppedPreviewUrl = useMemo(() => {
    if (!cropApplied || !cropRect || !workSource) return null;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cropRect.width));
    c.height = Math.max(1, Math.round(cropRect.height));
    c.getContext('2d').drawImage(
      workSource,
      cropRect.x, cropRect.y, cropRect.width, cropRect.height,
      0, 0, c.width, c.height,
    );
    return c.toDataURL('image/png');
  }, [cropApplied, cropRect, workSource]);

  useEffect(() => {
    if (single && !dimsTouched && srcW && srcH) {
      setWidth(String(srcW));
      setHeight(String(srcH));
    }
  }, [single, dimsTouched, srcW, srcH]);

  const onWidth = (v) => {
    setDimsTouched(true);
    markDirty();
    const w = Math.max(0, Math.round(Number(v) || 0));
    setWidth(v === '' ? '' : String(w));
    if (lockAspect && ratio && w) setHeight(String(Math.max(1, Math.round(w / ratio))));
  };
  const onHeight = (v) => {
    setDimsTouched(true);
    markDirty();
    const h = Math.max(0, Math.round(Number(v) || 0));
    setHeight(v === '' ? '' : String(h));
    if (lockAspect && ratio && h) setWidth(String(Math.max(1, Math.round(h * ratio))));
  };
  const applyScale = (s) => {
    setDimsTouched(true);
    markDirty();
    setWidth(String(Math.max(1, Math.round(srcW * s))));
    setHeight(String(Math.max(1, Math.round(srcH * s))));
  };

  const rotate = (delta) => {
    markDirty();
    setRotation((r) => (((r + delta) % 360) + 360) % 360);
    setDimsTouched(false);
    // rotation invalidates crop coordinates
    setCropOn(false);
    setCropApplied(false);
    setCrop(null);
    setCompletedCrop(null);
  };
  const startCrop = () => {
    markDirty();
    const c = completedCrop && completedCrop.width ? completedCrop : initialCrop(cropAspect, natW, natH);
    setCrop(c);
    setCompletedCrop(c);
    setCropOn(true);
  };
  const applyCrop = () => {
    setCropOn(false);
    setCropApplied(Boolean(completedCrop && completedCrop.width));
    setDimsTouched(false);
    markDirty();
  };
  const cancelCrop = () => {
    setCropOn(false);
    if (!cropApplied) {
      setCrop(null);
      setCompletedCrop(null);
    }
  };
  const removeCrop = () => {
    setCropOn(false);
    setCropApplied(false);
    setCrop(null);
    setCompletedCrop(null);
    setDimsTouched(false);
    markDirty();
  };
  const pickAspect = (a) => {
    setCropAspect(a);
    markDirty();
    if (cropOn) {
      const c = initialCrop(a, natW, natH);
      setCrop(c);
      setCompletedCrop(c);
      setDimsTouched(false);
    }
  };
  const resetTransform = () => {
    markDirty();
    setRotation(0);
    setCropOn(false);
    setCropApplied(false);
    setCrop(null);
    setCompletedCrop(null);
    setDimsTouched(false);
  };

  const rawFormat = isSizeMode
    ? sizeFormat
    : saveAs === 'original'
      ? inputFmt(single?.file || items[0]?.file)
      : saveAs;
  // A transparent background needs an alpha-capable format.
  const outFormat = needsAlpha && (rawFormat === 'jpeg' || rawFormat === 'auto') ? 'webp' : rawFormat;

  const targetBytes = useMemo(() => {
    const n = parseFloat(targetValue);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * (targetUnit === 'MB' ? 1024 * 1024 : 1024));
  }, [targetValue, targetUnit]);

  const singleOutDims = useMemo(() => {
    if (singleMode === 'percent') {
      return { w: Math.max(1, Math.round(srcW * (percent / 100))), h: Math.max(1, Math.round(srcH * (percent / 100))) };
    }
    return { w: Number(width) || srcW, h: Number(height) || srcH };
  }, [singleMode, percent, width, height, srcW, srcH]);

  const dimsFor = (it) => {
    const w = it.cropRect ? Math.round(it.cropRect.width) : it.w;
    const h = it.cropRect ? Math.round(it.cropRect.height) : it.h;
    if (batchMode === 'percent') {
      return { w: Math.max(1, Math.round(w * (percent / 100))), h: Math.max(1, Math.round(h * (percent / 100))) };
    }
    if (batchMode === 'filesize') return { w, h };
    let s = Math.min(fitW / w, fitH / h);
    if (s > 1 && !allowUpscale) s = 1;
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  };

  const anyResult = results.some(Boolean);
  const ready = items.length > 0 && items.every((it) => it.img) && !busy && (!isSizeMode || targetBytes);

  const run = async () => {
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      if (single) {
        const d = singleOutDims;
        let r;
        if (isSizeMode) {
          r = await encodeToTargetBytes(workSource, {
            cropRect,
            width: d.w,
            height: d.h,
            format: outFormat,
            targetBytes,
            highQuality,
            allowResize,
          });
        } else {
          const blob = await encodeImage(workSource, {
            cropRect,
            width: d.w,
            height: d.h,
            format: outFormat,
            quality: quality / 100,
            highQuality,
          });
          r = { blob, width: d.w, height: d.h, format: outFormat, fits: true, resized: false };
        }
        setResults([{ ...r, size: r.blob.size }]);
      } else {
        const out = [];
        setProgress({ done: 0, total: items.length });
        for (let i = 0; i < items.length; i += 1) {
          const it = items[i];
          if (!it.img) {
            out.push(null);
          } else {
            const d = dimsFor(it);
            const cr = it.cropRect || undefined;
            let r;
            if (isSizeMode) {
              // eslint-disable-next-line no-await-in-loop
              r = await encodeToTargetBytes(it.img, { cropRect: cr, width: d.w, height: d.h, format: outFormat, targetBytes, highQuality, allowResize });
            } else {
              // eslint-disable-next-line no-await-in-loop
              const blob = await encodeImage(it.img, { cropRect: cr, width: d.w, height: d.h, format: outFormat, quality: quality / 100, highQuality });
              r = { blob, width: d.w, height: d.h, format: outFormat, fits: true, resized: false };
            }
            out.push({ ...r, size: r.blob.size });
          }
          setProgress({ done: i + 1, total: items.length });
        }
        setResults(out);
      }
      setDirty(false);
    } catch (e) {
      setError(e.message || 'Something went wrong while resizing.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const nameFor = (file, r) => `${stripExt(file.name)}_${r.width}x${r.height}.${outExt(r.format || outFormat)}`;
  const downloadOne = (i) => {
    const r = results[i];
    if (r) downloadBlob(r.blob, nameFor(items[i].file, r));
  };
  const downloadAll = async () => {
    const z = results
      .map((r, i) => (r ? { name: nameFor(items[i].file, r), blob: r.blob } : null))
      .filter(Boolean);
    if (!z.length) return;
    downloadBlob(await zipFiles(z), 'filequick-images.zip');
  };

  const buttonLabel = isSizeMode && !targetBytes
    ? 'Enter a target size'
    : `Resize ${isBatch ? `${items.length} images` : 'image'}`;

  const r0 = results[0];

  const sidebar = (
    <>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Resize {isBatch && <span className="text-gray-400 font-normal">· {items.length} images</span>}
        </h3>

        <Segmented
          options={
            isBatch
              ? [
                  { value: 'filesize', label: 'File size' },
                  { value: 'percent', label: 'Percentage' },
                  { value: 'fit', label: 'Max size' },
                ]
              : [
                  { value: 'filesize', label: 'File size' },
                  { value: 'percent', label: 'Percentage' },
                  { value: 'dimensions', label: 'Dimensions' },
                ]
          }
          value={mode}
          onChange={(v) => { (isBatch ? setBatchMode : setSingleMode)(v); markDirty(); }}
        />

        {/* Dimensions (single) */}
        {!isBatch && singleMode === 'dimensions' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Width (px)</span>
                <input type="number" min="1" value={width} onChange={(e) => onWidth(e.target.value)} className={numField} />
              </label>
              <label className="text-xs">
                <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Height (px)</span>
                <input type="number" min="1" value={height} onChange={(e) => onHeight(e.target.value)} className={numField} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={lockAspect} onChange={(e) => setLockAspect(e.target.checked)} className="h-4 w-4 accent-purple-600" />
              Lock aspect ratio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SCALES.map((s) => (
                <button key={s} type="button" onClick={() => applyScale(s)} className={chip}>
                  {s === 1 ? 'Original' : `${s * 100}%`}
                </button>
              ))}
            </div>
          </>
        )}

        {/* Max size (batch) */}
        {isBatch && batchMode === 'fit' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Max width</span>
                <input type="number" min="1" value={fitW} onChange={(e) => { setFitW(Number(e.target.value) || 0); markDirty(); }} className={numField} />
              </label>
              <label className="text-xs">
                <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Max height</span>
                <input type="number" min="1" value={fitH} onChange={(e) => { setFitH(Number(e.target.value) || 0); markDirty(); }} className={numField} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={allowUpscale} onChange={(e) => { setAllowUpscale(e.target.checked); markDirty(); }} className="h-4 w-4 accent-purple-600" />
              Allow upscaling
            </label>
            <p className="text-xs text-gray-400 dark:text-gray-500">Each image fits inside this box, keeping its aspect ratio.</p>
          </>
        )}

        {/* Percentage */}
        {mode === 'percent' && (
          <>
            <RangeSlider label="Scale" value={percent} min={5} max={200} onChange={(v) => { setPercent(v); markDirty(); }} suffix="%" />
            {!isBatch && <p className="text-xs text-gray-400 dark:text-gray-500">Output: {singleOutDims.w} × {singleOutDims.h} px</p>}
          </>
        )}

        {/* File size */}
        {isSizeMode && (
          <div className="space-y-3">
            <div>
              <span className="block mb-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                Target size{isBatch ? ' (per image)' : ''}
              </span>
              <div className="flex gap-2">
                <input type="number" min="1" placeholder="e.g. 50" value={targetValue} onChange={(e) => { setTargetValue(e.target.value); markDirty(); }} className={numField} />
                <select value={targetUnit} onChange={(e) => { setTargetUnit(e.target.value); markDirty(); }} className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm px-2">
                  <option>KB</option>
                  <option>MB</option>
                </select>
              </div>
            </div>
            <div>
              <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Format</span>
              <Segmented
                options={needsAlpha ? [{ value: 'webp', label: 'WebP' }, { value: 'png', label: 'PNG' }] : SIZE_FORMATS}
                value={needsAlpha ? (sizeFormat === 'png' ? 'png' : 'webp') : sizeFormat}
                onChange={(v) => { setSizeFormat(v); markDirty(); }}
              />
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                {needsAlpha
                  ? 'Transparent background — WebP keeps it small, PNG is lossless.'
                  : sizeFormat === 'webp'
                    ? 'WebP fits more detail per KB — best quality at a small size.'
                    : sizeFormat === 'auto'
                      ? 'Tries JPG and WebP, keeps whichever looks best at your target size.'
                      : 'Most compatible. WebP or Smallest usually looks better at the same size.'}
              </p>
            </div>
            {!isBatch && (
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs">
                  <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Width (px)</span>
                  <input type="number" min="1" value={width} onChange={(e) => onWidth(e.target.value)} className={numField} />
                </label>
                <label className="text-xs">
                  <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Height (px)</span>
                  <input type="number" min="1" value={height} onChange={(e) => onHeight(e.target.value)} className={numField} />
                </label>
              </div>
            )}
            <label className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={allowResize} onChange={(e) => { setAllowResize(e.target.checked); markDirty(); }} className="mt-0.5 h-4 w-4 accent-purple-600" />
              <span>
                Allow smaller dimensions if needed
                <span className="block text-gray-400 dark:text-gray-500">
                  Only when compression alone can’t reach the target. Keeps the image sharp.
                </span>
              </span>
            </label>
          </div>
        )}
      </section>

      {single && (
        <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Crop</span>
          {cropApplied ? (
            <div className="flex items-center flex-wrap gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-300">Cropped to {srcW} × {srcH}</span>
              <button type="button" onClick={startCrop} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Edit</button>
              <button type="button" onClick={removeCrop} className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Remove</button>
            </div>
          ) : cropOn ? (
            <p className="text-xs text-gray-400 dark:text-gray-500">Drag the box on the image, then press <span className="font-medium text-purple-600 dark:text-purple-400">Apply crop</span>.</p>
          ) : (
            <button
              type="button"
              onClick={startCrop}
              className="w-full text-sm py-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-purple-400 dark:hover:border-purple-500"
            >
              + Crop image
            </button>
          )}
          {cropOn && (
            <div className="flex flex-wrap gap-1.5">
              {ASPECTS.map((a) => (
                <button key={a.label} type="button" onClick={() => pickAspect(a.value)} className={cropAspect === a.value ? chipActive : chip}>
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {single && (
        <section className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-white">Remove background</span>
            <button
              type="button"
              role="switch"
              aria-checked={bgRemove}
              disabled={bgBusy}
              onClick={toggleBg}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${
                bgRemove ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${bgRemove ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </label>

          {bgBusy && (
            <div>
              <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div className="h-full bg-purple-600 transition-all" style={{ width: `${Math.round(bgProgress * 100)}%` }} />
              </div>
              <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                Cutting out the subject… {Math.round(bgProgress * 100)}%
              </p>
            </div>
          )}
          {bgError && <p className="text-xs text-red-600 dark:text-red-400">{bgError}</p>}

          {bgRemove && cutoutImg && (
            <div>
              <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Background</span>
              <div className="flex flex-wrap items-center gap-2">
                {BG_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setBgColor(c); markDirty(); }}
                    title={c === 'transparent' ? 'Transparent' : c}
                    className={`h-7 w-7 rounded-lg border-2 ${
                      bgColor === c ? 'border-purple-600' : 'border-gray-200 dark:border-gray-600'
                    } ${c === 'transparent' ? 'bg-checkered' : ''}`}
                    style={c === 'transparent' ? undefined : { backgroundColor: c }}
                  />
                ))}
                <label
                  className={`h-7 w-7 rounded-lg border-2 overflow-hidden cursor-pointer flex ${
                    !BG_SWATCHES.includes(bgColor) ? 'border-purple-600' : 'border-gray-200 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: BG_SWATCHES.includes(bgColor) ? '#888' : bgColor }}
                  title="Custom colour"
                >
                  <input
                    type="color"
                    value={BG_SWATCHES.includes(bgColor) ? '#888888' : bgColor}
                    onChange={(e) => { setBgColor(e.target.value); markDirty(); }}
                    className="opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
              {needsAlpha && (
                <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">
                  Transparent → saved as {outFormat.toUpperCase()}.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {!isSizeMode && (
        <section className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
          <label className="block text-xs">
            <span className="block mb-1 font-medium text-gray-600 dark:text-gray-300">Save image as</span>
            <select value={saveAs} onChange={(e) => { setSaveAs(e.target.value); markDirty(); }} className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm p-2">
              {SAVE_AS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {isLossy(outFormat) && (
            <RangeSlider label="Quality" value={quality} min={10} max={100} onChange={(v) => { setQuality(v); markDirty(); }} suffix="%" />
          )}
        </section>
      )}

      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 pt-2">
        <input type="checkbox" checked={highQuality} onChange={(e) => { setHighQuality(e.target.checked); markDirty(); }} className="h-4 w-4 accent-purple-600" />
        High-quality downscaling
      </label>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!ready || cropOn}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {buttonLabel}
    </button>
  );

  const resultTotal = results.reduce((s, r) => s + (r ? r.size : 0), 0);
  const doneCount = results.filter(Boolean).length;
  const backFromResult = () => markDirty();

  const resultView = (busy || anyResult) ? (
    <ResultScreen
      working={busy}
      done={anyResult}
      progress={progress && progress.total ? Math.round((progress.done / progress.total) * 100) : (busy ? 0 : null)}
      workingLabel="Resizing your images…"
      title={isBatch ? 'Your images are resized' : 'Your image is resized'}
      subtitle={isBatch
        ? `${doneCount} file${doneCount > 1 ? 's' : ''} · ${formatBytes(resultTotal)}`
        : r0 ? `${r0.width} × ${r0.height} · ${formatBytes(r0.size)}` : undefined}
      fileName={!isBatch && r0 && single ? nameFor(single.file, r0) : undefined}
      fileSize={!isBatch && r0 ? r0.size : undefined}
      downloadLabel={isBatch ? 'Download all (ZIP)' : undefined}
      onDownload={() => (isBatch ? downloadAll() : downloadBlob(results[0].blob, nameFor(single.file, results[0])))}
      onBack={backFromResult}
      backLabel="Back to settings"
      extra={isBatch ? (
        <div className="max-h-52 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700/60">
          {results.map((r, i) => (r ? (
            <div key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
              <span className="truncate text-gray-600 dark:text-gray-300">{nameFor(items[i].file, r)}</span>
              <button type="button" onClick={() => downloadOne(i)} className="shrink-0 text-purple-600 dark:text-purple-400 hover:underline">
                {formatBytes(r.size)} · save
              </button>
            </div>
          ) : null))}
        </div>
      ) : null}
    />
  ) : null;

  return (
    <ToolWorkspace
      file={items[0]?.file || null}
      accept="image/*"
      multiple
      formats="JPG · PNG · WebP · GIF · SVG — select one or many"
      dropTitle="Drop images to resize"
      dropHint="one or many · or click to browse"
      onFiles={(fs) => addFiles(fs)}
      onBack={(busy || anyResult) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <input ref={addInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }} />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        {single ? (
          <div className="min-w-0 flex items-center gap-2 text-sm">
            <span className="font-medium text-gray-900 dark:text-white truncate max-w-[12rem]">{single.file.name}</span>
            <span className="text-gray-400">·</span>
            <span className="rounded-md bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-gray-600 dark:text-gray-300">{natW} × {natH}</span>
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 12h15" />
            </svg>
            <span className="rounded-md bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 text-purple-700 dark:text-purple-300 font-medium">
              {r0 ? `${r0.width} × ${r0.height}` : `${singleOutDims.w} × ${singleOutDims.h}`}
            </span>
          </div>
        ) : (
          <p className="text-sm font-medium text-gray-900 dark:text-white">{items.length} images</p>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => addInputRef.current?.click()} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Add images</button>
          <button type="button" onClick={reset} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600">Start over</button>
        </div>
      </div>

      {single ? (
        <>
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            {cropOn ? (
              <>
                <button type="button" onClick={applyCrop} className="h-8 px-3 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700">
                  Apply crop
                </button>
                <button type="button" onClick={cancelCrop} className="h-8 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-200 dark:hover:bg-gray-600">
                  Cancel
                </button>
                <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">drag to set the area</span>
              </>
            ) : (
              <>
                <IconBtn active={cropApplied} title="Crop" onClick={startCrop}>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 2v14a2 2 0 002 2h14M2 6h14a2 2 0 012 2v14" />
                  </svg>
                </IconBtn>
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
                {(rotation !== 0 || cropApplied) && (
                  <button type="button" onClick={resetTransform} className="text-xs px-2 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">Reset</button>
                )}
              </>
            )}
          </div>

          <div
            className={`rounded-xl flex items-center justify-center p-3 min-h-[200px] relative ${
              needsAlpha ? 'bg-checkered' : 'bg-gray-100 dark:bg-gray-900/50'
            }`}
          >
            {(busy || bgBusy) && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/70 dark:bg-gray-900/70 rounded-xl">
                <div className="w-10 h-10 border-4 border-t-purple-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
                {bgBusy && <p className="text-xs text-gray-500 dark:text-gray-400">Removing background… {Math.round(bgProgress * 100)}%</p>}
              </div>
            )}
            {cropOn && workUrl ? (
              <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(_, p) => setCompletedCrop(p)} aspect={cropAspect || undefined}>
                <img src={workUrl} alt="Source" className="max-h-[420px] max-w-full w-auto object-contain" />
              </ReactCrop>
            ) : r0 ? (
              <ResultImg blob={r0.blob} />
            ) : croppedPreviewUrl ? (
              <img src={croppedPreviewUrl} alt="Cropped" className={PREVIEW_IMG} />
            ) : (
              workUrl && <img src={workUrl} alt="Original" className={PREVIEW_IMG} />
            )}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-gray-500 dark:text-gray-400">{formatBytes(single.file.size)}</span>
            {r0 && (
              <>
                <span className="text-gray-400">→</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatBytes(r0.size)}</span>
                {r0.size < single.file.size && (
                  <span className="text-green-600 dark:text-green-400 font-medium">−{pct(single.file.size, r0.size)}%</span>
                )}
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 dark:text-gray-400">
                  {outExt(r0.format).toUpperCase()}
                  {r0.quality ? ` · ${Math.round(r0.quality * 100)}% (${qualityWord(r0.quality)})` : ''}
                </span>
                {isSizeMode && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r0.fits ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>
                    {r0.fits ? (r0.resized ? 'Target met · resized to fit' : 'Target met') : `Can't reach ${targetValue} ${targetUnit}`}
                  </span>
                )}
              </>
            )}
            {r0 && isSizeMode && !r0.fits && (
              <p className="w-full mt-1 text-xs text-amber-600 dark:text-amber-400">
                Smallest at {r0.width}×{r0.height} without wrecking the image. Try “WebP” / “Smallest”, lower the dimensions,
                or tick “allow smaller dimensions”.
              </p>
            )}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {items.map((it, i) => (
            <BatchCard
              key={it.id}
              item={it}
              result={results[i]}
              onRemove={() => removeItem(it.id)}
              onDownload={() => downloadOne(i)}
              onCrop={() => setCropModalId(it.id)}
            />
          ))}
        </div>
      )}

      {cropModalId != null && (() => {
        const it = items.find((x) => x.id === cropModalId);
        return it ? (
          <CropModal
            file={it.file}
            naturalWidth={it.w}
            naturalHeight={it.h}
            initialRect={it.cropRect}
            title={`Crop · ${it.file.name}`}
            onApply={(rect) => setItemCrop(it.id, rect)}
            onClose={() => setCropModalId(null)}
          />
        ) : null;
      })()}
    </ToolWorkspace>
  );
};

export default ImageResize;

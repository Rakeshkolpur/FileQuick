import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { encodeImage, outExt, rotateToCanvas } from '../../../lib/imageResize';
import { cutoutBackground, loadCutout, compositeOnColor, preloadBackgroundModel } from '../../../lib/backgroundRemoval';

const PLATFORMS = [
  { key: 'whatsapp', name: 'WhatsApp', sizes: [
    { label: 'Profile photo', w: 640, h: 640, round: true },
    { label: 'Status', w: 1080, h: 1920 },
  ] },
  { key: 'instagram', name: 'Instagram', sizes: [
    { label: 'Profile picture', w: 320, h: 320, round: true },
    { label: 'Square post', w: 1080, h: 1080 },
    { label: 'Portrait post', w: 1080, h: 1350 },
    { label: 'Story / Reel', w: 1080, h: 1920 },
    { label: 'Landscape post', w: 1080, h: 566 },
  ] },
  { key: 'facebook', name: 'Facebook', sizes: [
    { label: 'Profile picture', w: 720, h: 720, round: true },
    { label: 'Cover photo', w: 851, h: 315 },
    { label: 'Shared post', w: 1200, h: 630 },
    { label: 'Story', w: 1080, h: 1920 },
  ] },
  { key: 'x', name: 'X / Twitter', sizes: [
    { label: 'Profile picture', w: 400, h: 400, round: true },
    { label: 'Header', w: 1500, h: 500 },
    { label: 'Post image', w: 1600, h: 900 },
  ] },
  { key: 'linkedin', name: 'LinkedIn', sizes: [
    { label: 'Profile picture', w: 400, h: 400, round: true },
    { label: 'Cover / banner', w: 1584, h: 396 },
    { label: 'Company logo', w: 300, h: 300 },
    { label: 'Shared post', w: 1200, h: 627 },
  ] },
  { key: 'youtube', name: 'YouTube', sizes: [
    { label: 'Channel icon', w: 800, h: 800, round: true },
    { label: 'Channel banner', w: 2560, h: 1440 },
    { label: 'Video thumbnail', w: 1280, h: 720 },
  ] },
  { key: 'tiktok', name: 'TikTok', sizes: [
    { label: 'Profile photo', w: 200, h: 200, round: true },
    { label: 'Video', w: 1080, h: 1920 },
  ] },
  { key: 'telegram', name: 'Telegram', sizes: [
    { label: 'Profile photo', w: 512, h: 512, round: true },
  ] },
  { key: 'discord', name: 'Discord', sizes: [
    { label: 'Avatar', w: 512, h: 512, round: true },
    { label: 'Server banner', w: 960, h: 540 },
  ] },
  { key: 'pinterest', name: 'Pinterest', sizes: [
    { label: 'Profile picture', w: 165, h: 165, round: true },
    { label: 'Pin (2:3)', w: 1000, h: 1500 },
  ] },
  { key: 'reddit', name: 'Reddit', sizes: [
    { label: 'Avatar', w: 256, h: 256, round: true },
    { label: 'Banner', w: 1920, h: 384 },
  ] },
  { key: 'snapchat', name: 'Snapchat', sizes: [
    { label: 'Profile / Bitmoji', w: 320, h: 320, round: true },
  ] },
  { key: 'github', name: 'GitHub', sizes: [
    { label: 'Avatar', w: 460, h: 460, round: true },
  ] },
];

const FORMATS = [
  { value: 'jpeg', label: 'JPG' },
  { value: 'png', label: 'PNG' },
  { value: 'webp', label: 'WebP' },
];

const BG_COLORS = [
  { label: 'White', value: '#ffffff' },
  { label: 'Grey', value: '#f1f3f5' },
  { label: 'Sky', value: '#dbeafe' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Black', value: '#111827' },
  { label: 'None', value: 'transparent' },
];

const chip = 'px-2 py-1 text-[11px] rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors';
const chipActive = 'px-2 py-1 text-[11px] rounded-md bg-purple-600 text-white';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const IconBtn = ({ title, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className="h-8 w-8 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
  >
    {children}
  </button>
);

const ProfilePictureMaker = () => {
  const [file, setFile] = useState(null);
  const [img, setImg] = useState(null);
  const loadToken = useRef(0);

  const [platformKey, setPlatformKey] = useState('whatsapp');
  const [sizeIdx, setSizeIdx] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(100);

  const [crop, setCrop] = useState(null);
  const [completed, setCompleted] = useState(null);

  // background removal
  const [bgOn, setBgOn] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [cutoutImg, setCutoutImg] = useState(null);
  const [bgBusy, setBgBusy] = useState(false);
  const [bgProgress, setBgProgress] = useState(0);

  const [format, setFormat] = useState('jpeg');
  const [quality, setQuality] = useState(92);
  const [roundExport, setRoundExport] = useState(false);

  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const platform = PLATFORMS.find((p) => p.key === platformKey) || PLATFORMS[0];
  const size = platform.sizes[sizeIdx] || platform.sizes[0];
  const aspect = size.w / size.h;

  useEffect(() => { preloadBackgroundModel(); }, []);

  const loadImage = (f) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onload = () => { URL.revokeObjectURL(url); resolve(im); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read this image.')); };
    im.src = url;
  });

  const handleFile = async (f) => {
    if (!f || !f.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    const t = ++loadToken.current;
    setError(null);
    setResult(null);
    setFile(f);
    setRotation(0);
    setZoom(100);
    setBgOn(false);
    setCutoutImg(null);
    try {
      const im = await loadImage(f);
      if (t === loadToken.current) setImg(im);
    } catch (e) {
      if (t === loadToken.current) setError(e.message);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let pending = null;
    try {
      pending = sessionStorage.getItem('pendingImageUpload');
      if (pending) sessionStorage.removeItem('pendingImageUpload');
    } catch (_) { /* ignore */ }
    if (!pending) return undefined;
    fetch(pending).then((r) => r.blob()).then((blob) => {
      if (cancelled) return;
      const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
      handleFile(new File([blob], `photo.${ext}`, { type: blob.type }));
    }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reset = () => {
    loadToken.current += 1;
    setFile(null); setImg(null); setResult(null); setError(null);
    setBgOn(false); setCutoutImg(null);
  };

  const toggleBg = async (on) => {
    setBgOn(on);
    setResult(null);
    if (!on || cutoutImg || !file) return;
    setBgBusy(true);
    setBgProgress(0);
    setError(null);
    try {
      const png = await cutoutBackground(file, (p) => setBgProgress(p));
      const cut = await loadCutout(png);
      setCutoutImg(cut);
    } catch (e) {
      setError('Background removal failed — try a clearer photo.');
      setBgOn(false);
    } finally {
      setBgBusy(false);
    }
  };

  // background-composited (or original) source, then rotated
  const baseSource = useMemo(() => {
    if (bgOn && cutoutImg) return compositeOnColor(cutoutImg, bgColor);
    return img;
  }, [img, bgOn, cutoutImg, bgColor]);

  const workCanvas = useMemo(
    () => (baseSource ? rotateToCanvas(baseSource, rotation) : null),
    [baseSource, rotation],
  );
  const workUrl = useMemo(() => (workCanvas ? workCanvas.toDataURL('image/png') : null), [workCanvas]);
  const natW = workCanvas?.width || 0;
  const natH = workCanvas?.height || 0;

  // largest aspect-correct box (%) shrunk by zoom, centred on (cx, cy)
  const boxFor = useCallback((z, cx = 50, cy = 50) => {
    if (!natW || !natH) return null;
    const arImg = natW / natH;
    let w = 100;
    let h = 100;
    if (aspect > arImg) h = (natW / aspect) / natH * 100;
    else w = (natH * aspect) / natW * 100;
    w /= (z / 100);
    h /= (z / 100);
    const x = clamp(cx - w / 2, 0, 100 - w);
    const y = clamp(cy - h / 2, 0, 100 - h);
    return { unit: '%', x, y, width: w, height: h };
  }, [natW, natH, aspect]);

  // reseed the crop whenever the image, target size or rotation changes
  const seedKey = `${natW}x${natH}:${platformKey}:${sizeIdx}:${rotation}`;
  useEffect(() => {
    if (!natW || !natH) return;
    setResult(null);
    // For a round profile size, start pulled-in and framed on the upper half
    // (where a face usually sits) so the whole circle is visible.
    const startZoom = size.round ? 135 : 100;
    const startY = size.round ? 42 : 50;
    setZoom(startZoom);
    const c = boxFor(startZoom, 50, startY);
    if (c) { setCrop(c); setCompleted(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  const onZoom = (z) => {
    setZoom(z);
    setResult(null);
    const cx = completed ? completed.x + completed.width / 2 : 50;
    const cy = completed ? completed.y + completed.height / 2 : 50;
    const c = boxFor(z, cx, cy);
    if (c) { setCrop(c); setCompleted(c); }
  };

  const rotate = (d) => { setRotation((r) => (((r + d) % 360) + 360) % 360); setResult(null); };

  const effFormat = (size.round && roundExport) ? 'png' : format;
  const showQuality = effFormat !== 'png';

  const run = async () => {
    if (!workCanvas || !completed || !completed.width) return;
    setBusy(true);
    setError(null);
    try {
      const cx = Math.round((completed.x / 100) * natW);
      const cy = Math.round((completed.y / 100) * natH);
      const cw = Math.max(1, Math.round((completed.width / 100) * natW));
      const ch = Math.max(1, Math.round((completed.height / 100) * natH));

      let canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(workCanvas, cx, cy, cw, ch, 0, 0, cw, ch);

      if (size.round && roundExport) {
        const c2 = document.createElement('canvas');
        c2.width = cw;
        c2.height = ch;
        const ctx = c2.getContext('2d');
        ctx.beginPath();
        ctx.ellipse(cw / 2, ch / 2, cw / 2, ch / 2, 0, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(canvas, 0, 0);
        canvas = c2;
      }

      const blob = await encodeImage(canvas, {
        width: size.w,
        height: size.h,
        format: effFormat,
        quality: quality / 100,
        highQuality: true,
        background: bgOn && bgColor !== 'transparent' ? bgColor : '#ffffff',
      });
      setResult({ blob, size: blob.size, format: effFormat });
    } catch (e) {
      setError(e.message || 'Could not create the image.');
    } finally {
      setBusy(false);
    }
  };

  const outName = file
    ? `${stripExt(file.name)}-${platform.key}-${slug(size.label)}-${size.w}x${size.h}.${outExt(effFormat)}`
    : 'profile-picture';
  const backFromResult = () => setResult(null);

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title={`Your ${platform.name} ${size.label.toLowerCase()} is ready`}
      workingLabel="Resizing your photo…"
      subtitle={result ? `${size.w} × ${size.h} px · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to editing"
      note={size.round
        ? 'Most apps crop your photo to a circle themselves — upload the square version unless you need a transparent circle.'
        : 'The image stays on your device — nothing is uploaded.'}
    />
  ) : null;

  const sidebar = (
    // one wrapper so ToolWorkspace's `space-y-5` doesn't stack on our own gaps
    <div className="space-y-3 -mt-1">
      <section className="space-y-1.5">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Where&apos;s it for?</h3>
        <div
          className="flex gap-1.5 overflow-x-auto -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => { setPlatformKey(p.key); setSizeIdx(0); }}
              className={`${p.key === platformKey ? chipActive : chip} whitespace-nowrap shrink-0`}
            >
              {p.name}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500">swipe for more →</p>
      </section>

      <section className="space-y-1.5 pt-3 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{platform.name} size</h3>
        <div className="flex flex-col gap-1">
          {platform.sizes.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setSizeIdx(i)}
              className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${
                i === sizeIdx
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <span className="flex items-center gap-1.5">
                {s.round && <span aria-hidden>◯</span>}
                {s.label}
              </span>
              <span className={`text-[11px] tabular-nums ${i === sizeIdx ? 'text-white/80' : 'text-gray-400 dark:text-gray-500'}`}>
                {s.w}×{s.h}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2.5 pt-3 border-t border-gray-200 dark:border-gray-700">
        <RangeSlider label="Zoom" value={zoom} min={100} max={300} step={5} suffix="%" onChange={onZoom} />
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300 mr-1">Rotate</span>
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
        </div>
      </section>

      <section className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
          <input
            type="checkbox"
            checked={bgOn}
            disabled={bgBusy}
            onChange={(e) => toggleBg(e.target.checked)}
            className="h-4 w-4 accent-purple-600"
          />
          Replace background
        </label>
        {bgBusy && (
          <div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div className="h-full bg-purple-600 transition-all" style={{ width: `${Math.round(bgProgress * 100)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">
              Cutting out the background… first run also downloads the model (~40&nbsp;MB).
            </p>
          </div>
        )}
        {bgOn && cutoutImg && !bgBusy && (
          <div className="flex flex-wrap gap-1.5">
            {BG_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                title={c.label}
                onClick={() => { setBgColor(c.value); setResult(null); }}
                className={`h-7 w-7 rounded-lg border-2 transition-transform ${
                  bgColor === c.value ? 'border-purple-600 scale-110' : 'border-gray-200 dark:border-gray-600'
                } ${c.value === 'transparent' ? 'bg-checkered' : ''}`}
                style={c.value === 'transparent' ? undefined : { background: c.value }}
              />
            ))}
            <label
              className={`h-7 w-7 rounded-lg border-2 grid place-items-center cursor-pointer ${
                BG_COLORS.every((c) => c.value !== bgColor) ? 'border-purple-600 scale-110' : 'border-gray-200 dark:border-gray-600'
              }`}
              style={{ background: BG_COLORS.every((c) => c.value !== bgColor) ? bgColor : 'transparent' }}
              title="Custom colour"
            >
              <input
                type="color"
                value={/^#/.test(bgColor) ? bgColor : '#8888aa'}
                onChange={(e) => { setBgColor(e.target.value); setResult(null); }}
                className="sr-only"
              />
              <svg className="h-3.5 w-3.5 text-gray-500 dark:text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M12 5v14M5 12h14" />
              </svg>
            </label>
          </div>
        )}
      </section>

      <section className="space-y-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Output</h3>
          {size.round && (
            <label className="flex items-center gap-1.5 text-[12px] text-gray-600 dark:text-gray-300" title={`Transparent PNG circle — ${platform.name} usually rounds it for you`}>
              <input
                type="checkbox"
                checked={roundExport}
                onChange={(e) => { setRoundExport(e.target.checked); setResult(null); }}
                className="h-3.5 w-3.5 accent-purple-600"
              />
              circle cut-out
            </label>
          )}
        </div>
        <Segmented
          options={(size.round && roundExport) ? FORMATS.filter((f) => f.value === 'png') : FORMATS}
          value={effFormat}
          onChange={(v) => { setFormat(v); setResult(null); }}
        />
        {showQuality && (
          <RangeSlider label="Quality" value={quality} min={40} max={100} onChange={(v) => { setQuality(v); setResult(null); }} suffix="%" />
        )}
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </div>
  );

  const footer = (
    <button
      type="button"
      onClick={run}
      disabled={!completed || busy || bgBusy}
      className="w-full py-2.5 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
    >
      {busy ? 'Working…' : `Make ${platform.name} ${size.label.toLowerCase()}`}
    </button>
  );

  return (
    <ToolWorkspace
      file={file}
      accept="image/*"
      formats="JPG · PNG · WebP — a selfie or any photo"
      dropTitle="Drop a photo to resize"
      dropHint="or click to browse — for any social profile or cover"
      onFiles={(fs) => handleFile(fs[0])}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="mx-auto" style={{ maxWidth: 560 }}>
        <div className="flex items-center justify-between gap-2 mb-2 text-[13px]">
          <span className="min-w-0 truncate font-medium text-gray-900 dark:text-white">{file?.name}</span>
          <span className="flex items-center gap-2 shrink-0">
            <span className="rounded-md bg-purple-100 dark:bg-purple-900/40 px-1.5 py-0.5 text-purple-700 dark:text-purple-300 font-medium tabular-nums">
              {size.w}×{size.h}
            </span>
            <button
              type="button"
              onClick={reset}
              className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
            >
              Change
            </button>
          </span>
        </div>

        <div className="rounded-xl bg-checkered flex items-center justify-center p-2 relative overflow-hidden" style={{ height: 384 }}>
          {(busy || bgBusy) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-gray-900/60 rounded-xl">
              <div className="w-9 h-9 border-4 border-t-purple-600 border-gray-300 dark:border-gray-600 rounded-full animate-spin" />
            </div>
          )}
          {workUrl && (
            <ReactCrop
              crop={crop}
              onChange={(_, p) => { setCrop(p); setResult(null); }}
              onComplete={(_, p) => setCompleted(p)}
              aspect={aspect}
              circularCrop={size.round}
              keepSelection
              ruleOfThirds
              style={{ maxHeight: 364, maxWidth: '100%' }}
            >
              <img src={workUrl} alt="To resize" className="max-w-full w-auto object-contain select-none" style={{ maxHeight: 364 }} />
            </ReactCrop>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500 text-center">
          Drag the box to frame your face, or use Zoom. Output is exactly {size.w}×{size.h}px.
        </p>
      </div>
    </ToolWorkspace>
  );
};

export default ProfilePictureMaker;

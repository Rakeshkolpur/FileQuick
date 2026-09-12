import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import OpenInPdfTool from '../../tool/OpenInPdfTool';
import OpenInTool from '../../tool/OpenInTool';
import { formatBytes, stripExt } from '../../../lib/format';
import { consumePdfHandoff } from '../../../lib/pdfHandoff';
import { consumeHandoff } from '../../../lib/imageHandoff';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';
import { parsePageRange } from '../../../lib/pageRange';
import { loadImageFromFile, outExt, mimeFor } from '../../../lib/imageResize';

const isPdfFile = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const isImageFile = (f) => f && f.type.startsWith('image/');
const RAD = Math.PI / 180;
// A photo has no natural "points" like a PDF page does, so for the purpose of
// sizing the watermark we treat every photo as if it were on a page this many
// units wide — the same "size"/"logo width %" settings then look the same
// proportionally on a phone screenshot and a 6000px camera photo.
const IMAGE_REF_WIDTH = 600;

const PRESETS = ['DRAFT', 'CONFIDENTIAL', 'COPY', 'SAMPLE', 'ORIGINAL', 'PAID'];
const FONTS = [
  { value: 'Helvetica', label: 'Sans', std: StandardFonts.HelveticaBold, css: 'ui-sans-serif, system-ui, sans-serif' },
  { value: 'Times', label: 'Serif', std: StandardFonts.TimesRomanBold, css: 'Georgia, "Times New Roman", serif' },
  { value: 'Courier', label: 'Mono', std: StandardFonts.CourierBold, css: 'ui-monospace, "Courier New", monospace' },
];
const COLORS = [
  { name: 'Grey', hex: '#6b7280' }, { name: 'Red', hex: '#dc2626' },
  { name: 'Blue', hex: '#2563eb' }, { name: 'Black', hex: '#111827' },
];
const POSITIONS = [
  { value: 'center', label: 'Centre' },
  { value: 'tile', label: 'Tiled' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];
const hexRgb = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/**
 * Where to stamp the watermark: one centre for a fixed position, a grid of
 * centres for "Tiled", or a user-dragged point. Shared by the PDF (pdf-lib, Y
 * grows up) and image (canvas, Y grows down) bake steps — `flipY` is the only
 * thing that differs. `customPos` is { x, y } as a 0–100 percent of the page/
 * photo, measured the way the screen shows it (y=0 is the top) regardless of
 * which way the underlying coordinate space actually grows.
 */
function watermarkCenters({ W, H, position, flipY, stepX, stepY, customPos }) {
  if (position === 'tile') {
    const centers = [];
    for (let gy = stepY / 2; gy < H + stepY; gy += stepY) {
      for (let gx = stepX / 2; gx < W + stepX; gx += stepX) centers.push([gx, gy]);
    }
    return centers;
  }
  if (customPos) {
    const cx = (customPos.x / 100) * W;
    const cy = flipY ? (customPos.y / 100) * H : H - (customPos.y / 100) * H;
    return [[cx, cy]];
  }
  const nearTop = flipY ? H * 0.15 : H * 0.85;
  const nearBottom = flipY ? H * 0.85 : H * 0.15;
  const cy = position === 'top' ? nearTop : position === 'bottom' ? nearBottom : H / 2;
  return [[W / 2, cy]];
}

const baseImageFormat = (mimeType) => (mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpeg');

const WatermarkPDF = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null); // PDF only
  const [pdf, setPdf] = useState(null); // PDF only (pdfjs doc)
  const [srcImg, setSrcImg] = useState(null); // image only (full-res HTMLImageElement)
  const [pageCount, setPageCount] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(1);
  const [preview, setPreview] = useState(null); // { url, wPt, hPt }

  const [mode, setMode] = useState('text'); // text | image
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontKey, setFontKey] = useState('Helvetica');
  const [size, setSize] = useState(60);
  const [color, setColor] = useState('#6b7280');
  const [imgSrc, setImgSrc] = useState(null); // watermark logo, data URL
  const [imgDims, setImgDims] = useState(null); // watermark logo {w,h}
  const [imgScale, setImgScale] = useState(40); // % of page/photo width

  const [opacity, setOpacity] = useState(25);
  const [angle, setAngle] = useState(45);
  const [position, setPosition] = useState('center');
  // A drag in the preview overrides `position`'s fixed spot — { x, y } as a
  // 0–100% point, null while a preset (Centre/Top/Bottom/Tiled) is in charge.
  const [customPos, setCustomPos] = useState(null);
  const [scope, setScope] = useState('all'); // PDF only
  const [rangeText, setRangeText] = useState(''); // PDF only

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const tok = useRef(0);
  const previewBoxRef = useRef(null);
  const isImageSrc = !!file && isImageFile(file);
  useEffect(() => { setResult(null); }, [mode, text, fontKey, size, color, imgSrc, imgScale, opacity, angle, position, customPos, scope, rangeText]);

  const font = FONTS.find((f) => f.value === fontKey) || FONTS[0];

  const loadPreview = useCallback(async (doc, idx) => {
    const t = ++tok.current;
    try {
      const page = await doc.getPage(idx);
      const vp = page.getViewport({ scale: 1 });
      const canvas = await renderPageToCanvas(doc, idx, { scale: 1.5 });
      if (t !== tok.current) return;
      setPreview({ url: canvas.toDataURL('image/jpeg', 0.82), wPt: vp.width, hPt: vp.height });
    } catch (_) { /* ignore */ }
  }, []);

  const loadImagePreview = (im) => {
    // A lighter preview than the full-res photo; the bake step redraws from
    // the original, full-resolution <img> kept in `srcImg`.
    const maxDim = 1400;
    const s = Math.min(1, maxDim / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * s));
    c.height = Math.max(1, Math.round(im.naturalHeight * s));
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    setPreview({
      url: c.toDataURL('image/jpeg', 0.85),
      wPt: IMAGE_REF_WIDTH,
      hPt: IMAGE_REF_WIDTH * (im.naturalHeight / im.naturalWidth),
    });
  };

  const onFiles = useCallback(async (list) => {
    const f = [...list].find((x) => isPdfFile(x) || isImageFile(x));
    if (!f) { setError('Please choose a PDF, or a JPG / PNG / WebP photo.'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      if (isImageFile(f)) {
        const im = await loadImageFromFile(f);
        setFile(f); setBytes(null); setPdf(null); setSrcImg(im);
        setPageCount(1); setPreviewIdx(1);
        loadImagePreview(im);
      } else {
        const ab = await f.arrayBuffer();
        const doc = await openPdf(ab);
        setFile(f); setBytes(ab); setPdf(doc); setSrcImg(null);
        setPageCount(doc.numPages);
        setPreviewIdx(1);
        await loadPreview(doc, 1);
      }
    } catch (e) {
      setError(
        isImageFile(f)
          ? 'Could not read that image.'
          : e?.message?.toLowerCase().includes('password')
            ? 'That PDF is password-protected. Unlock it first.'
            : 'Could not read that PDF — it may be damaged.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  useEffect(() => consumePdfHandoff((f) => onFiles([f]), 'document'), [onFiles]);
  useEffect(() => consumeHandoff((f) => onFiles([f]), 'photo'), [onFiles]);

  const reset = () => {
    tok.current += 1;
    setFile(null); setBytes(null); setPdf(null); setSrcImg(null); setPageCount(0);
    setPreview(null); setResult(null); setError(null); setCustomPos(null);
  };

  // Drag the watermark anywhere in the preview — mouse or touch, via Pointer
  // Events. Disabled for "Tiled" (there's no single spot to drag).
  const dragStateRef = useRef(null);
  const posFromEvent = (e) => {
    const box = previewBoxRef.current;
    if (!box) return null;
    const rect = box.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(2, Math.min(98, ((e.clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };
  const startDrag = (e) => {
    if (position === 'tile') return;
    e.preventDefault();
    e.stopPropagation();
    const p = posFromEvent(e);
    if (p) setCustomPos(p);
    dragStateRef.current = true;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragMove = (e) => {
    if (!dragStateRef.current) return;
    const p = posFromEvent(e);
    if (p) setCustomPos(p);
  };
  const endDrag = () => { dragStateRef.current = null; };
  const backFromResult = () => setResult(null);
  const gotoPage = async (n) => {
    const i = Math.max(1, Math.min(pageCount, n));
    setPreviewIdx(i);
    if (pdf) await loadPreview(pdf, i);
  };

  const onImage = (e) => {
    const f = e.target.files?.[0];
    if (!f || !f.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const im = new Image();
      im.onload = () => { setImgDims({ w: im.naturalWidth, h: im.naturalHeight }); setImgSrc(reader.result); setMode('image'); };
      im.src = reader.result;
    };
    reader.readAsDataURL(f);
  };

  const targetPages = useMemo(
    () => (scope === 'all' ? Array.from({ length: pageCount }, (_, i) => i + 1) : parsePageRange(rangeText, pageCount)),
    [scope, rangeText, pageCount],
  );
  const ready = (pdf || srcImg)
    && (isImageSrc || targetPages.length)
    && (mode === 'text' ? text.trim() : imgSrc);

  const applyToPdf = async () => {
    const doc = await PDFDocument.load(bytes);
    const f = mode === 'text' ? await doc.embedFont(font.std) : null;
    const img = mode === 'image'
      ? await (imgSrc.startsWith('data:image/png') ? doc.embedPng(imgSrc) : doc.embedJpg(imgSrc))
      : null;
    const set = new Set(targetPages);
    const op = opacity / 100;
    const th = angle * RAD;

    doc.getPages().forEach((page, i) => {
      if (!set.has(i + 1)) return;
      const { width: W, height: H } = page.getSize();

      const stampAt = (cx, cy) => {
        if (mode === 'text') {
          const tw = f.widthOfTextAtSize(text, size);
          const x = cx - (tw / 2) * Math.cos(th) + (size / 2) * Math.sin(th);
          const y = cy - (tw / 2) * Math.sin(th) - (size / 2) * Math.cos(th);
          page.drawText(text, { x, y, size, font: f, color: hexRgb(color), opacity: op, rotate: degrees(angle) });
        } else {
          const w = (imgScale / 100) * W;
          const h = w * (imgDims.h / imgDims.w);
          const x = cx - (w / 2) * Math.cos(th) + (h / 2) * Math.sin(th);
          const y = cy - (w / 2) * Math.sin(th) - (h / 2) * Math.cos(th);
          page.drawImage(img, { x, y, width: w, height: h, opacity: op, rotate: degrees(angle) });
        }
      };

      const stepX = mode === 'text' ? Math.max(140, f.widthOfTextAtSize(text, size) * 0.9 + 60) : (imgScale / 100) * W + 40;
      const stepY = mode === 'text' ? Math.max(110, size * 2.4) : ((imgScale / 100) * W) * (imgDims.h / imgDims.w) + 40;
      watermarkCenters({ W, H, position, flipY: false, stepX, stepY, customPos }).forEach(([cx, cy]) => stampAt(cx, cy));
    });

    const outBytes = await doc.save();
    return new Blob([outBytes], { type: 'application/pdf' });
  };

  const applyToImage = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = srcImg.naturalWidth;
    canvas.height = srcImg.naturalHeight;
    const ctx = canvas.getContext('2d');
    const fmt = baseImageFormat(file.type);
    if (fmt === 'jpeg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
    ctx.drawImage(srcImg, 0, 0);

    // Pixels-per-"unit" for this photo, so a size/logo-width set on a small
    // screenshot looks the same proportionally as on a huge camera photo.
    const scale = canvas.width / IMAGE_REF_WIDTH;
    const pxSize = size * scale;
    const op = opacity / 100;
    const rot = -(angle * RAD); // matches the CSS preview overlay's rotate(-angle)

    let wmImg = null;
    if (mode === 'image') {
      wmImg = new Image();
      wmImg.src = imgSrc;
      if (!wmImg.complete) await new Promise((res, rej) => { wmImg.onload = res; wmImg.onerror = () => rej(new Error('Could not load the logo.')); });
    } else {
      ctx.font = `bold ${pxSize}px ${font.css}`;
    }

    const stampAt = (cx, cy) => {
      ctx.save();
      ctx.globalAlpha = op;
      ctx.translate(cx, cy);
      ctx.rotate(rot);
      if (mode === 'text') {
        ctx.fillStyle = color;
        ctx.font = `bold ${pxSize}px ${font.css}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 0, 0);
      } else {
        const w = (imgScale / 100) * canvas.width;
        const h = w * (imgDims.h / imgDims.w);
        ctx.drawImage(wmImg, -w / 2, -h / 2, w, h);
      }
      ctx.restore();
    };

    const measuredTw = mode === 'text' ? ctx.measureText(text).width : 0;
    const stepX = mode === 'text'
      ? Math.max(140 * scale, measuredTw * 0.9 + 60 * scale)
      : (imgScale / 100) * canvas.width + 40 * scale;
    const stepY = mode === 'text'
      ? Math.max(110 * scale, pxSize * 2.4)
      : ((imgScale / 100) * canvas.width) * (imgDims.h / imgDims.w) + 40 * scale;
    watermarkCenters({ W: canvas.width, H: canvas.height, position, flipY: true, stepX, stepY, customPos }).forEach(([cx, cy]) => stampAt(cx, cy));

    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not export the image.'))), mimeFor(fmt), 0.92);
    });
  };

  const apply = async () => {
    if (!ready) { setError(mode === 'text' ? 'Type the watermark text.' : 'Choose an image.'); return; }
    setBusy(true);
    setError(null);
    try {
      const blob = isImageSrc ? await applyToImage() : await applyToPdf();
      setResult({ blob, size: blob.size, count: isImageSrc ? 1 : targetPages.length });
    } catch (e) {
      setError(`Could not add the watermark: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outExtension = isImageSrc ? outExt(baseImageFormat(file.type)) : 'pdf';
  const outName = `${stripExt(file?.name || (isImageSrc ? 'photo' : 'document'))}-watermarked.${outExtension}`;
  const btn = 'flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF or photo'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">Start over</button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">
          {formatBytes(file?.size)}{isImageSrc ? '' : ` · ${pageCount} page${pageCount === 1 ? '' : 's'}`}
        </p>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <Segmented options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image / logo' }]} value={mode} onChange={setMode} />

        {mode === 'text' ? (
          <>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Watermark text"
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p} type="button" onClick={() => setText(p)} className={`${btn} ${text === p ? '!bg-purple-100 dark:!bg-purple-900/40 !text-purple-700 dark:!text-purple-300' : ''}`}>{p}</button>
              ))}
            </div>
            <Segmented options={FONTS.map((x) => ({ value: x.value, label: x.label }))} value={fontKey} onChange={setFontKey} />
            <RangeSlider label="Text size" value={size} min={16} max={140} onChange={setSize} suffix=" pt" />
            <div className="flex gap-2 pt-1">
              {COLORS.map((c) => (
                <button key={c.hex} type="button" title={c.name} onClick={() => setColor(c.hex)}
                  className={`h-6 w-6 rounded-full border-2 ${color === c.hex ? 'border-purple-500' : 'border-gray-200 dark:border-gray-600'}`} style={{ backgroundColor: c.hex }} />
              ))}
            </div>
          </>
        ) : (
          <>
            {imgSrc ? (
              <div className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white p-2 flex items-center justify-center">
                <img src={imgSrc} alt="watermark" className="max-h-16 max-w-full object-contain" />
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 cursor-pointer hover:border-purple-400 text-xs text-gray-500 dark:text-gray-400">
                Choose a PNG / JPG logo
                <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImage} />
              </label>
            )}
            {imgSrc && (
              <>
                <RangeSlider label="Logo width" value={imgScale} min={10} max={90} onChange={setImgScale} suffix={isImageSrc ? ' % of photo' : ' % of page'} />
                <label className="block text-xs text-purple-600 dark:text-purple-400 cursor-pointer">
                  Replace image
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={onImage} />
                </label>
              </>
            )}
          </>
        )}
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Placement</h3>
        <Segmented options={POSITIONS} value={position} onChange={(v) => { setPosition(v); setCustomPos(null); }} />
        <p className="text-[11px] text-gray-400 dark:text-gray-500">
          {position === 'tile'
            ? 'Tiled repeats across the whole page, so there’s no single spot to drag.'
            : customPos
              ? <>Placed by hand. <button type="button" onClick={() => setCustomPos(null)} className="text-purple-600 dark:text-purple-400 hover:underline">Reset to {POSITIONS.find((p) => p.value === position)?.label}</button></>
              : 'Or drag the watermark in the preview to put it exactly where you want.'}
        </p>
        <RangeSlider label="Rotation" value={angle} min={-90} max={90} onChange={setAngle} suffix="°" />
        <RangeSlider label="Opacity" value={opacity} min={5} max={100} onChange={setOpacity} suffix=" %" />
      </section>

      {!isImageSrc && (
        <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Apply to</h3>
          <Segmented options={[{ value: 'all', label: 'All pages' }, { value: 'range', label: 'Page range' }]} value={scope} onChange={setScope} />
          {scope === 'range' && (
            <input
              type="text"
              value={rangeText}
              onChange={(e) => setRangeText(e.target.value)}
              placeholder="e.g. 1, 3-5"
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          )}
          <p className="text-[11px] text-gray-400 dark:text-gray-500">{targetPages.length} page{targetPages.length === 1 ? '' : 's'} will get the watermark.</p>
        </section>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={apply}
      disabled={!ready || busy || loading}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Adding watermark…' : isImageSrc ? 'Watermark photo' : `Watermark ${targetPages.length} page${targetPages.length === 1 ? '' : 's'}`}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Watermark added"
      workingLabel="Stamping the watermark…"
      subtitle={result ? (isImageSrc ? formatBytes(result.size) : `${result.count} page${result.count > 1 ? 's' : ''} · ${formatBytes(result.size)}`) : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to options"
      extra={result ? (
        isImageSrc
          ? <OpenInTool getImage={() => result.blob} exclude={['watermark-pdf']} />
          : <OpenInPdfTool getPdf={() => result.blob} exclude={['watermark-pdf']} />
      ) : null}
    />
  ) : null;

  // step sizes shared by the bake and the preview so density matches
  const tileStep = () => {
    if (mode === 'text') {
      const approxTw = text.length * size * 0.58; // rough bold-text width
      return { x: Math.max(140, approxTw * 0.9 + 60), y: Math.max(110, size * 2.4) };
    }
    const w = imgSrc && imgDims ? (imgScale / 100) : 0.4;
    return { x: w + 0.07, y: w * (imgDims ? imgDims.h / imgDims.w : 0.6) + 0.07 };
  };

  /* ---- preview overlay ---- */
  const overlay = () => {
    if (!preview) return null;
    const tiles = position === 'tile';
    let rows = 1;
    let cols = 1;
    if (tiles) {
      const s = tileStep();
      if (mode === 'text') {
        cols = Math.max(1, Math.min(6, Math.round(preview.wPt / s.x)));
        rows = Math.max(1, Math.min(9, Math.round(preview.hPt / s.y)));
      } else {
        cols = Math.max(1, Math.min(6, Math.round(1 / s.x)));
        rows = Math.max(1, Math.min(9, Math.round((preview.hPt / preview.wPt) / s.y)));
      }
    }
    const cells = [];
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < cols; c += 1) {
        const topPct = tiles ? ((r + 0.5) / rows) * 100 : (customPos ? customPos.y : (position === 'top' ? 15 : position === 'bottom' ? 85 : 50));
        const leftPct = tiles ? ((c + 0.5) / cols) * 100 : (customPos ? customPos.x : 50);
        cells.push(
          <div
            key={`${r}-${c}`}
            onPointerDown={tiles ? undefined : startDrag}
            className={`absolute ${tiles ? '' : 'touch-none select-none cursor-grab active:cursor-grabbing'}`}
            style={{
              top: `${topPct}%`, left: `${leftPct}%`,
              transform: `translate(-50%,-50%) rotate(${-angle}deg)`,
              opacity: opacity / 100,
            }}
          >
            {mode === 'text' ? (
              <span
                className="font-bold whitespace-nowrap"
                style={{ fontFamily: font.css, color, fontSize: `calc(${size} / ${preview.wPt} * 100cqw)`, lineHeight: 1 }}
              >
                {text || 'WATERMARK'}
              </span>
            ) : imgSrc ? (
              <img src={imgSrc} alt="" draggable={false} style={{ width: `calc(${imgScale} / 100 * 100cqw)`, maxWidth: 'none' }} />
            ) : null}
          </div>,
        );
      }
    }
    return cells;
  };

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
      formats="PDF, or a JPG / PNG / WebP photo — text or logo watermark on top"
      dropTitle="Drop a PDF or photo to watermark"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">Preview</p>
        {!isImageSrc && pageCount > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => gotoPage(previewIdx - 1)} disabled={previewIdx <= 1} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">‹</button>
            <span className="text-gray-500 dark:text-gray-400">{previewIdx} / {pageCount}</span>
            <button type="button" onClick={() => gotoPage(previewIdx + 1)} disabled={previewIdx >= pageCount} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">›</button>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-gray-100 dark:bg-gray-900/40 p-2 sm:p-3 flex items-center justify-center min-h-[240px]">
        {loading && !preview ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            {isImageSrc ? 'Reading image…' : 'Reading PDF…'}
          </div>
        ) : preview ? (
          <div
            ref={previewBoxRef}
            onPointerMove={onDragMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="relative shadow-lg ring-1 ring-black/10 bg-white overflow-hidden"
            style={{
              aspectRatio: `${preview.wPt} / ${preview.hPt}`,
              width: '100%',
              maxWidth: 760,
              containerType: 'inline-size',
            }}
          >
            <img src={preview.url} alt={isImageSrc ? file.name : `Page ${previewIdx}`} className="block h-full w-full" draggable={false} />
            {overlay()}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Tip: drag the watermark straight in the preview to put it anywhere — corner, edge, wherever. A light grey{' '}
        <span className="font-medium">CONFIDENTIAL</span> at ~45° and 25% opacity is the classic look. Use “Tiled” for a
        repeating background, or an image for a company logo — works the same on a PDF or a photo.
      </p>
    </ToolWorkspace>
  );
};

export default WatermarkPDF;

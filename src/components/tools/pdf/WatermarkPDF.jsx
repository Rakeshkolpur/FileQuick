import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';
import { parsePageRange } from '../../../lib/pageRange';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const RAD = Math.PI / 180;

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

const WatermarkPDF = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(1);
  const [preview, setPreview] = useState(null); // { url, wPt, hPt }

  const [mode, setMode] = useState('text'); // text | image
  const [text, setText] = useState('CONFIDENTIAL');
  const [fontKey, setFontKey] = useState('Helvetica');
  const [size, setSize] = useState(60);
  const [color, setColor] = useState('#6b7280');
  const [imgSrc, setImgSrc] = useState(null);
  const [imgDims, setImgDims] = useState(null); // {w,h}
  const [imgScale, setImgScale] = useState(40); // % of page width

  const [opacity, setOpacity] = useState(25);
  const [angle, setAngle] = useState(45);
  const [position, setPosition] = useState('center');
  const [scope, setScope] = useState('all');
  const [rangeText, setRangeText] = useState('');

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const tok = useRef(0);
  useEffect(() => { setResult(null); }, [mode, text, fontKey, size, color, imgSrc, imgScale, opacity, angle, position, scope, rangeText]);

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

  const onFiles = useCallback(async (list) => {
    const f = [...list].find(isPdf);
    if (!f) { setError('Please choose a PDF file.'); return; }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const ab = await f.arrayBuffer();
      const doc = await openPdf(ab);
      setFile(f); setBytes(ab); setPdf(doc);
      setPageCount(doc.numPages);
      setPreviewIdx(1);
      await loadPreview(doc, 1);
    } catch (e) {
      setError(
        e?.message?.toLowerCase().includes('password')
          ? 'That PDF is password-protected. Unlock it first.'
          : 'Could not read that PDF — it may be damaged.',
      );
    } finally {
      setLoading(false);
    }
  }, [loadPreview]);

  const reset = () => {
    tok.current += 1;
    setFile(null); setBytes(null); setPdf(null); setPageCount(0);
    setPreview(null); setResult(null); setError(null);
  };
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
  const ready = pdf && targetPages.length && (mode === 'text' ? text.trim() : imgSrc);

  const apply = async () => {
    if (!ready) { setError(mode === 'text' ? 'Type the watermark text.' : 'Choose an image.'); return; }
    setBusy(true);
    setError(null);
    try {
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

        if (position === 'tile') {
          const stepX = mode === 'text' ? Math.max(140, f.widthOfTextAtSize(text, size) * 0.9 + 60) : (imgScale / 100) * W + 40;
          const stepY = mode === 'text' ? Math.max(110, size * 2.4) : ((imgScale / 100) * W) * (imgDims.h / imgDims.w) + 40;
          for (let gy = stepY / 2; gy < H + stepY; gy += stepY) {
            for (let gx = stepX / 2; gx < W + stepX; gx += stepX) stampAt(gx, gy);
          }
        } else {
          const cy = position === 'top' ? H * 0.85 : position === 'bottom' ? H * 0.15 : H / 2;
          stampAt(W / 2, cy);
        }
      });

      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, count: targetPages.length });
    } catch (e) {
      setError(`Could not add the watermark: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-watermarked.pdf`;
  const btn = 'flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors';

  const sidebar = (
    <>
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">{file?.name || 'PDF'}</h3>
          <button type="button" onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0">Start over</button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500">{formatBytes(file?.size)} · {pageCount} page{pageCount === 1 ? '' : 's'}</p>
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
                <RangeSlider label="Logo width" value={imgScale} min={10} max={90} onChange={setImgScale} suffix=" % of page" />
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
        <Segmented options={POSITIONS} value={position} onChange={setPosition} />
        <RangeSlider label="Rotation" value={angle} min={-90} max={90} onChange={setAngle} suffix="°" />
        <RangeSlider label="Opacity" value={opacity} min={5} max={100} onChange={setOpacity} suffix=" %" />
      </section>

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
      {busy ? 'Adding watermark…' : `Watermark ${targetPages.length} page${targetPages.length === 1 ? '' : 's'}`}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Watermark added"
      workingLabel="Stamping the watermark…"
      subtitle={result ? `${result.count} page${result.count > 1 ? 's' : ''} · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to options"
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
        const topPct = tiles ? ((r + 0.5) / rows) * 100 : (position === 'top' ? 15 : position === 'bottom' ? 85 : 50);
        const leftPct = tiles ? ((c + 0.5) / cols) * 100 : 50;
        cells.push(
          <div
            key={`${r}-${c}`}
            className="absolute"
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
              <img src={imgSrc} alt="" style={{ width: `calc(${imgScale} / 100 * 100cqw)`, maxWidth: 'none' }} />
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
      accept="application/pdf,.pdf"
      formats="PDF — text or logo watermark on top of every page"
      dropTitle="Drop a PDF to watermark"
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
        {pageCount > 1 && (
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
            Reading PDF…
          </div>
        ) : preview ? (
          <div
            className="relative shadow-lg ring-1 ring-black/10 bg-white overflow-hidden"
            style={{
              aspectRatio: `${preview.wPt} / ${preview.hPt}`,
              width: '100%',
              maxWidth: 760,
              containerType: 'inline-size',
            }}
          >
            <img src={preview.url} alt={`Page ${previewIdx}`} className="block h-full w-full" />
            {overlay()}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Tip: a light grey <span className="font-medium">CONFIDENTIAL</span> at ~45° and 25% opacity is the classic look. Use
        “Tiled” for a repeating background, or an image for a company logo.
      </p>
    </ToolWorkspace>
  );
};

export default WatermarkPDF;

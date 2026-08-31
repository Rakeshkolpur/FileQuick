import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import ToolWorkspace from '../../tool/ToolWorkspace';
import Segmented from '../../tool/Segmented';
import RangeSlider from '../../tool/RangeSlider';
import { downloadBlob } from '../../tool/DownloadButton';
import ResultScreen from '../../tool/ResultScreen';
import { formatBytes, stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';

const isPdf = (f) => f && (f.type === 'application/pdf' || f.name?.toLowerCase().endsWith('.pdf'));
const MM = 2.83465; // pt per mm

const POSITIONS = [
  ['top-left', 'top-center', 'top-right'],
  ['mid-left', 'mid-center', 'mid-right'],
  ['bottom-left', 'bottom-center', 'bottom-right'],
];
const FORMATS = [
  { value: '{n}', label: '1' },
  { value: '{n} / {total}', label: '1 / 10' },
  { value: 'Page {n}', label: 'Page 1' },
  { value: 'Page {n} of {total}', label: 'Page 1 of 10' },
  { value: '– {n} –', label: '– 1 –' },
  { value: 'custom', label: 'Custom' },
];
const FONTS = [
  { value: 'Helvetica', label: 'Sans', std: StandardFonts.Helvetica, css: 'ui-sans-serif, system-ui, sans-serif' },
  { value: 'Times', label: 'Serif', std: StandardFonts.TimesRoman, css: 'Georgia, "Times New Roman", serif' },
  { value: 'Courier', label: 'Mono', std: StandardFonts.Courier, css: 'ui-monospace, "Courier New", monospace' },
];
const COLORS = [
  { name: 'Black', hex: '#111827' },
  { name: 'Grey', hex: '#6b7280' },
  { name: 'Blue', hex: '#1d4ed8' },
  { name: 'Red', hex: '#b91c1c' },
];
const hexRgb = (h) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

const PageNumbers = () => {
  const [file, setFile] = useState(null);
  const [bytes, setBytes] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [pageCount, setPageCount] = useState(0);
  const [previewIdx, setPreviewIdx] = useState(1);
  const [preview, setPreview] = useState(null); // { url, wPt, hPt }

  const [position, setPosition] = useState('bottom-center');
  const [fmt, setFmt] = useState('{n}');
  const [customTpl, setCustomTpl] = useState('{n} of {total}');
  const [startAt, setStartAt] = useState(1);
  const [fromPage, setFromPage] = useState(1);
  const [fontKey, setFontKey] = useState('Helvetica');
  const [size, setSize] = useState(11);
  const [color, setColor] = useState('#111827');
  const [marginMm, setMarginMm] = useState(12);

  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const tok = useRef(0);
  useEffect(() => { setResult(null); }, [position, fmt, customTpl, startAt, fromPage, fontKey, size, color, marginMm]);

  const template = fmt === 'custom' ? customTpl : fmt;
  const font = FONTS.find((f) => f.value === fontKey) || FONTS[0];

  // pages that get a number, and the number each shows
  const numbering = useMemo(() => {
    const map = {};
    let shown = startAt;
    let last = startAt;
    for (let p = Math.max(1, fromPage); p <= pageCount; p += 1) {
      map[p] = shown;
      last = shown;
      shown += 1;
    }
    return { map, total: last };
  }, [fromPage, startAt, pageCount]);

  const labelFor = (n) => template.replace(/\{n\}/g, String(n)).replace(/\{total\}/g, String(numbering.total));
  const previewLabel = numbering.map[previewIdx] != null ? labelFor(numbering.map[previewIdx]) : null;

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

  // fraction position of the label's anchor for the on-screen overlay
  const overlayStyle = (wPt, hPt) => {
    const [v, h] = position.split('-');
    const mx = (marginMm * MM) / wPt;
    const my = (marginMm * MM) / hPt;
    const s = { position: 'absolute' };
    if (h === 'left') { s.left = `${mx * 100}%`; s.textAlign = 'left'; }
    else if (h === 'right') { s.right = `${mx * 100}%`; s.textAlign = 'right'; }
    else { s.left = '50%'; s.transform = 'translateX(-50%)'; s.textAlign = 'center'; }
    if (v === 'top') s.top = `${my * 100}%`;
    else if (v === 'bottom') s.bottom = `${my * 100}%`;
    else { s.top = '50%'; s.transform = `${s.transform || ''} translateY(-50%)`.trim(); }
    return s;
  };

  const apply = async () => {
    if (!Object.keys(numbering.map).length) { setError('No pages to number — check the “from page” value.'); return; }
    setBusy(true);
    setError(null);
    try {
      const doc = await PDFDocument.load(bytes);
      const f = await doc.embedFont(font.std);
      const m = marginMm * MM;
      const [vpos, hpos] = position.split('-');
      doc.getPages().forEach((page, i) => {
        const num = numbering.map[i + 1];
        if (num == null) return;
        const label = labelFor(num);
        const { width: W, height: H } = page.getSize();
        const tw = f.widthOfTextAtSize(label, size);
        let x;
        if (hpos === 'left') x = m;
        else if (hpos === 'right') x = W - m - tw;
        else x = (W - tw) / 2;
        let y;
        if (vpos === 'top') y = H - m - size;
        else if (vpos === 'bottom') y = m;
        else y = (H - size) / 2;
        page.drawText(label, { x, y, size, font: f, color: hexRgb(color) });
      });
      const outBytes = await doc.save();
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setResult({ blob, size: blob.size, count: Object.keys(numbering.map).length });
    } catch (e) {
      setError(`Could not add page numbers: ${e.message}`);
    } finally {
      setBusy(false);
    }
  };

  const outName = `${stripExt(file?.name || 'document')}-numbered.pdf`;
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
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Position</h3>
        <div className="grid grid-cols-3 gap-1.5 w-28">
          {POSITIONS.flat().map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPosition(p)}
              className={`h-8 rounded-md border ${position === p ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40' : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'}`}
              title={p.replace('-', ' ')}
            >
              <span className={`block h-1.5 w-1.5 rounded-full mx-auto ${position === p ? 'bg-purple-600' : 'bg-gray-300 dark:bg-gray-500'}`} />
            </button>
          ))}
        </div>
        <RangeSlider label="Margin from edge" value={marginMm} min={2} max={30} onChange={setMarginMm} suffix=" mm" />
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Format</h3>
        <div className="grid grid-cols-2 gap-1.5">
          {FORMATS.map((o) => (
            <button key={o.value} type="button" onClick={() => setFmt(o.value)} className={`${btn} ${fmt === o.value ? '!bg-purple-100 dark:!bg-purple-900/40 !text-purple-700 dark:!text-purple-300 ring-1 ring-purple-400' : ''}`}>
              {o.label}
            </button>
          ))}
        </div>
        {fmt === 'custom' && (
          <>
            <input
              type="text"
              value={customTpl}
              onChange={(e) => setCustomTpl(e.target.value)}
              placeholder="{n} of {total}"
              className="w-full p-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500">Use <code>{'{n}'}</code> for the number and <code>{'{total}'}</code> for the last number.</p>
          </>
        )}
      </section>

      <section className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          Start counting at
          <input type="number" min="0" value={startAt} onChange={(e) => setStartAt(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="mt-1 w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </label>
        <label className="text-xs font-medium text-gray-600 dark:text-gray-300">
          First page to number
          <input type="number" min="1" max={pageCount || 1} value={fromPage} onChange={(e) => setFromPage(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="mt-1 w-full p-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
        </label>
      </section>

      <section className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Style</h3>
        <Segmented options={FONTS.map((f) => ({ value: f.value, label: f.label }))} value={fontKey} onChange={setFontKey} />
        <RangeSlider label="Text size" value={size} min={7} max={28} onChange={setSize} suffix=" pt" />
        <div className="flex gap-2 pt-1">
          {COLORS.map((c) => (
            <button key={c.hex} type="button" title={c.name} onClick={() => setColor(c.hex)}
              className={`h-6 w-6 rounded-full border-2 ${color === c.hex ? 'border-purple-500' : 'border-gray-200 dark:border-gray-600'}`} style={{ backgroundColor: c.hex }} />
          ))}
        </div>
      </section>

      {error && <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}
    </>
  );

  const footer = (
    <button
      type="button"
      onClick={apply}
      disabled={!pdf || busy || loading || !Object.keys(numbering.map).length}
      className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
    >
      {busy ? 'Numbering…' : `Number ${Object.keys(numbering.map).length} page${Object.keys(numbering.map).length === 1 ? '' : 's'}`}
    </button>
  );

  const resultView = (busy || result) ? (
    <ResultScreen
      working={busy}
      done={!!result}
      title="Page numbers added"
      workingLabel="Adding page numbers…"
      subtitle={result ? `${result.count} page${result.count > 1 ? 's' : ''} numbered · ${formatBytes(result.size)}` : undefined}
      fileName={outName}
      fileSize={result?.size}
      onDownload={() => downloadBlob(result.blob, outName)}
      onBack={backFromResult}
      backLabel="Back to options"
    />
  ) : null;

  return (
    <ToolWorkspace
      file={file}
      accept="application/pdf,.pdf"
      formats="PDF — page numbers stamped on top"
      dropTitle="Drop a PDF to number"
      dropHint="or click to browse"
      paste={false}
      onFiles={onFiles}
      onBack={(busy || result) ? backFromResult : reset}
      sidebar={sidebar}
      footer={footer}
      result={resultView}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          Preview — page {previewIdx}{previewLabel ? ` shows “${previewLabel}”` : ' (not numbered)'}
        </p>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 text-sm">
            <button type="button" onClick={() => gotoPage(previewIdx - 1)} disabled={previewIdx <= 1} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">‹</button>
            <span className="text-gray-500 dark:text-gray-400">{previewIdx} / {pageCount}</span>
            <button type="button" onClick={() => gotoPage(previewIdx + 1)} disabled={previewIdx >= pageCount} className="h-7 w-7 grid place-items-center rounded-lg bg-gray-100 dark:bg-gray-700 disabled:opacity-40">›</button>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-gray-100 dark:bg-gray-900/40 p-3 sm:p-4 flex items-center justify-center min-h-[240px]">
        {loading && !preview ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <div className="h-9 w-9 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Reading PDF…
          </div>
        ) : preview ? (
          <div
            className="relative shadow-lg ring-1 ring-black/10 bg-white"
            style={{ aspectRatio: `${preview.wPt} / ${preview.hPt}`, width: '100%', maxWidth: 760, containerType: 'inline-size' }}
          >
            <img src={preview.url} alt={`Page ${previewIdx}`} className="block h-full w-full" />
            {previewLabel && (
              <span
                style={{
                  ...overlayStyle(preview.wPt, preview.hPt),
                  fontFamily: font.css,
                  fontSize: `calc(${size} / ${preview.wPt} * 100cqw)`,
                  color,
                  lineHeight: 1,
                  whiteSpace: 'nowrap',
                }}
              >
                {previewLabel}
              </span>
            )}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
        Automated default: <span className="font-medium">1</span> at bottom-centre. Change the position, format, start number,
        font, size and colour on the left — the preview updates live.
      </p>
    </ToolWorkspace>
  );
};

export default PageNumbers;

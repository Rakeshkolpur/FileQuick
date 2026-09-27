import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import {
  LuTrash2, LuZoomIn, LuZoomOut, LuRotateCcw, LuRotateCw, LuPlusCircle, LuPlus,
} from 'react-icons/lu';
import { groupLines } from '../../../../lib/pdfTextEdit';
import EditBlock from './EditBlock';
import ObjectItem from './ObjectItem';
import {
  rotatedBox, frameTransform, toFrame, norm, rectFrom, penPath,
} from './geometry';
import { DRAG_TOOLS } from './records';

const toHex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Text colour + background colour of a line, read off the rendered page:
 * the most common colour on the rim around the line is the background; the
 * pixels furthest from it are the ink.
 */
function sampleColors(ctx, x, y, w, h) {
  const X = Math.max(0, Math.floor(x));
  const Y = Math.max(0, Math.floor(y));
  const W = Math.max(1, Math.min(ctx.canvas.width - X, Math.ceil(w)));
  const H = Math.max(1, Math.min(ctx.canvas.height - Y, Math.ceil(h)));
  let data;
  try { data = ctx.getImageData(X, Y, W, H).data; } catch { return { color: '#000000', bg: '#ffffff' }; }

  const counts = new Map();
  for (let yy = 0; yy < H; yy += 1) {
    for (let xx = 0; xx < W; xx += 1) {
      if (yy > 1 && yy < H - 2 && xx > 1 && xx < W - 2) continue; // rim only
      const i = (yy * W + xx) * 4;
      const k = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const c = counts.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      c.n += 1; c.r += data[i]; c.g += data[i + 1]; c.b += data[i + 2];
      counts.set(k, c);
    }
  }
  let best = null;
  counts.forEach((c) => { if (!best || c.n > best.n) best = c; });
  const bg = best ? [best.r / best.n, best.g / best.n, best.b / best.n] : [255, 255, 255];

  const dist = (i) => Math.hypot(data[i] - bg[0], data[i + 1] - bg[1], data[i + 2] - bg[2]);
  let max = 0;
  for (let i = 0; i < data.length; i += 4) max = Math.max(max, dist(i));
  let ink = [0, 0, 0];
  if (max > 40) {
    let n = 0; let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (dist(i) >= max * 0.8) { r += data[i]; g += data[i + 1]; b += data[i + 2]; n += 1; }
    }
    if (n) ink = [r / n, g / n, b / n];
  }
  return { color: toHex(...ink), bg: toHex(...bg) };
}

const RowBtn = ({ title, onClick, children, disabled }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
    className="grid h-7 w-7 place-items-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-blue-600 disabled:pointer-events-none disabled:opacity-30 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-blue-300"
  >
    {children}
  </button>
);

const PILL = 'flex items-center rounded-full bg-white/90 p-0.5 shadow-sm ring-1 ring-black/5 backdrop-blur dark:bg-gray-800/90 dark:ring-white/10';

/** Slim row above each page: number · delete · zoom · rotate · insert. */
export const PageRow = ({ number, onAction, onInsert, canDelete }) => (
  <div data-fq-keep="" className="mb-2 flex flex-wrap items-center justify-center gap-2">
    <span className={`${PILL} px-2.5 py-1 text-xs font-semibold tabular-nums text-gray-500 dark:text-gray-300`}>{`Page ${number}`}</span>
    <div className={PILL}>
      <RowBtn title="Zoom out" onClick={() => onAction('zoomOut')}><LuZoomOut className="h-3.5 w-3.5" /></RowBtn>
      <RowBtn title="Zoom in" onClick={() => onAction('zoomIn')}><LuZoomIn className="h-3.5 w-3.5" /></RowBtn>
      <span className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />
      <RowBtn title="Rotate left" onClick={() => onAction('rotL')}><LuRotateCcw className="h-3.5 w-3.5" /></RowBtn>
      <RowBtn title="Rotate right" onClick={() => onAction('rotR')}><LuRotateCw className="h-3.5 w-3.5" /></RowBtn>
      <span className="mx-0.5 h-4 w-px bg-gray-200 dark:bg-gray-700" />
      <RowBtn title="Delete page" onClick={() => onAction('delete')} disabled={!canDelete}><LuTrash2 className="h-3.5 w-3.5" /></RowBtn>
    </div>
    <InsertButton onClick={onInsert} />
  </div>
);

export const InsertButton = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    title="Insert a blank page here"
    className={`${PILL} h-8 gap-1 px-3 text-xs font-medium text-gray-500 transition-colors hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-300`}
  >
    <LuPlusCircle className="h-3.5 w-3.5" /> Insert page
  </button>
);

const PageView = ({
  pdfjs, slot, scale, number, canDelete, tool, defaults, records, objects, activeId, selectedId,
  fontCssFor, onActivateLine, onActivateRec, onText, onKey, registerEl, onAddText,
  onCreate, onSelect, onChangeObj, onBeginEdit, onBackground, onAction, onInsert,
  onMoveRec, onBeginMoveRec, onMargins, tables = [], onAttachTable, tableProps,
}) => {
  const outerRef = useRef(null);
  const canvasRef = useRef(null);
  const drag = useRef(null);
  const [visible, setVisible] = useState(number <= 2);
  const [lines, setLines] = useState(slot.kind === 'blank' ? [] : null);
  const [preview, setPreview] = useState(null);
  const [hoverTable, setHoverTable] = useState(null);

  const view = slot.view;
  const R = norm((slot.rotate0 || 0) + (slot.extra || 0));
  const W = slot.w * scale;
  const H = slot.h * scale;
  const box = rotatedBox(W, H, R);

  useEffect(() => {
    const el = outerRef.current;
    if (!el || visible) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '900px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // The page's text margins (where its lines start / end) — used to snap
  // dragged text and by the Left / Right alignment buttons.
  const margins = useMemo(() => {
    const fallback = { left: view[0] + 72, right: view[2] - 72 };
    const ls = (lines || []).filter((l) => l.x1 - l.x0 > (view[2] - view[0]) * 0.3);
    if (!ls.length) return fallback;
    return { left: Math.min(...ls.map((l) => l.x0)), right: Math.max(...ls.map((l) => l.x1)) };
  }, [lines, view]);
  useEffect(() => { onMargins(slot.key, margins); }, [onMargins, slot.key, margins]);

  // Render the page (always unrotated — rotation is applied to the frame).
  useEffect(() => {
    if (!visible || slot.kind !== 'orig') return undefined;
    let cancelled = false;
    let task = null;
    (async () => {
      const p = await pdfjs.getPage(slot.index + 1);
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const vp = p.getViewport({ scale: scale * dpr, rotation: 0 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      task = p.render({ canvasContext: ctx, viewport: vp });
      await task.promise;
      if (cancelled) return;

      const tc = await p.getTextContent();
      // table cell borders keep cells apart (S.No | Date | Description …)
      const walls = tables.flatMap((t) => t.xs.map((x) => ({ x, y0: t.bottom, y1: t.top })));
      const ls = groupLines(tc.items, slot.index, walls);
      const meta = {};
      ls.forEach((l) => {
        l.slot = slot.key;
        if (!(l.fontName in meta)) {
          let o = null;
          try { if (p.commonObjs.has(l.fontName)) o = p.commonObjs.get(l.fontName); } catch { o = null; }
          meta[l.fontName] = o ? {
            name: o.name, bold: o.bold, italic: o.italic, black: o.black,
            isSerifFont: o.isSerifFont, isMonospace: o.isMonospace,
          } : {};
        }
        l.meta = meta[l.fontName];
        const s = scale * dpr;
        const x = (l.x0 - view[0]) * s;
        const top = (view[3] - l.y - l.size * 0.95) * s;
        Object.assign(l, sampleColors(ctx, x - 3, top - 3, (l.x1 - l.x0) * s + 6, l.size * 1.27 * s + 6));
      });
      if (!cancelled) setLines(ls);
    })().catch(() => { if (!cancelled) setLines([]); });
    return () => {
      cancelled = true;
      try { task?.cancel(); } catch { /* done */ }
    };
  }, [visible, scale, pdfjs, slot.kind, slot.index, slot.key, view, tables]);

  /* ---- pointer: create objects / add text ---- */
  const framePt = (e) => {
    const r = outerRef.current.getBoundingClientRect();
    const f = toFrame(e.clientX - r.left, e.clientY - r.top, W, H, R);
    return { x: f.x / scale, y: f.y / scale };
  };

  const onDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('[data-fq-keep]')) return;
    const hadFocus = onBackground();
    const p = framePt(e);
    if (tool === 'text') {
      e.preventDefault();
      // first click away from a line just finishes it; the next one adds text
      if (hadFocus) return;
      // new text goes on a baseline a little below the click point
      const size = defaults.text.size;
      onAddText(slot.key, view[0] + p.x, view[3] - p.y - size * 0.35, { x: e.clientX, y: e.clientY });
      return;
    }
    if (!DRAG_TOOLS.has(tool) && tool !== 'pen') return;
    e.preventDefault();
    try { outerRef.current.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    drag.current = { start: p, points: [[p.x, p.y]] };
    setPreview(tool === 'pen' ? { pen: [[p.x, p.y]] } : { ...rectFrom(p, p) });
  };

  const onMove = (e) => {
    const d = drag.current;
    if (!d) {
      if (!tables.length) return;
      const q = framePt(e);
      const t = tables.find((tb) => q.x >= tb.x0 - view[0] - 10 && q.x <= tb.x1 - view[0] + 26
        && q.y >= view[3] - tb.top - 10 && q.y <= view[3] - tb.bottom + 26);
      const key = t ? t.key : null;
      if (key !== hoverTable) setHoverTable(key);
      return;
    }
    const p = framePt(e);
    if (tool === 'pen') {
      d.points.push([p.x, p.y]);
      setPreview({ pen: [...d.points] });
    } else {
      d.end = p;
      setPreview({ ...rectFrom(d.start, p), dir: (p.x - d.start.x) * (p.y - d.start.y) < 0 ? 'up' : 'down' });
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    setPreview(null);
    if (!d) return;
    const st = defaults[tool] || {};
    if (tool === 'pen') {
      if (d.points.length < 2) return;
      const xs = d.points.map((q) => q[0]);
      const ys = d.points.map((q) => q[1]);
      const x0 = Math.min(...xs); const y0 = Math.min(...ys);
      const w = Math.max(1, Math.max(...xs) - x0);
      const h = Math.max(1, Math.max(...ys) - y0);
      onCreate(slot.key, {
        type: 'pen', x: x0, y: y0, w, h, pw: w, ph: h,
        points: d.points.map(([x, y]) => [x - x0, y - y0]), color: st.color, width: st.width,
      });
      return;
    }
    const end = d.end || d.start;
    let r = rectFrom(d.start, end);
    const tiny = r.w < 3 && r.h < 3;
    if (tool === 'field-check') r = tiny ? { x: d.start.x, y: d.start.y, w: 14, h: 14 } : { ...r, h: r.w };
    else if (tool === 'field-text' && tiny) r = { x: d.start.x, y: d.start.y, w: 150, h: 22 };
    else if (tool === 'link' && tiny) r = { x: d.start.x, y: d.start.y - 8, w: 120, h: 16 };
    else if (tool === 'table' && tiny) r = { x: d.start.x, y: d.start.y, w: 0, h: 0 };
    else if (tiny) return;
    if ((tool === 'underline' || tool === 'strike') && r.h < 8) r = { ...r, y: r.y - (8 - r.h) / 2, h: 8 };
    const dir = (end.x - d.start.x) * (end.y - d.start.y) < 0 ? 'up' : 'down';
    onCreate(slot.key, { type: tool, ...r, dir, ...st });
  };

  const drawCursor = tool === 'text' ? 'text' : (DRAG_TOOLS.has(tool) || tool === 'pen') ? 'crosshair' : 'default';

  return (
    <div data-slot={slot.key} className="mx-auto" style={{ width: Math.max(box.w, 320) }}>
      <PageRow number={number} onAction={(a) => onAction(slot.key, a)} onInsert={() => onInsert(slot.key)} canDelete={canDelete} />
      <div
        ref={outerRef}
        data-fq-page=""
        className="relative mx-auto bg-white shadow-md ring-1 ring-black/10"
        style={{ width: box.w, height: box.h, cursor: drawCursor, touchAction: (DRAG_TOOLS.has(tool) || tool === 'pen') ? 'none' : 'auto' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => { if (hoverTable) setHoverTable(null); }}
      >
        <div className="absolute left-0 top-0" style={{ width: W, height: H, transform: frameTransform(W, H, R), transformOrigin: '0 0' }}>
          {slot.kind === 'orig' && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}

          {visible && !lines && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
            </div>
          )}

          {tool === 'text' && lines && lines.map((l) => (records.some((r) => r.id === l.id) ? null : (
            <div
              key={l.id}
              data-fq-keep=""
              title="Click to edit"
              className="absolute cursor-text rounded-[2px] hover:bg-blue-500/10 hover:outline hover:outline-1 hover:outline-blue-500/70"
              style={{
                left: (l.x0 - view[0]) * scale - 1,
                top: (view[3] - l.y - l.size * 0.95) * scale - 1,
                width: (l.x1 - l.x0) * scale + 2,
                height: l.size * 1.27 * scale + 2,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                onActivateLine(l, { x: e.clientX, y: e.clientY });
              }}
            />
          )))}

          {objects.map((o) => (
            <ObjectItem
              key={o.id}
              obj={o}
              scale={scale}
              R={R}
              selected={selectedId === o.id}
              onSelect={onSelect}
              onChange={onChangeObj}
              onBeginEdit={onBeginEdit}
              table={o.type === 'table' ? { ...tableProps, fontCss: tableProps.fontCssFor(o) } : null}
            />
          ))}

          {/* existing PDF tables: + to continue them with a row / column */}
          {tables.map((t) => {
            if (t.key !== hoverTable) return null;
            const fx0 = t.x0 - view[0];
            const fx1 = t.x1 - view[0];
            const ftop = view[3] - t.top;
            const fbot = view[3] - t.bottom;
            const taken = new Set(objects.filter((o) => o.src && o.src.startsWith(`${t.key}:`)).map((o) => o.src));
            const sample = (lines || []).filter((l) => l.x0 >= t.x0 - 2 && l.x1 <= t.x1 + 2 && l.y <= t.top && l.y >= t.bottom)
              .sort((a, b) => b.text.length - a.text.length)[0] || null;
            const plus = (dir, left, top, title) => (taken.has(`${t.key}:${dir}`) ? null : (
              <button
                key={dir}
                type="button"
                data-fq-keep=""
                title={title}
                aria-label={title}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={(e) => { e.stopPropagation(); onAttachTable(slot.key, t, dir, sample); setHoverTable(null); }}
                className="absolute z-30 grid h-6 w-6 place-items-center rounded-full bg-blue-600 text-white shadow-lg ring-2 ring-white transition hover:scale-110 hover:bg-blue-700"
                style={{ left, top }}
              >
                <LuPlus className="h-4 w-4" />
              </button>
            ));
            return (
              <React.Fragment key={t.key}>
                <div
                  className="pointer-events-none absolute rounded-sm outline outline-2 outline-offset-2 outline-blue-400/60"
                  style={{
                    left: fx0 * scale, top: ftop * scale, width: (fx1 - fx0) * scale, height: (fbot - ftop) * scale,
                  }}
                />
                {plus('bottom', ((fx0 + fx1) / 2) * scale - 12, fbot * scale + 6, 'Add a row to this table')}
                {plus('right', fx1 * scale + 6, ((ftop + fbot) / 2) * scale - 12, 'Add a column to this table')}
              </React.Fragment>
            );
          })}

          {records.map((r) => (
            <EditBlock
              key={`${r.id}:${r.gen || 0}`}
              rec={r}
              scale={scale}
              view={view}
              R={R}
              margins={margins}
              active={activeId === r.id}
              fontCss={fontCssFor(r)}
              onText={onText}
              onKey={onKey}
              onActivate={onActivateRec}
              registerEl={registerEl}
              onMove={onMoveRec}
              onBeginMove={onBeginMoveRec}
            />
          ))}

          {preview && !preview.pen && (
            <div
              className="pointer-events-none absolute border border-dashed border-blue-600 bg-blue-500/10"
              style={{ left: preview.x * scale, top: preview.y * scale, width: preview.w * scale, height: preview.h * scale }}
            />
          )}
          {preview && preview.pen && (
            <svg className="pointer-events-none absolute inset-0 overflow-visible" width={W} height={H} viewBox={`0 0 ${slot.w} ${slot.h}`}>
              <path d={penPath(preview.pen)} fill="none" stroke={defaults.pen.color} strokeWidth={defaults.pen.width} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>

        {lines && lines.length === 0 && slot.kind === 'orig' && tool === 'text' && (
          <span className="pointer-events-none absolute left-2 top-2 rounded bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
            No editable text on this page (it looks like a scan) — click anywhere to add text.
          </span>
        )}
      </div>
    </div>
  );
};

export default PageView;

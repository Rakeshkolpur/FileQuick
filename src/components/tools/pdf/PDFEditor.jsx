import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import fabricPkg from 'fabric-pure-browser';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FileDropzone from '../../tool/FileDropzone';
import { ToolBackContext } from '../../ToolWrapper';
import { downloadBlob } from '../../tool/DownloadButton';
import { stripExt } from '../../../lib/format';
import { openPdf, renderPageToCanvas } from '../../../lib/pdfjs';
import { BASE_SCALE, bakeIntoPdf, parseColor, colorOpacity, FONT_LIST, cssStack } from '../../../lib/pdfAnnotate';

let lidSeq = 0;
const lidOf = (o) => o.__lid || (o.__lid = `L${++lidSeq}`);
const KIND_LABEL = {
  text: 'Text', rect: 'Rectangle', ellipse: 'Ellipse', line: 'Line', arrow: 'Arrow',
  highlight: 'Highlight', whiteout: 'Whiteout', image: 'Image', pen: 'Drawing', marker: 'Marker',
};
const kindLabel = (o) => KIND_LABEL[o.data?.kind]
  || ({ textbox: 'Text', 'i-text': 'Text', path: 'Drawing', group: 'Arrow', image: 'Image' }[o.type])
  || 'Shape';

const fabric = fabricPkg.fabric || fabricPkg;

// fabric v5 bug: on dispose it feeds a live CSSStyleDeclaration back through
// setStyle, whose numeric indices throw "Indexed property setter is not
// supported". Normalise CSSStyleDeclaration -> cssText string.
if (fabric?.util?.setStyle && !fabric.util.__stylePatched) {
  const orig = fabric.util.setStyle;
  fabric.util.setStyle = function patchedSetStyle(el, styles) {
    if (styles && typeof styles !== 'string' && typeof styles.cssText === 'string') {
      return orig.call(this, el, styles.cssText);
    }
    return orig.call(this, el, styles);
  };
  fabric.util.__stylePatched = true;
}

// Consistent, crisp selection chrome across every object.
if (fabric?.Object && !fabric.Object.prototype.__imrStyled) {
  Object.assign(fabric.Object.prototype, {
    borderColor: '#7c3aed',
    cornerColor: '#7c3aed',
    cornerStrokeColor: '#ffffff',
    cornerStyle: 'circle',
    cornerSize: 9,
    transparentCorners: false,
    borderScaleFactor: 1.5,
    strokeUniform: true,
    objectCaching: false,
    padding: 2,
    __imrStyled: true,
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const KEEP = ['data'];
const TEXT_TYPES = new Set(['textbox', 'i-text', 'text']);
const SWATCHES = ['#111827', '#ef4444', '#2563eb', '#16a34a', '#f59e0b', '#a855f7', '#ffffff'];

const hexToRgba = (hex, a) => {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/* ------------------------------------------------------------------ icons -- */
const I = ({ d, className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);
const ICONS = {
  select: 'M4 4l7 16 2-7 7-2z',
  text: 'M4 6h16M9 6v12m6-12v12M7 18h4m2 0h4',
  pen: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z',
  marker: 'M4 20h16M14 4l6 6-9 9H5v-6z',
  highlight: 'M4 14h16v5H4zM7 4h10v7H7z',
  rect: 'M4 5h16v14H4z',
  ellipse: 'M12 5c5 0 8 3 8 7s-3 7-8 7-8-3-8-7 3-7 8-7z',
  line: 'M5 19L19 5',
  arrow: 'M5 19L19 5M19 5h-7M19 5v7',
  whiteout: 'M4 4h16v16H4zM4 4l16 16',
  image: 'M4 5h16v14H4zM4 15l4-4 5 5M14 13l2-2 4 4',
  sign: 'M3 17c3 0 3-6 6-6s3 8 6 8 3-5 6-5M3 21h18',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  redo: 'M15 14l5-5-5-5M20 9H9a5 5 0 000 10h3',
  trash: 'M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3',
  zoomIn: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3M8 11h6',
  pages: 'M8 4h9a2 2 0 012 2v12a2 2 0 01-2 2H8a2 2 0 01-2-2V6a2 2 0 012-2zM4 8v10a2 2 0 002 2',
  toFront: 'M8 8h8v8H8zM4 4h8v3M17 12h3v8h-8v-3',
  forward: 'M12 4v10M8 8l4-4 4 4M5 20h14',
  backward: 'M12 20V10M8 16l4 4 4-4M5 4h14',
  toBack: 'M8 8h8v8H8zM12 4h8v8M4 12v8h8',
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
};

const TOOLS = [
  { id: 'select', label: 'Select' },
  { id: 'text', label: 'Text' },
  { id: 'pen', label: 'Draw' },
  { id: 'marker', label: 'Highlighter' },
  { id: 'highlight', label: 'Highlight box' },
  { id: 'rect', label: 'Rectangle' },
  { id: 'ellipse', label: 'Ellipse' },
  { id: 'line', label: 'Line' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'whiteout', label: 'Whiteout / cover' },
  { id: 'image', label: 'Image' },
  { id: 'sign', label: 'Signature' },
];

/* --------------------------------------------------- per-tool canvas wiring -- */
function configureTool(fc, tool, props, helpers) {
  const { color, width, fontSize, fontFamily, fill } = props;
  const isSelect = tool === 'select';
  fc.isDrawingMode = false;
  fc.selection = isSelect;
  fc.defaultCursor = isSelect ? 'default' : 'crosshair';
  fc.forEachObject((o) => {
    o.selectable = isSelect;
    o.evented = isSelect;
    if (o.hoverCursor === undefined) o.hoverCursor = isSelect ? 'move' : 'crosshair';
  });
  if (!isSelect) fc.discardActiveObject();
  fc.requestRenderAll();

  if (tool === 'pen' || tool === 'marker') {
    fc.isDrawingMode = true;
    const brush = new fabric.PencilBrush(fc);
    brush.color = tool === 'marker' ? hexToRgba(color, 0.4) : color;
    brush.width = tool === 'marker' ? Math.max(12, width * 5) : width;
    brush.strokeLineCap = 'round';
    fc.freeDrawingBrush = brush;
    const done = (e) => { if (e.path) e.path.data = { kind: tool }; helpers.pushHistory(); };
    fc.on('path:created', done);
    return () => fc.off('path:created', done);
  }

  if (tool === 'select' || tool === 'image' || tool === 'sign') return () => {};

  let draft = null;
  let start = null;

  const onDown = (opt) => {
    if (opt.target) return; // clicking an existing object: leave it to editing/select
    const active = fc.getActiveObject();
    if (active && active.isEditing) return; // first click just commits the current text
    const p = fc.getPointer(opt.e);
    start = p;
    if (tool === 'text') {
      const tb = new fabric.Textbox('', {
        left: p.x, top: p.y, width: 260, fontSize, fill: color,
        fontFamily: cssStack(fontFamily), data: { kind: 'text', font: fontFamily },
        editingBorderColor: '#7c3aed', lockRotation: true, splitByGrapheme: false,
      });
      tb.setControlsVisibility({ mtr: false, mt: false, mb: false });
      fc.add(tb);
      fc.bringToFront(tb);
      fc.setActiveObject(tb);
      // Enter editing synchronously so the very first keystroke is captured.
      tb.enterEditing();
      if (tb.hiddenTextarea) tb.hiddenTextarea.focus();
      fc.requestRenderAll();
      start = null;
      helpers.pushHistory();
      return;
    }
    const solidFill = tool === 'whiteout' ? '#ffffff'
      : tool === 'highlight' ? hexToRgba(color === '#111827' ? '#facc15' : color, 0.35)
        : fill ? color : 'transparent';
    const strokeCol = (tool === 'highlight' || tool === 'whiteout' || fill) ? 'transparent' : color;
    const strokeW = (tool === 'highlight' || tool === 'whiteout' || fill) ? 0 : width;

    if (tool === 'line' || tool === 'arrow') {
      draft = new fabric.Line([p.x, p.y, p.x, p.y], {
        stroke: color, strokeWidth: width, strokeLineCap: 'round',
        selectable: false, evented: false, data: { kind: tool },
      });
    } else if (tool === 'ellipse') {
      draft = new fabric.Ellipse({
        left: p.x, top: p.y, rx: 1, ry: 1, fill: solidFill,
        stroke: strokeCol, strokeWidth: strokeW, selectable: false, evented: false, data: { kind: 'ellipse' },
      });
    } else {
      draft = new fabric.Rect({
        left: p.x, top: p.y, width: 1, height: 1, fill: solidFill,
        stroke: strokeCol, strokeWidth: strokeW,
        selectable: false, evented: false, data: { kind: tool },
      });
    }
    if (draft) fc.add(draft);
  };

  const onMove = (opt) => {
    if (!draft || !start) return;
    const p = fc.getPointer(opt.e);
    if (tool === 'line' || tool === 'arrow') {
      draft.set({ x2: p.x, y2: p.y });
    } else if (tool === 'ellipse') {
      draft.set({
        left: Math.min(start.x, p.x), top: Math.min(start.y, p.y),
        rx: Math.abs(p.x - start.x) / 2, ry: Math.abs(p.y - start.y) / 2,
      });
    } else {
      draft.set({
        left: Math.min(start.x, p.x), top: Math.min(start.y, p.y),
        width: Math.abs(p.x - start.x), height: Math.abs(p.y - start.y),
      });
    }
    fc.requestRenderAll();
  };

  const onUp = () => {
    if (!draft) { start = null; return; }
    const d = draft;
    draft = null;
    start = null;
    const liney = tool === 'line' || tool === 'arrow';
    if (!liney && d.width < 4 && d.height < 4) { fc.remove(d); return; }

    if (tool === 'arrow') {
      const { x1, y1, x2, y2 } = d;
      fc.remove(d);
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = new fabric.Triangle({
        left: x2, top: y2, originX: 'center', originY: 'center',
        width: Math.max(12, width * 3.5), height: Math.max(12, width * 3.5),
        fill: color, angle: (ang * 180) / Math.PI + 90,
      });
      const shaft = new fabric.Line([x1, y1, x2, y2], { stroke: color, strokeWidth: width, strokeLineCap: 'round' });
      const grp = new fabric.Group([shaft, head], { data: { kind: 'arrow' } });
      fc.add(grp);
      fc.setActiveObject(grp);
    } else {
      d.set({ selectable: true, evented: true });
      d.setCoords();
      fc.setActiveObject(d);
    }
    fc.requestRenderAll();
    helpers.pushHistory();
    helpers.finishTool();
  };

  fc.on('mouse:down', onDown);
  fc.on('mouse:move', onMove);
  fc.on('mouse:up', onUp);
  return () => {
    fc.off('mouse:down', onDown);
    fc.off('mouse:move', onMove);
    fc.off('mouse:up', onUp);
  };
}

/* --------------------------------------------------------------- one page -- */
function PageCanvas({ pdf, index, size, zoom, hydrated, tool, toolProps, store, onActivate, onSelect, onFinishTool, onLayers, bumpHistory }) {
  const hostRef = useRef(null);
  const fcRef = useRef(null);
  const [bmp, setBmp] = useState(null);

  const dispW = Math.round(size.w * BASE_SCALE * zoom);
  const dispH = Math.round(size.h * BASE_SCALE * zoom);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const dpr = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1) + 1));
        const c = await renderPageToCanvas(pdf, index + 1, { scale: BASE_SCALE * dpr });
        if (!dead) setBmp(c.toDataURL('image/png'));
      } catch (_) { /* ignore */ }
    })();
    return () => { dead = true; };
  }, [pdf, index]);

  useEffect(() => {
    if (!hydrated || !hostRef.current) return undefined;
    const el = document.createElement('canvas');
    hostRef.current.appendChild(el);
    const fc = new fabric.Canvas(el, {
      width: dispW, height: dispH, preserveObjectStacking: true,
      selection: tool === 'select', enableRetinaScaling: true,
    });
    fc.setZoom(zoom);
    fcRef.current = fc;
    store.live[index] = fc;

    const saved = store.data[index];
    if (saved) fc.loadFromJSON(saved, () => { fc.setZoom(zoom); fc.renderAll(); });

    const persist = () => { store.data[index] = fc.toJSON(KEEP); onLayers(); };
    fc.on('object:added', persist);
    fc.on('object:modified', () => { persist(); bumpHistory(index); });
    fc.on('object:removed', () => { persist(); bumpHistory(index); });
    fc.on('mouse:down', () => onActivate(index));
    fc.on('text:editing:exited', (e) => {
      const t = e.target;
      // Only drop a text box the user left completely empty — never one with content.
      if (t && !String(t.text).trim()) {
        fc.remove(t);
      } else if (t) {
        t.set({ selectable: true, evented: true });
        fc.setActiveObject(t);
      }
      persist();
      bumpHistory(index);
      onFinishTool(index, fc.getActiveObject() || null);
    });
    const sel = () => onSelect(fc.getActiveObject() || null, index);
    fc.on('selection:created', sel);
    fc.on('selection:updated', sel);
    fc.on('selection:cleared', () => onSelect(null, index));

    return () => {
      store.data[index] = fc.toJSON(KEEP);
      delete store.live[index];
      fc.dispose();
      if (hostRef.current) hostRef.current.innerHTML = '';
      fcRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return;
    fc.setDimensions({ width: dispW, height: dispH });
    fc.setZoom(zoom);
    fc.requestRenderAll();
  }, [zoom, dispW, dispH]);

  useEffect(() => {
    const fc = fcRef.current;
    if (!fc) return undefined;
    return configureTool(fc, tool, toolProps, {
      pushHistory: () => bumpHistory(index),
      finishTool: () => { store.active = index; onFinishTool(index, fc.getActiveObject() || null); },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, toolProps, hydrated]);

  return (
    <div data-page={index} className="relative mx-auto bg-white shadow-lg ring-1 ring-black/10 shrink-0" style={{ width: dispW, height: dispH }}>
      {bmp
        ? <img src={bmp} alt={`Page ${index + 1}`} width={dispW} height={dispH} className="block select-none pointer-events-none" draggable={false} />
        : <div className="absolute inset-0 grid place-items-center"><div className="h-8 w-8 border-2 border-gray-200 border-t-purple-500 rounded-full animate-spin" /></div>}
      <div ref={hostRef} className="absolute inset-0" />
      {!hydrated && null}
      <span className="absolute -top-4 left-1 text-[10px] font-semibold text-gray-400">{index + 1}</span>
    </div>
  );
}

/* ------------------------------------------------------- signature modal --- */
function SignaturePad({ onDone, onClose }) {
  const hostRef = useRef(null);
  const fcRef = useRef(null);
  useEffect(() => {
    const el = document.createElement('canvas');
    hostRef.current.appendChild(el);
    const fc = new fabric.Canvas(el, { isDrawingMode: true, width: 460, height: 180, backgroundColor: '#fff', enableRetinaScaling: false });
    fc.freeDrawingBrush.width = 2.5;
    fc.freeDrawingBrush.color = '#111827';
    fcRef.current = fc;
    return () => { fc.dispose(); if (hostRef.current) hostRef.current.innerHTML = ''; };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Draw your signature</h3>
        <div ref={hostRef} className="rounded-lg ring-1 ring-gray-200 overflow-hidden bg-white" style={{ width: 460, height: 180 }} />
        <div className="mt-4 flex justify-between">
          <button type="button" onClick={() => { const fc = fcRef.current; fc.clear(); fc.setBackgroundColor('#fff', () => fc.renderAll()); }} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">Clear</button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">Cancel</button>
            <button
              type="button"
              onClick={() => {
                const fc = fcRef.current;
                if (!fc.getObjects().length) return onClose();
                onDone(fc.toDataURL({ format: 'png', multiplier: 2 }));
              }}
              className="text-sm px-4 py-1.5 rounded-lg bg-purple-600 text-white"
            >
              Place signature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* small lazy thumbnail */
function ThumbImg({ pdf, index }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const c = await renderPageToCanvas(pdf, index + 1, { scale: 0.3 });
        if (!dead) setSrc(c.toDataURL('image/jpeg', 0.6));
      } catch (_) { /* ignore */ }
    })();
    return () => { dead = true; };
  }, [pdf, index]);
  return src ? <img src={src} alt="" className="w-full block" /> : <div className="w-full h-full animate-pulse bg-gray-200 dark:bg-gray-700" />;
}

/* ---------------------------------------------------------- layers panel --- */
function LayerRow({ obj, selected, onSelect, onToggle, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lidOf(obj) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
  const label = kindLabel(obj);
  const sub = obj.type === 'textbox' || obj.type === 'i-text'
    ? (obj.text || '').replace(/\s+/g, ' ').slice(0, 22)
    : `${Math.round(obj.getScaledWidth() / BASE_SCALE)}×${Math.round(obj.getScaledHeight() / BASE_SCALE)}`;
  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={() => onSelect(obj)}
      className={`group flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer text-xs ${
        selected ? 'bg-purple-100 dark:bg-purple-900/40 ring-1 ring-purple-400' : 'hover:bg-gray-100 dark:hover:bg-gray-700/60'
      }`}
    >
      <button type="button" {...attributes} {...listeners} onClick={(e) => e.stopPropagation()} className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0" title="Drag to reorder">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" /></svg>
      </button>
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-gray-700 dark:text-gray-200">{label}</span>
        {sub && <span className="text-gray-400 dark:text-gray-500"> · {sub}</span>}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggle(obj); }}
        title={obj.visible === false ? 'Show' : 'Hide'}
        className={`shrink-0 ${obj.visible === false ? 'text-gray-300 dark:text-gray-600' : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
      >
        {obj.visible === false
          ? <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.4 5.1A9.6 9.6 0 0112 5c5 0 9 4 10 7a17 17 0 01-3 4M6.6 6.6C4 8 2.6 10.2 2 12c1 3 5 7 10 7 1.6 0 3-.3 4.3-.9" /></svg>
          : <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>}
      </button>
      <button type="button" onClick={(e) => { e.stopPropagation(); onDelete(obj); }} title="Delete this layer" className="shrink-0 text-gray-400 hover:text-red-500">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13" /></svg>
      </button>
    </div>
  );
}

function LayersPanel({ fc, tick, selectedLid, onSelect, onChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  // front-most on top of the list (fabric _objects: last = front)
  const objs = fc ? [...fc.getObjects()].reverse() : [];
  // reference tick so the list re-renders on canvas mutations
  void tick;

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id || !fc) return;
    const ids = objs.map((o) => lidOf(o));
    const from = ids.indexOf(active.id);
    const to = ids.indexOf(over.id);
    if (from < 0 || to < 0) return;
    const moved = objs[from];
    const realIndex = objs.length - 1 - to; // reversed list -> fabric index
    fc.moveTo(moved, realIndex);
    fc.requestRenderAll();
    onChange();
  };

  return (
    <div className="w-52 shrink-0 flex flex-col border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400 border-b border-gray-200 dark:border-gray-700">
        Layers {objs.length ? `· ${objs.length}` : ''}
      </div>
      <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
        {objs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-6 text-center">
            Nothing on this page yet. Add text or a shape and it shows up here.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={objs.map((o) => lidOf(o))} strategy={verticalListSortingStrategy}>
              {objs.map((o) => (
                <LayerRow
                  key={lidOf(o)}
                  obj={o}
                  selected={lidOf(o) === selectedLid}
                  onSelect={onSelect}
                  onToggle={(ob) => { ob.visible = ob.visible === false; fc.requestRenderAll(); onChange(); }}
                  onDelete={(ob) => { fc.remove(ob); fc.discardActiveObject(); fc.requestRenderAll(); onChange(); }}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
      <p className="px-3 py-1.5 text-[10px] text-gray-400 border-t border-gray-200 dark:border-gray-700">
        Drag to restack · click to select · eye to hide
      </p>
    </div>
  );
}

/* ================================================================= main === */
const PDFEditor = () => {
  const [bytes, setBytes] = useState(null);
  const [fileName, setFileName] = useState('');
  const [pdf, setPdf] = useState(null);
  const [sizes, setSizes] = useState([]);
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);

  const [tool, setTool] = useState('select');
  const [color, setColor] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Helvetica');
  const [fill, setFill] = useState(true);
  const [zoom, setZoom] = useState(1);

  const [hydrated, setHydrated] = useState(() => new Set());
  const [thumbsOpen, setThumbsOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(true);
  const [activePage, setActivePage] = useState(0);
  const [layerTick, setLayerTick] = useState(0);
  const bumpLayers = useCallback(() => setLayerTick((t) => t + 1), []);
  const [selected, setSelected] = useState(null);
  const [signOpen, setSignOpen] = useState(false);

  const [dl, setDl] = useState('idle');
  const [saving, setSaving] = useState(false);

  const scrollRef = useRef(null);
  const imgInputRef = useRef(null);
  const store = useRef({ data: {}, live: {}, history: {}, active: 0 });

  const toolProps = useMemo(
    () => ({ color, width: strokeWidth, fontSize, fontFamily, fill }),
    [color, strokeWidth, fontSize, fontFamily, fill],
  );

  const onFiles = async (list) => {
    const f = list[0];
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name?.toLowerCase().endsWith('.pdf')) {
      setError('Please choose a PDF file.');
      return;
    }
    setError(null);
    setPhase('loading');
    try {
      const buf = await f.arrayBuffer();
      const copy = buf.slice(0);
      const doc = await openPdf(buf);
      const sz = [];
      for (let i = 1; i <= doc.numPages; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const page = await doc.getPage(i);
        const vp = page.getViewport({ scale: 1 });
        sz.push({ w: vp.width, h: vp.height });
      }
      store.current = { data: {}, live: {}, history: {}, active: 0 };
      setBytes(new Uint8Array(copy));
      setFileName(f.name);
      setPdf(doc);
      setSizes(sz);
      setHydrated(new Set([0, 1]));
      setActivePage(0);
      setPhase('ready');
    } catch (e) {
      console.error(e);
      setError('Could not open this PDF. It may be damaged or password-protected.');
      setPhase('error');
    }
  };

  const reset = () => {
    setBytes(null); setPdf(null); setSizes([]); setFileName('');
    setPhase('idle'); setSelected(null); setTool('select'); setZoom(1);
    setHydrated(new Set()); setActivePage(0);
    store.current = { data: {}, live: {}, history: {}, active: 0 };
  };

  // While a PDF is open, the page's Back button returns to the upload screen.
  const registerBack = React.useContext(ToolBackContext);
  useEffect(() => {
    if (!registerBack) return undefined;
    registerBack(phase === 'ready' ? reset : null);
    return () => registerBack(null);
  }, [phase, registerBack]);

  useEffect(() => {
    if (phase !== 'ready' || !scrollRef.current) return undefined;
    const io = new IntersectionObserver((entries) => {
      setHydrated((prev) => {
        const next = new Set(prev);
        let changed = false;
        entries.forEach((en) => {
          const i = Number(en.target.getAttribute('data-page'));
          if (en.isIntersecting && !next.has(i)) { next.add(i); changed = true; }
        });
        return changed ? next : prev;
      });
    }, { root: scrollRef.current, rootMargin: '1400px 0px' });
    scrollRef.current.querySelectorAll('[data-page]').forEach((el) => io.observe(el));

    // Track the page nearest the top of the viewport as the "active" one.
    const root = scrollRef.current;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mark = root.getBoundingClientRect().top + 120;
        let best = 0;
        let bestDist = Infinity;
        root.querySelectorAll('[data-page]').forEach((el) => {
          const d = Math.abs(el.getBoundingClientRect().top - mark);
          if (d < bestDist) { bestDist = d; best = Number(el.getAttribute('data-page')); }
        });
        setActivePage((p) => (p === best ? p : best));
        store.current.active = best;
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); root.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, [phase, sizes.length]);

  const bumpHistory = useCallback((pageIndex) => {
    store.current.active = pageIndex;
    const fc = store.current.live[pageIndex];
    if (!fc) return;
    const h = store.current.history[pageIndex] || { stack: [], ptr: -1 };
    const snap = JSON.stringify(fc.toJSON(KEEP));
    if (h.stack[h.ptr] === snap) return;
    h.stack = h.stack.slice(0, h.ptr + 1);
    h.stack.push(snap);
    if (h.stack.length > 40) h.stack.shift();
    h.ptr = h.stack.length - 1;
    store.current.history[pageIndex] = h;
  }, []);

  const applyHistory = (dir) => {
    const p = store.current.active;
    const fc = store.current.live[p];
    const h = store.current.history[p];
    if (!fc || !h) return;
    const ni = h.ptr + dir;
    if (ni < 0 || ni >= h.stack.length) return;
    h.ptr = ni;
    fc.loadFromJSON(JSON.parse(h.stack[ni] || '{}'), () => {
      fc.setZoom(zoom);
      fc.forEachObject((o) => { o.selectable = tool === 'select'; o.evented = tool === 'select'; });
      fc.renderAll();
      store.current.data[p] = fc.toJSON(KEEP);
    });
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected?.obj) {
        const fc = store.current.live[selected.page];
        if (fc) {
          fc.getActiveObjects().forEach((o) => fc.remove(o));
          fc.discardActiveObject();
          fc.requestRenderAll();
          setSelected(null);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); applyHistory(e.shiftKey ? 1 : -1); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); applyHistory(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const addImageToActive = (url, opts = {}) => {
    let p = store.current.active;
    if (!store.current.live[p]) p = [...hydrated][0] ?? 0;
    const fc = store.current.live[p];
    if (!fc) return;
    fabric.Image.fromURL(url, (img) => {
      const maxW = sizes[p].w * BASE_SCALE * 0.5;
      if (img.width > maxW) img.scaleToWidth(maxW);
      img.set({ left: 40, top: 40, data: { kind: 'image' }, ...opts });
      fc.add(img);
      fc.setActiveObject(img);
      fc.requestRenderAll();
      bumpHistory(p);
    });
  };

  const patchSelected = (patch) => {
    if (!selected?.obj) return;
    const fc = store.current.live[selected.page];
    selected.obj.set(patch);
    if (selected.obj.type === 'textbox') selected.obj.initDimensions();
    fc.requestRenderAll();
    store.current.data[selected.page] = fc.toJSON(KEEP);
    bumpHistory(selected.page);
    setSelected({ ...selected });
  };

  const reorder = (dir) => {
    if (!selected?.obj) return;
    const fc = store.current.live[selected.page];
    const o = selected.obj;
    if (dir === 'front') fc.bringToFront(o);
    else if (dir === 'forward') fc.bringForward(o);
    else if (dir === 'backward') fc.sendBackwards(o);
    else fc.sendToBack(o);
    fc.requestRenderAll();
    store.current.data[selected.page] = fc.toJSON(KEEP);
    bumpHistory(selected.page);
    setSelected({ ...selected });
  };

  const applyColorEverywhere = (c) => {
    setColor(c);
    const o = selected?.obj;
    if (!o) return;
    if (TEXT_TYPES.has(o.type)) patchSelected({ fill: c });
    else if (o.data?.kind === 'highlight') patchSelected({ fill: hexToRgba(c, 0.35) });
    else if (o.data?.kind === 'whiteout') patchSelected({ fill: c });
    else if (o.type === 'group') {
      (o._objects || []).forEach((ch) => ch.set(ch.type === 'line' ? { stroke: c } : { fill: c, stroke: c }));
      patchSelected({ dirty: true });
    } else if (o.fill && o.fill !== 'transparent') patchSelected({ fill: c });
    else patchSelected({ stroke: c });
  };

  const buildOverlays = async () => {
    const overlays = [];
    for (let i = 0; i < sizes.length; i += 1) {
      const live = store.current.live[i];
      const json = live ? live.toJSON(KEEP) : store.current.data[i];
      if (!json || !json.objects || json.objects.length === 0) continue;

      const w = sizes[i].w * BASE_SCALE;
      const h = sizes[i].h * BASE_SCALE;
      const off = new fabric.StaticCanvas(document.createElement('canvas'), { width: w, height: h, enableRetinaScaling: false });
      // eslint-disable-next-line no-await-in-loop
      await new Promise((res) => off.loadFromJSON(json, res));

      const H = sizes[i].h;
      const S = BASE_SCALE;
      const texts = [];
      const shapes = [];
      const fillOf = (v) => (v && v !== 'transparent' ? { color: parseColor(v), opacity: colorOpacity(v) } : null);
      const axisAligned = (o) => !o.angle || Math.abs(((o.angle % 360) + 360) % 360) < 0.5;

      off.getObjects().forEach((o) => {
        /* ---- text: real selectable drawText ---- */
        if (TEXT_TYPES.has(o.type)) {
          const raw = String(o.text || '');
          if (!raw.trim()) { o.visible = false; return; }
          const sy = o.scaleY || 1;
          const sx = o.scaleX || 1;
          const sizePt = (o.fontSize * sy) / S;
          const stepPt = (o.fontSize * (o.lineHeight || 1.16) * sy) / S;
          let lines = (o.textLines && o.textLines.length) ? o.textLines.slice() : null;
          let preWrapped = true;
          if (!lines || lines.join('').replace(/\s+/g, '') !== raw.replace(/\s+/g, '')) {
            lines = raw.split('\n');
            preWrapped = false;
          }
          const baseTopPt = o.top / S;
          const xPt = Math.max(2, o.left / S + 1);
          const maxWidthPt = preWrapped ? undefined : Math.max(24, (o.width * sx) / S);
          const isBold = String(o.fontWeight).includes('bold') || o.fontWeight >= 600;
          const col = parseColor(o.fill);
          const opv = (o.opacity ?? 1) * colorOpacity(o.fill);
          lines.forEach((line, li) => {
            if (line === '') return;
            texts.push({
              // fabric places the box top at `baseTopPt`; the first line's
              // baseline sits ~0.9em below that. Match it so the baked text
              // lands where the user sees it on the canvas.
              text: line, x: xPt,
              y: H - baseTopPt - sizePt * 0.9 - li * stepPt,
              size: sizePt, family: o.data?.font || 'Arial',
              bold: isBold, italic: o.fontStyle === 'italic',
              color: col, opacity: opv, maxWidth: maxWidthPt, lineHeight: stepPt,
            });
          });
          o.visible = false;
          return;
        }

        /* ---- rect / whiteout / highlight: crisp vector fill (no seam) ---- */
        if (o.type === 'rect' && axisAligned(o)) {
          const w2 = (o.width * (o.scaleX || 1)) / S;
          const h2 = (o.height * (o.scaleY || 1)) / S;
          const f = fillOf(o.fill);
          const st = fillOf(o.stroke);
          shapes.push({
            type: 'rect',
            x: o.left / S,
            y: H - (o.top / S) - h2,
            w: w2, h: h2,
            fill: f && f.color,
            fillOpacity: (o.opacity ?? 1) * (f ? f.opacity : 1),
            stroke: st && st.color,
            strokeWidth: st ? (o.strokeWidth || 1) / S : 0,
            strokeOpacity: (o.opacity ?? 1) * (st ? st.opacity : 1),
          });
          o.visible = false;
          return;
        }

        /* ---- ellipse: vector ---- */
        if (o.type === 'ellipse' && axisAligned(o)) {
          const rx = (o.rx * (o.scaleX || 1)) / S;
          const ry = (o.ry * (o.scaleY || 1)) / S;
          const f = fillOf(o.fill);
          const st = fillOf(o.stroke);
          shapes.push({
            type: 'ellipse',
            cx: o.left / S + rx,
            cy: H - (o.top / S) - ry,
            rx, ry,
            fill: f && f.color,
            fillOpacity: (o.opacity ?? 1) * (f ? f.opacity : 1),
            stroke: st && st.color,
            strokeWidth: st ? (o.strokeWidth || 1) / S : 0,
            strokeOpacity: (o.opacity ?? 1) * (st ? st.opacity : 1),
          });
          o.visible = false;
          return;
        }

        /* ---- straight line: vector ---- */
        if (o.type === 'line') {
          const m = o.calcTransformMatrix();
          const lp = o.calcLinePoints();
          const a = fabric.util.transformPoint({ x: lp.x1, y: lp.y1 }, m);
          const b = fabric.util.transformPoint({ x: lp.x2, y: lp.y2 }, m);
          const st = fillOf(o.stroke) || { color: parseColor('#000'), opacity: 1 };
          shapes.push({
            type: 'line',
            x1: a.x / S, y1: H - a.y / S, x2: b.x / S, y2: H - b.y / S,
            thickness: (o.strokeWidth || 1) / S,
            color: st.color,
            opacity: (o.opacity ?? 1) * st.opacity,
          });
          o.visible = false;
          return;
        }

        /* ---- image: draw crisp, in place ---- */
        if (o.type === 'image' && axisAligned(o)) {
          const w2 = o.getScaledWidth() / S;
          const h2 = o.getScaledHeight() / S;
          let dataUrl = null;
          try { dataUrl = o.toDataURL({ format: 'png' }); } catch (_) { dataUrl = null; }
          if (dataUrl) {
            shapes.push({
              type: 'image', dataUrl,
              x: o.left / S, y: H - (o.top / S) - h2, w: w2, h: h2,
              opacity: o.opacity ?? 1,
            });
            o.visible = false;
            return;
          }
        }

        /* ---- everything else (freehand, arrows, rotated shapes) -> raster ---- */
      });

      off.renderAll();
      // Only the objects we couldn't turn into vector/text stay visible → raster.
      const hasRaster = off.getObjects().some((o) => o.visible !== false);
      let png = null;
      if (hasRaster) {
        try {
          const url = off.toDataURL({ format: 'png', multiplier: 2 });
          // An empty canvas gives "data:," — never feed that to embedPng.
          if (typeof url === 'string' && url.startsWith('data:image/png') && url.length > 256) png = url;
        } catch (_) { png = null; }
      }
      off.dispose();
      overlays.push({ index: i, png, shapes, texts });
    }
    return overlays;
  };

  const outName = `${stripExt(fileName || 'document')}-edited.pdf`;

  const onSave = async () => {
    if (dl !== 'idle' || saving) return;
    setSaving(true);
    setError(null);
    try {
      const overlays = await buildOverlays();
      const outBytes = await bakeIntoPdf(bytes, overlays);
      const blob = new Blob([outBytes], { type: 'application/pdf' });
      setDl('working');
      await sleep(300);
      downloadBlob(blob, outName);
      await sleep(150);
      setDl('done');
      setTimeout(() => setDl('idle'), 1800);
    } catch (e) {
      console.error(e);
      setError(`Could not save the PDF: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (phase === 'idle' || phase === 'error' || phase === 'loading') {
    return (
      <div className="max-w-2xl mx-auto">
        {phase === 'loading' ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <div className="h-10 w-10 border-4 border-gray-200 border-t-purple-500 rounded-full animate-spin mb-3" />
            Opening PDF…
          </div>
        ) : (
          <FileDropzone
            accept="application/pdf,.pdf"
            onFiles={onFiles}
            paste={false}
            title="Drop a PDF to edit"
            hint="add text, shapes, highlights, images and signatures"
            formats="Your PDF's own text and layout stay untouched — edits go on top"
          />
        )}
        {error && <p className="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{error}</p>}
      </div>
    );
  }

  const selObj = selected?.obj;
  const selIsText = selObj && TEXT_TYPES.has(selObj.type);
  const showStroke = ['pen', 'marker', 'rect', 'ellipse', 'line', 'arrow'].includes(tool)
    || (selObj && ['rect', 'ellipse', 'line', 'group', 'path'].includes(selObj.type) && !selObj.data?.kind?.match(/highlight|whiteout/));

  const Btn = ({ active, onClick, title, children }) => (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`h-9 w-9 grid place-items-center rounded-lg transition-colors shrink-0 ${
        active ? 'bg-purple-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="w-screen mx-[calc(50%-50vw)] px-2 sm:px-4">
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col bg-gray-100 dark:bg-gray-900 h-[calc(100vh-8rem)] min-h-[560px]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto">
        <Btn title="Pages" active={thumbsOpen} onClick={() => setThumbsOpen((v) => !v)}><I d={ICONS.pages} /></Btn>
        <Btn title="Layers" active={layersOpen} onClick={() => setLayersOpen((v) => !v)}><I d={ICONS.layers} /></Btn>
        <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
        {TOOLS.map((t) => (
          <Btn
            key={t.id}
            title={t.label}
            active={tool === t.id}
            onClick={() => {
              if (t.id === 'image') { imgInputRef.current?.click(); return; }
              if (t.id === 'sign') { setSignOpen(true); return; }
              setTool(t.id);
              setSelected(null);
            }}
          >
            <I d={ICONS[t.id]} />
          </Btn>
        ))}
        <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
        <Btn title="Undo (Ctrl+Z)" onClick={() => applyHistory(-1)}><I d={ICONS.undo} /></Btn>
        <Btn title="Redo (Ctrl+Y)" onClick={() => applyHistory(1)}><I d={ICONS.redo} /></Btn>
        {selObj && (
          <>
            <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1 shrink-0" />
            <Btn title="Bring to front" onClick={() => reorder('front')}><I d={ICONS.toFront} /></Btn>
            <Btn title="Bring forward" onClick={() => reorder('forward')}><I d={ICONS.forward} /></Btn>
            <Btn title="Send backward" onClick={() => reorder('backward')}><I d={ICONS.backward} /></Btn>
            <Btn title="Send to back" onClick={() => reorder('back')}><I d={ICONS.toBack} /></Btn>
            <Btn title="Delete selected (Del)" onClick={() => {
              const fc = store.current.live[selected.page];
              fc.getActiveObjects().forEach((o) => fc.remove(o));
              fc.discardActiveObject(); fc.requestRenderAll(); setSelected(null);
            }}><I d={ICONS.trash} /></Btn>
          </>
        )}

        <div className="ml-auto flex items-center gap-1 shrink-0">
          <Btn title="Zoom out" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))}><I d={ICONS.zoomOut} /></Btn>
          <span className="text-xs tabular-nums text-gray-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Btn title="Zoom in" onClick={() => setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2)))}><I d={ICONS.zoomIn} /></Btn>
          <span className="w-px h-6 bg-gray-200 dark:bg-gray-700 mx-1" />
          <button type="button" onClick={reset} className="text-xs px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700">Close</button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || dl !== 'idle'}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
          >
            {saving ? 'Saving…' : dl === 'working' ? 'Preparing…' : dl === 'done' ? '✓ Saved' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-1.5 border-b border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 text-xs overflow-x-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => applyColorEverywhere(c)}
              className={`h-5 w-5 rounded-full ring-1 ring-black/10 ${color === c ? 'outline outline-2 outline-purple-500 outline-offset-1' : ''}`}
              style={{ background: c }}
            />
          ))}
          <input type="color" value={color} onChange={(e) => applyColorEverywhere(e.target.value)} className="h-6 w-7 rounded cursor-pointer bg-transparent" />
        </div>

        {showStroke && (
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 shrink-0">
            Width
            <input
              type="range" min="1" max="24" value={strokeWidth}
              onChange={(e) => {
                const w = Number(e.target.value);
                setStrokeWidth(w);
                if (selObj && !selIsText) patchSelected({ strokeWidth: w });
              }}
              className="w-24 accent-purple-600"
            />
            <span className="w-4 tabular-nums">{strokeWidth}</span>
          </label>
        )}

        {(tool === 'text' || selIsText) && (
          <>
            <select
              value={selIsText ? (selObj.data?.font || 'Arial') : fontFamily}
              onChange={(e) => {
                const v = e.target.value;
                setFontFamily(v);
                if (selIsText) patchSelected({ fontFamily: cssStack(v), data: { ...(selObj.data || {}), kind: 'text', font: v } });
              }}
              className="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 py-1 shrink-0"
              style={selIsText ? { fontFamily: cssStack(selObj.data?.font || 'Arial') } : undefined}
            >
              {FONT_LIST.map((f) => <option key={f} value={f} style={{ fontFamily: cssStack(f) }}>{f}</option>)}
            </select>
            <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 shrink-0">
              Size
              <input
                type="number" min="6" max="120"
                value={selIsText ? Math.round(selObj.fontSize) : fontSize}
                onChange={(e) => { const s = Number(e.target.value) || 16; setFontSize(s); if (selIsText) patchSelected({ fontSize: s }); }}
                className="w-14 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-1.5 py-1"
              />
            </label>
            {selIsText && (
              <>
                <button type="button" onClick={() => patchSelected({ fontWeight: selObj.fontWeight === 'bold' ? 'normal' : 'bold' })} className={`h-6 w-6 rounded font-bold shrink-0 ${selObj.fontWeight === 'bold' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>B</button>
                <button type="button" onClick={() => patchSelected({ fontStyle: selObj.fontStyle === 'italic' ? 'normal' : 'italic' })} className={`h-6 w-6 rounded italic shrink-0 ${selObj.fontStyle === 'italic' ? 'bg-purple-600 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>I</button>
              </>
            )}
          </>
        )}

        {(['rect', 'ellipse'].includes(tool) || (selObj && ['rect', 'ellipse'].includes(selObj.type) && !/highlight|whiteout/.test(selObj.data?.kind || ''))) && (
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 shrink-0">
            <input
              type="checkbox"
              checked={selObj && ['rect', 'ellipse'].includes(selObj.type)
                ? (selObj.fill && selObj.fill !== 'transparent')
                : fill}
              onChange={(e) => {
                setFill(e.target.checked);
                if (selObj && ['rect', 'ellipse'].includes(selObj.type)) {
                  patchSelected(e.target.checked
                    ? { fill: color, stroke: 'transparent', strokeWidth: 0 }
                    : { fill: 'transparent', stroke: color, strokeWidth: strokeWidth });
                }
              }}
              className="accent-purple-600"
            />
            Fill
          </label>
        )}

        {selObj && (
          <label className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 shrink-0">
            Opacity
            <input
              type="range" min="10" max="100" value={Math.round((selObj.opacity ?? 1) * 100)}
              onChange={(e) => patchSelected({ opacity: Number(e.target.value) / 100 })}
              className="w-20 accent-purple-600"
            />
          </label>
        )}

        {selObj && (
          <button
            type="button"
            onClick={() => {
              const fc = store.current.live[selected.page];
              fc.getActiveObjects().forEach((o) => fc.remove(o));
              fc.discardActiveObject(); fc.requestRenderAll(); setSelected(null); bumpLayers();
            }}
            className="shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md bg-red-50 dark:bg-red-900/25 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40"
          >
            <I d={ICONS.trash} className="h-3.5 w-3.5" /> Delete this
          </button>
        )}

        <span className="ml-auto text-gray-400 whitespace-nowrap hidden md:block">
          {tool === 'select'
            ? (selObj ? 'Drag to move · corners to resize · Delete key to remove' : 'Click a shape or text to select it — or use the Layers panel')
            : `Draw on the page to add ${TOOLS.find((t) => t.id === tool)?.label.toLowerCase()}`}
        </span>
      </div>

      <div className="flex-1 flex min-h-0">
        {thumbsOpen && (
          <div className="w-36 shrink-0 overflow-y-auto border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-2 space-y-2">
            {sizes.map((s, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollRef.current?.querySelector(`[data-page="${i}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="block w-full rounded-md ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-purple-400 overflow-hidden bg-gray-100"
                style={{ aspectRatio: `${s.w} / ${s.h}` }}
                title={`Page ${i + 1}`}
              >
                <ThumbImg pdf={pdf} index={i} />
              </button>
            ))}
          </div>
        )}

        <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-8">
          {sizes.map((s, i) => (
            <PageCanvas
              key={i}
              pdf={pdf}
              index={i}
              size={s}
              zoom={zoom}
              hydrated={hydrated.has(i)}
              tool={tool}
              toolProps={toolProps}
              store={store.current}
              onActivate={(idx) => { store.current.active = idx; setActivePage(idx); }}
              onSelect={(obj, page) => { setSelected(obj ? { obj, page } : null); setActivePage(page); }}
              onFinishTool={(page, obj) => {
                setTool('select');
                setSelected(obj ? { obj, page } : null);
                bumpLayers();
              }}
              onLayers={bumpLayers}
              bumpHistory={bumpHistory}
            />
          ))}
        </div>

        {layersOpen && (
          <LayersPanel
            fc={store.current.live[activePage] || null}
            tick={layerTick}
            selectedLid={selected?.obj ? lidOf(selected.obj) : null}
            onSelect={(obj) => {
              const fc = store.current.live[activePage];
              if (!fc) return;
              if (obj.visible === false) { obj.visible = true; }
              fc.setActiveObject(obj);
              fc.requestRenderAll();
              if (tool !== 'select') setTool('select');
              setSelected({ obj, page: activePage });
            }}
            onChange={() => {
              const fc = store.current.live[activePage];
              if (fc) store.current.data[activePage] = fc.toJSON(KEEP);
              bumpHistory(activePage);
              bumpLayers();
              setSelected((s) => (s ? { ...s } : s));
            }}
          />
        )}
      </div>

      <input
        ref={imgInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          const r = new FileReader();
          r.onload = () => addImageToActive(String(r.result));
          r.readAsDataURL(f);
        }}
      />

      {signOpen && (
        <SignaturePad
          onClose={() => setSignOpen(false)}
          onDone={(url) => { setSignOpen(false); addImageToActive(url, { top: 60, left: 60 }); }}
        />
      )}

      {error && (
        <div className="px-3 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800">{error}</div>
      )}
    </div>
    </div>
  );
};

export default PDFEditor;

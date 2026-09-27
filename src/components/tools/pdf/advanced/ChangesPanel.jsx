import React, { useEffect, useRef, useState } from 'react';
import {
  LuType, LuTable, LuImage, LuSquare, LuCircle, LuMinus, LuHighlighter, LuUnderline, LuStrikethrough,
  LuPencil, LuEraser, LuLink, LuTextCursorInput, LuCheckSquare, LuRotateCw, LuFilePlus, LuFileX,
  LuTrash2, LuArrowUp, LuArrowDown, LuLayers, LuX, LuRotateCcw, LuMinus as LuCollapse, LuGripHorizontal,
} from 'react-icons/lu';

const ICONS = {
  text: LuType,
  table: LuTable,
  image: LuImage,
  rect: LuSquare,
  ellipse: LuCircle,
  line: LuMinus,
  highlight: LuHighlighter,
  underline: LuUnderline,
  strike: LuStrikethrough,
  pen: LuPencil,
  whiteout: LuEraser,
  link: LuLink,
  'field-text': LuTextCursorInput,
  'field-check': LuCheckSquare,
  rotate: LuRotateCw,
  inserted: LuFilePlus,
  deleted: LuFileX,
};

const TINT = {
  text: 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
  table: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300',
  page: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  obj: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
};

const Act = ({
  title, onClick, children, danger,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${danger ? 'text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200'}`}
  >
    {children}
  </button>
);

/**
 * Every change made to the document, grouped by page — like layers. Click
 * one to jump to it; undo it / delete it; move objects in front / behind.
 */
const ChangesPanel = ({
  items, activeKey, onPick, onRemove, onRaise, onLower, onClose, onMinimize, onDragStart,
}) => {
  const byPage = new Map();
  items.forEach((it) => {
    const k = it.pageLabel;
    if (!byPage.has(k)) byPage.set(k, []);
    byPage.get(k).push(it);
  });

  return (
    <div data-fq-keep="" className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-gray-200/70 bg-white/90 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:border-gray-700/70 dark:bg-gray-800/90">
      <div
        className={`flex items-center gap-2 border-b border-gray-100 px-3 py-2.5 dark:border-gray-700/70 ${onDragStart ? 'cursor-move select-none touch-none' : ''}`}
        onPointerDown={onDragStart}
        title={onDragStart ? 'Drag to move' : undefined}
      >
        {onDragStart && <LuGripHorizontal className="h-4 w-4 text-gray-300 dark:text-gray-600" />}
        <LuLayers className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-100">Changes</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-gray-500 dark:bg-gray-700 dark:text-gray-300">{items.length}</span>
        {onMinimize && (
          <button type="button" onPointerDown={(e) => e.stopPropagation()} onClick={onMinimize} aria-label="Minimise" title="Minimise" className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <LuCollapse className="h-4 w-4" />
          </button>
        )}
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <LuX className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {!items.length && (
          <div className="px-3 py-8 text-center">
            <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300">
              <LuLayers className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200">No changes yet</p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              Everything you edit or add shows up here. Click one to jump to it, or remove it.
            </p>
          </div>
        )}

        {[...byPage.entries()].map(([page, list]) => (
          <div key={page} className="mb-2">
            <p className="px-2 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{page}</p>
            {list.map((it) => {
              const Icon = ICONS[it.icon] || LuType;
              return (
                <div
                  key={it.key}
                  role="button"
                  tabIndex={0}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onPick(it)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onPick(it); }}
                  className={`group flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 transition-colors ${activeKey === it.key ? 'bg-blue-50 ring-1 ring-blue-200 dark:bg-blue-500/10 dark:ring-blue-500/30' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}
                >
                  <span className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg ${TINT[it.tint] || TINT.obj}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-gray-800 dark:text-gray-100">{it.title}</span>
                    {it.sub && <span className="block truncate text-xs text-gray-500 dark:text-gray-400" title={it.sub}>{it.sub}</span>}
                    {it.was && <span className="block truncate text-[11px] text-gray-400 line-through" title={it.was}>{it.was}</span>}
                  </span>
                  <span className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    {it.kind === 'obj' && (
                      <>
                        <Act title="Bring forward" onClick={() => onRaise(it)}><LuArrowUp className="h-3.5 w-3.5" /></Act>
                        <Act title="Send backward" onClick={() => onLower(it)}><LuArrowDown className="h-3.5 w-3.5" /></Act>
                      </>
                    )}
                    <Act title={it.removeLabel} onClick={() => onRemove(it)} danger>
                      {it.kind === 'obj' || it.icon === 'text' ? <LuTrash2 className="h-3.5 w-3.5" /> : <LuRotateCcw className="h-3.5 w-3.5" />}
                    </Act>
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChangesPanel;

const POS_KEY = 'fq_changes_pos';
const PANEL_W = 272;

/**
 * The Changes panel as a small floating window: drag it by its header to
 * anywhere on screen (remembered), shrink it to a pill, and it pops open by
 * itself when the first change is made. The pages keep the full width.
 */
export const FloatingChanges = (props) => {
  const { items } = props;
  const [pos, setPos] = useState(() => {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    } catch { /* storage blocked */ }
    return { x: Math.max(8, window.innerWidth - PANEL_W - 16), y: 150 };
  });
  const [open, setOpen] = useState(false);
  const posRef = useRef(pos);
  posRef.current = pos;
  const prevCount = useRef(items.length);
  const drag = useRef(null);

  // First change -> show the panel (the user can minimise it again).
  useEffect(() => {
    if (prevCount.current === 0 && items.length > 0) setOpen(true);
    prevCount.current = items.length;
  }, [items.length]);

  // Keep it on screen when the window is resized.
  useEffect(() => {
    const fit = () => window.innerWidth > 200 && setPos((p) => ({
      x: Math.max(8, Math.min(window.innerWidth - 120, p.x)),
      y: Math.max(72, Math.min(window.innerHeight - 60, p.y)),
    }));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const startDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    drag.current = { sx: e.clientX, sy: e.clientY, x: pos.x, y: pos.y, moved: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };
  const onMove = (e) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    const next = {
      x: Math.max(8, Math.min(window.innerWidth - 120, d.x + dx)),
      y: Math.max(72, Math.min(window.innerHeight - 60, d.y + dy)),
    };
    posRef.current = next;
    setPos(next);
  };
  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    try { localStorage.setItem(POS_KEY, JSON.stringify(posRef.current)); } catch { /* storage blocked */ }
    return d;
  };

  if (!open) {
    return (
      <button
        type="button"
        data-fq-keep=""
        title="Show your changes (drag to move)"
        onPointerDown={startDrag}
        onPointerMove={onMove}
        onPointerUp={() => { const d = endDrag(); if (!d || !d.moved) setOpen(true); }}
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        className="fixed z-30 inline-flex cursor-pointer select-none items-center gap-1.5 rounded-full border border-gray-200/80 bg-white/95 px-3 py-2 text-[13px] font-semibold text-gray-700 shadow-lg backdrop-blur-xl transition-shadow hover:shadow-xl dark:border-gray-700 dark:bg-gray-800/95 dark:text-gray-200"
      >
        <LuLayers className="h-4 w-4 text-blue-600 dark:text-blue-300" />
        Changes
        <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${items.length ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>{items.length}</span>
      </button>
    );
  }

  return (
    <div
      className="fixed z-30 flex max-h-[min(26rem,calc(100vh-7rem))] flex-col"
      style={{ left: Math.max(8, Math.min(pos.x, window.innerWidth - PANEL_W - 8)), top: pos.y, width: `min(${PANEL_W}px, calc(100vw - 16px))` }}
      onPointerMove={onMove}
      onPointerUp={endDrag}
    >
      <ChangesPanel
        {...props}
        onMinimize={() => setOpen(false)}
        onDragStart={startDrag}
      />
    </div>
  );
};

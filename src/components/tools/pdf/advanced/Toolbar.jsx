import React, {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  LuType, LuLink, LuFormInput, LuTextCursorInput, LuCheckSquare, LuImage,
  LuFileSignature, LuPenLine, LuEraser, LuHighlighter, LuUnderline, LuStrikethrough, LuPencil,
  LuShapes, LuSquare, LuCircle, LuMinus, LuPlus, LuUndo2, LuTrash2, LuChevronDown, LuUpload,
  LuKeyboard, LuRotateCcw, LuFileText, LuFolderOpen, LuAlignLeft, LuAlignCenter, LuAlignRight, LuCopyPlus,
} from 'react-icons/lu';
import { FONT_LIST, POPULAR_FONTS, cssStack } from '../../../../lib/pdfAnnotate';
import { ORIGINAL, TOOL_LABELS, styleOf } from './records';

const MENU_OF = {
  'field-text': 'forms',
  'field-check': 'forms',
  highlight: 'annotate',
  underline: 'annotate',
  strike: 'annotate',
  pen: 'annotate',
  rect: 'shapes',
  ellipse: 'shapes',
  line: 'shapes',
};

/* ------------------------------ main bar ------------------------------ */

const ToolButton = ({
  icon: Icon, label, active, hasMenu, open, onClick, disabled, title,
}) => (
  <button
    type="button"
    title={title || label}
    aria-label={label}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    aria-expanded={hasMenu ? open : undefined}
    className={`group inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13.5px] font-medium transition-all duration-150 disabled:opacity-30 ${
      active
        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
        : open
          ? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/70 dark:hover:text-white'
    }`}
  >
    {Icon && <Icon className="h-[17px] w-[17px]" />}
    <span className="hidden lg:inline">{label}</span>
    {hasMenu && <LuChevronDown className={`h-3 w-3 opacity-60 transition-transform ${open ? 'rotate-180' : ''}`} />}
  </button>
);

const MenuItem = ({
  icon: Icon, label, sub, onClick, active,
}) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
      active ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`}
  >
    {Icon && (
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
        <Icon className="h-4 w-4" />
      </span>
    )}
    <span className="min-w-0">
      <span className="block font-medium">{label}</span>
      {sub && <span className="block text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </span>
  </button>
);

const Menu = ({ children, wide }) => (
  <div
    className={`absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 ${wide ? 'w-72' : 'w-60'} rounded-2xl border border-gray-200/80 bg-white/95 p-1.5 shadow-2xl ring-1 ring-black/5 backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95`}
  >
    {children}
  </div>
);

/** One slim bar: file · tools · undo. */
export const MainToolbar = ({
  fileName, pages, tool, setTool, onImage, onSign, signatures, onUseSignature, onUndo, canUndo, onChooseAnother,
}) => {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  const imgInput = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(null); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  const toggle = (k) => setOpen((o) => (o === k ? null : k));
  const pick = (t) => { setTool(t); setOpen(null); };
  const current = MENU_OF[tool];

  return (
    <div ref={ref} data-fq-keep="" className="flex items-center gap-2 px-2 py-1.5">
      <div className="hidden min-w-0 items-center gap-2 xl:flex xl:w-56">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-sm">
          <LuFileText className="h-4 w-4" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold text-gray-800 dark:text-gray-100" title={fileName}>{fileName}</span>
          <span className="block text-[11px] text-gray-400">{`${pages} page${pages === 1 ? '' : 's'}`}</span>
        </span>
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center justify-center gap-0.5">
        <ToolButton icon={LuType} label="Text" active={tool === 'text'} onClick={() => pick('text')} title="Edit or add text" />
        <ToolButton icon={LuLink} label="Links" active={tool === 'link'} onClick={() => pick('link')} />

        <div className="relative">
          <ToolButton icon={LuFormInput} label="Forms" hasMenu active={current === 'forms'} open={open === 'forms'} onClick={() => toggle('forms')} />
          {open === 'forms' && (
            <Menu>
              <MenuItem icon={LuTextCursorInput} label="Text field" sub="A box people can type into" active={tool === 'field-text'} onClick={() => pick('field-text')} />
              <MenuItem icon={LuCheckSquare} label="Checkbox" sub="A box people can tick" active={tool === 'field-check'} onClick={() => pick('field-check')} />
            </Menu>
          )}
        </div>

        <ToolButton icon={LuImage} label="Images" onClick={() => { setOpen(null); imgInput.current?.click(); }} title="Add an image" />
        <input
          ref={imgInput}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) onImage(f);
          }}
        />

        <div className="relative">
          <ToolButton icon={LuFileSignature} label="Sign" hasMenu open={open === 'sign'} onClick={() => toggle('sign')} />
          {open === 'sign' && (
            <Menu wide>
              <MenuItem icon={LuPenLine} label="Draw signature" onClick={() => { setOpen(null); onSign('draw'); }} />
              <MenuItem icon={LuKeyboard} label="Type signature" onClick={() => { setOpen(null); onSign('type'); }} />
              <MenuItem icon={LuUpload} label="Upload signature image" onClick={() => { setOpen(null); onSign('upload'); }} />
              {signatures.length > 0 && (
                <>
                  <div className="mx-2 my-1.5 h-px bg-gray-200 dark:bg-gray-700" />
                  <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Your signatures</p>
                  <div className="grid grid-cols-2 gap-1.5 px-1.5 pb-1">
                    {signatures.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { setOpen(null); onUseSignature(s); }}
                        title="Place this signature"
                        className="grid h-14 place-items-center rounded-lg border border-gray-200 bg-white p-1 hover:border-blue-400 dark:border-gray-600"
                      >
                        <img src={s.src} alt="Signature" className="max-h-full max-w-full object-contain" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Menu>
          )}
        </div>

        <ToolButton icon={LuEraser} label="Whiteout" active={tool === 'whiteout'} onClick={() => pick('whiteout')} />

        <div className="relative">
          <ToolButton icon={LuHighlighter} label="Annotate" hasMenu active={current === 'annotate'} open={open === 'annotate'} onClick={() => toggle('annotate')} />
          {open === 'annotate' && (
            <Menu>
              <MenuItem icon={LuHighlighter} label="Highlight" active={tool === 'highlight'} onClick={() => pick('highlight')} />
              <MenuItem icon={LuUnderline} label="Underline" active={tool === 'underline'} onClick={() => pick('underline')} />
              <MenuItem icon={LuStrikethrough} label="Strikethrough" active={tool === 'strike'} onClick={() => pick('strike')} />
              <MenuItem icon={LuPencil} label="Freehand drawing" active={tool === 'pen'} onClick={() => pick('pen')} />
            </Menu>
          )}
        </div>

        <div className="relative">
          <ToolButton icon={LuShapes} label="Shapes" hasMenu active={current === 'shapes'} open={open === 'shapes'} onClick={() => toggle('shapes')} />
          {open === 'shapes' && (
            <Menu>
              <MenuItem icon={LuSquare} label="Rectangle" active={tool === 'rect'} onClick={() => pick('rect')} />
              <MenuItem icon={LuCircle} label="Ellipse" active={tool === 'ellipse'} onClick={() => pick('ellipse')} />
              <MenuItem icon={LuMinus} label="Line" active={tool === 'line'} onClick={() => pick('line')} />
            </Menu>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 xl:w-56 xl:justify-end">
        <ToolButton icon={LuUndo2} label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} />
        <button
          type="button"
          onClick={onChooseAnother}
          title="Open another PDF"
          aria-label="Open another PDF"
          className="grid h-9 w-9 place-items-center rounded-xl text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        >
          <LuFolderOpen className="h-[17px] w-[17px]" />
        </button>
      </div>
    </div>
  );
};

/* ------------------------------ floating format bar ------------------------------ */

/**
 * A small bar that floats just above (or below) whatever is being edited —
 * the text line or the selected object — like Sejda / Canva.
 */
export const FloatingBar = ({ getAnchor, avoidRef, children }) => {
  const ref = useRef(null);
  const anchorFn = useRef(getAnchor);
  anchorFn.current = getAnchor;
  const [pos, setPosState] = useState(null);
  const posRef = useRef(null);
  // Only ever set state when the position really changed (this runs after
  // every render, so an unconditional set would loop).
  const setPos = (next) => {
    const p = posRef.current;
    if (p === next || (p && next && p.top === next.top && p.left === next.left && p.hidden === next.hidden)) return;
    posRef.current = next;
    setPosState(next);
  };

  const place = useCallback(() => {
    const el = anchorFn.current();
    const bar = ref.current;
    if (!el || !bar) { setPos(null); return; }
    const r = el.getBoundingClientRect();
    const bw = bar.offsetWidth;
    const bh = bar.offsetHeight;
    const minTop = (avoidRef?.current?.getBoundingClientRect().bottom ?? 0) + 8;
    let top = Math.round(r.top - bh - 12);
    if (top < minTop) top = Math.round(r.bottom + 12);
    const hidden = r.bottom < minTop - 4 || r.top > window.innerHeight;
    const left = Math.round(Math.max(8, Math.min(window.innerWidth - bw - 8, r.left)));
    if (!Number.isFinite(top) || !Number.isFinite(left)) return;
    setPos({ top, left, hidden });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidRef]);

  useLayoutEffect(() => { place(); });
  useEffect(() => {
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [place]);

  return createPortal(
    <div
      ref={ref}
      data-fq-keep=""
      style={{
        position: 'fixed',
        top: pos ? pos.top : -9999,
        left: pos ? pos.left : -9999,
        visibility: pos && !pos.hidden ? 'visible' : 'hidden',
      }}
      className="z-40 flex w-max max-w-[calc(100vw-16px)] flex-wrap items-center gap-1 rounded-2xl border border-gray-200/80 bg-white/95 p-1 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.35)] ring-1 ring-black/5 backdrop-blur-xl animate-[fqpop_.14s_ease-out] dark:border-gray-700 dark:bg-gray-800/95"
    >
      <style>{'@keyframes fqpop{from{opacity:0;transform:translateY(4px) scale(.98)}to{opacity:1;transform:none}}'}</style>
      {children}
    </div>,
    document.body,
  );
};

const FIELD = 'h-8 rounded-lg border-0 bg-gray-100 px-2 text-[13px] text-gray-800 outline-none ring-1 ring-transparent transition focus:bg-white focus:ring-blue-500 dark:bg-gray-700 dark:text-white dark:focus:bg-gray-900';
const ICON_BTN = 'grid h-8 w-8 place-items-center rounded-lg text-[13px] transition-colors';
const toggleCls = (on) => `${ICON_BTN} ${on ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`;
const Sep = () => <span className="mx-0.5 h-5 w-px bg-gray-200 dark:bg-gray-700" />;

const HIGHLIGHTS = ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c'];
const WIDTHS = [0.75, 1, 1.5, 2, 3, 4, 6];

export const FontSelect = ({ value, onChange, originalLabel }) => {
  const rest = FONT_LIST.filter((f) => !POPULAR_FONTS.includes(f));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} w-44 cursor-pointer`}
      style={{ fontFamily: value === ORIGINAL ? undefined : cssStack(value) }}
      title="Font"
    >
      {originalLabel && (
        <optgroup label="From this PDF">
          <option value={ORIGINAL}>{`${originalLabel} (original)`}</option>
        </optgroup>
      )}
      <optgroup label="Popular in MS Word">
        {POPULAR_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: cssStack(f) }}>{f}</option>)}
      </optgroup>
      <optgroup label="More fonts">
        {rest.map((f) => <option key={f} value={f} style={{ fontFamily: cssStack(f) }}>{f}</option>)}
      </optgroup>
    </select>
  );
};

/** − 12 + : typing is free, the size applies on Enter / leaving the box. */
const SizeStepper = ({ value, onChange }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (v) => {
    const n = parseFloat(v);
    if (Number.isFinite(n)) onChange(Math.max(4, Math.min(200, Math.round(n * 2) / 2)));
    else setDraft(String(value));
  };
  const step = (d) => onChange(Math.max(4, Math.min(200, Math.round((value + d) * 2) / 2)));
  return (
    <div className="flex h-8 items-center rounded-lg bg-gray-100 dark:bg-gray-700" title="Font size (pt)">
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => step(-1)} className="grid h-8 w-7 place-items-center rounded-l-lg text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600" aria-label="Smaller">
        <LuMinus className="h-3.5 w-3.5" />
      </button>
      <input
        value={draft}
        inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(e.currentTarget.value); }}
        className="h-8 w-10 bg-transparent text-center text-[13px] tabular-nums text-gray-800 outline-none dark:text-white"
      />
      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => step(1)} className="grid h-8 w-7 place-items-center rounded-r-lg text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-600" aria-label="Bigger">
        <LuPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

/** Colour well: a letter / swatch with the colour, opening the picker. */
const ColorWell = ({
  value, onChange, title = 'Colour', letter,
}) => (
  <label title={title} className={`${ICON_BTN} relative cursor-pointer text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-gray-700`}>
    {letter ? (
      <span className="flex flex-col items-center leading-none">
        <span className="text-[14px] font-semibold">A</span>
        <span className="mt-0.5 h-[3px] w-4 rounded-full" style={{ background: value }} />
      </span>
    ) : (
      <span className="h-4 w-4 rounded-full ring-1 ring-black/15" style={{ background: value }} />
    )}
    <input
      type="color"
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
    />
  </label>
);

const WidthSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className={`${FIELD} w-[4.5rem] cursor-pointer`} title="Thickness">
    {WIDTHS.map((w) => <option key={w} value={w}>{`${w} pt`}</option>)}
  </select>
);

const IconAction = ({
  onClick, title, danger, children,
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`${ICON_BTN} ${danger ? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700'}`}
  >
    {children}
  </button>
);

/** Controls for the text line being edited. */
export const TextFormat = ({
  rec, originalLabel, onFont, onSize, onToggle, onColor, onClear, onRevert, onAlign, onDuplicate,
}) => {
  const align = rec.align || 'left';
  const { bold, italic } = styleOf(rec);
  const k = (e) => e.preventDefault();
  return (
    <>
      <FontSelect value={rec.family} onChange={onFont} originalLabel={originalLabel} />
      <SizeStepper value={rec.size} onChange={onSize} />
      <Sep />
      <button type="button" onMouseDown={k} onClick={() => onToggle('bold')} className={`${toggleCls(bold)} font-bold`} title="Bold (Ctrl+B)">B</button>
      <button type="button" onMouseDown={k} onClick={() => onToggle('italic')} className={`${toggleCls(italic)} font-serif italic`} title="Italic (Ctrl+I)">I</button>
      <button type="button" onMouseDown={k} onClick={() => onToggle('underline')} className={toggleCls(!!rec.underline)} title="Underline (Ctrl+U)">
        <LuUnderline className="h-4 w-4" />
      </button>
      <ColorWell value={rec.color} onChange={onColor} title="Text colour" letter />
      <Sep />
      <button type="button" onMouseDown={k} onClick={() => onAlign('left')} className={toggleCls(align === 'left')} title="Align left (page margin)">
        <LuAlignLeft className="h-4 w-4" />
      </button>
      <button type="button" onMouseDown={k} onClick={() => onAlign('center')} className={toggleCls(align === 'center')} title="Centre on the page">
        <LuAlignCenter className="h-4 w-4" />
      </button>
      <button type="button" onMouseDown={k} onClick={() => onAlign('right')} className={toggleCls(align === 'right')} title="Align right (page margin)">
        <LuAlignRight className="h-4 w-4" />
      </button>
      <Sep />
      <IconAction onClick={onDuplicate} title="Duplicate (Ctrl+D)">
        <LuCopyPlus className="h-4 w-4" />
      </IconAction>
      {rec.kind === 'line' && (
        <IconAction onClick={onRevert} title="Undo all changes to this line">
          <LuRotateCcw className="h-4 w-4" />
        </IconAction>
      )}
      <IconAction onClick={onClear} title="Delete this text" danger>
        <LuTrash2 className="h-4 w-4" />
      </IconAction>
    </>
  );
};

/** Controls for a selected object. */
export const ObjectFormat = ({
  obj, onChange, onDelete, onDuplicate,
}) => {
  const o = obj;
  return (
    <>
      <span className="px-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{TOOL_LABELS[o.type] || 'Object'}</span>
      {o.type === 'whiteout' && <ColorWell value={o.color} onChange={(color) => onChange({ color })} title="Fill colour" />}
      {o.type === 'highlight' && HIGHLIGHTS.map((c) => (
        <button
          key={c}
          type="button"
          aria-label="Highlight colour"
          onClick={() => onChange({ color: c })}
          className={`h-6 w-6 rounded-full ring-2 ring-offset-1 transition ${o.color === c ? 'ring-blue-600' : 'ring-transparent hover:ring-gray-300'}`}
          style={{ background: c }}
        />
      ))}
      {['underline', 'strike', 'line', 'pen', 'rect', 'ellipse'].includes(o.type) && (
        <>
          <ColorWell value={o.color} onChange={(color) => onChange({ color })} title="Line colour" />
          <WidthSelect value={o.width} onChange={(width) => onChange({ width })} />
        </>
      )}
      {(o.type === 'rect' || o.type === 'ellipse') && (
        <label className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700">
          <input type="checkbox" checked={!!o.fill} onChange={(e) => onChange({ fill: e.target.checked ? '#fde68a' : '' })} className="h-3.5 w-3.5 accent-blue-600" />
          Fill
          {o.fill && <ColorWell value={o.fill} onChange={(fill) => onChange({ fill })} title="Fill colour" />}
        </label>
      )}
      {o.type === 'link' && (
        <input
          autoFocus={!o.url}
          value={o.url || ''}
          onChange={(e) => onChange({ url: e.target.value })}
          placeholder="Paste a web address…"
          className={`${FIELD} w-56`}
          title="Web address this area opens"
        />
      )}
      {(o.type === 'field-text' || o.type === 'field-check') && (
        <input value={o.name || ''} onChange={(e) => onChange({ name: e.target.value })} className={`${FIELD} w-36`} title="Field name" />
      )}
      <Sep />
      <IconAction onClick={onDuplicate} title="Duplicate (Ctrl+D) — Ctrl+C / Ctrl+V also work">
        <LuCopyPlus className="h-4 w-4" />
      </IconAction>
      <IconAction onClick={onDelete} title="Delete" danger>
        <LuTrash2 className="h-4 w-4" />
      </IconAction>
    </>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import {
  LuType, LuLink, LuFormInput, LuTextCursorInput, LuCheckSquare, LuImage, LuImagePlus,
  LuFileSignature, LuPenLine, LuEraser, LuHighlighter, LuUnderline, LuStrikethrough, LuPencil,
  LuShapes, LuSquare, LuCircle, LuMinus, LuUndo2, LuTrash2, LuChevronDown, LuUpload,
  LuKeyboard, LuRotateCcw, LuMousePointer2,
} from 'react-icons/lu';
import { FONT_LIST, POPULAR_FONTS, cssStack } from '../../../../lib/pdfAnnotate';
import { ORIGINAL, TOOL_HINTS, TOOL_LABELS } from './records';

const MENU_OF = {
  text: 'text',
  link: 'link',
  'field-text': 'forms',
  'field-check': 'forms',
  whiteout: 'whiteout',
  highlight: 'annotate',
  underline: 'annotate',
  strike: 'annotate',
  pen: 'annotate',
  rect: 'shapes',
  ellipse: 'shapes',
  line: 'shapes',
};

const ToolButton = ({
  icon: Icon, label, active, hasMenu, open, onClick, disabled, title,
}) => (
  <button
    type="button"
    title={title || label}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    aria-expanded={hasMenu ? open : undefined}
    className={`inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium xl:px-3 xl:text-[15px] transition-colors disabled:opacity-35 ${
      active
        ? 'bg-blue-600 text-white shadow-sm'
        : open
          ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200'
          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700/70'
    }`}
  >
    {Icon && <Icon className="h-[18px] w-[18px]" />}
    <span className="hidden md:inline">{label}</span>
    {hasMenu && <LuChevronDown className={`h-3.5 w-3.5 opacity-70 transition-transform ${open ? 'rotate-180' : ''}`} />}
  </button>
);

const MenuItem = ({
  icon: Icon, label, sub, onClick, active,
}) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
      active ? 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'
    }`}
  >
    {Icon && <Icon className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-300" />}
    <span className="min-w-0">
      <span className="block font-medium">{label}</span>
      {sub && <span className="block text-xs text-gray-500 dark:text-gray-400">{sub}</span>}
    </span>
  </button>
);

const Menu = ({ children, wide }) => (
  <div
    className={`absolute left-0 top-full z-50 mt-1.5 ${wide ? 'w-72' : 'w-60'} rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-gray-700 dark:bg-gray-800`}
  >
    {children}
  </div>
);

/**
 * Sejda-style main bar: Text · Links · Forms · Images · Sign · Whiteout ·
 * Annotate · Shapes · Undo.
 */
export const MainToolbar = ({
  tool, setTool, onImage, onSign, signatures, onUseSignature, onUndo, canUndo,
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
    <div ref={ref} data-fq-keep="" className="flex flex-wrap items-center justify-center gap-0.5">
      <div className="relative">
        <ToolButton icon={LuType} label="Text" hasMenu active={current === 'text'} open={open === 'text'} onClick={() => { setTool('text'); toggle('text'); }} />
        {open === 'text' && (
          <Menu wide>
            <MenuItem icon={LuMousePointer2} label="Edit existing text" sub="Click any line on the page and type" active={tool === 'text'} onClick={() => pick('text')} />
            <MenuItem icon={LuType} label="Add new text" sub="Click an empty spot on the page" onClick={() => pick('text')} />
            <p className="px-3 pb-1 pt-2 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
              Font, size and colour for new text are in the bar below. Enter starts a new line; Ctrl+B / Ctrl+I for bold / italic.
            </p>
          </Menu>
        )}
      </div>

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

      <div className="relative">
        <ToolButton icon={LuImage} label="Images" hasMenu open={open === 'images'} onClick={() => toggle('images')} />
        {open === 'images' && (
          <Menu>
            <MenuItem icon={LuImagePlus} label="Upload image" sub="JPG, PNG or WebP from your device" onClick={() => { setOpen(null); imgInput.current?.click(); }} />
          </Menu>
        )}
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
      </div>

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
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">Your signatures</p>
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

      <span className="mx-1 h-6 w-px bg-gray-200 dark:bg-gray-700" />
      <ToolButton icon={LuUndo2} label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo} />
    </div>
  );
};

/* ------------------------------ context bar ------------------------------ */

const FIELD = 'h-8 rounded-md border border-gray-300 bg-white px-2 text-sm disabled:opacity-40 dark:border-gray-600 dark:bg-gray-700 dark:text-white';
const SMALL_BTN = 'inline-flex h-8 items-center justify-center gap-1 rounded-md px-2 text-sm font-medium transition-colors';
const toggleCls = (on) => `${SMALL_BTN} w-8 ${on ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700'}`;

const HIGHLIGHTS = ['#facc15', '#4ade80', '#f472b6', '#60a5fa', '#fb923c'];
const WIDTHS = [0.75, 1, 1.5, 2, 3, 4, 6];

export const FontSelect = ({ value, onChange, originalLabel }) => {
  const rest = FONT_LIST.filter((f) => !POPULAR_FONTS.includes(f));
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${FIELD} w-[11.5rem]`}
      style={{ fontFamily: value === ORIGINAL ? undefined : cssStack(value) }}
      title="Font"
    >
      {originalLabel && (
        <optgroup label="From this PDF">
          <option value={ORIGINAL}>{`Original · ${originalLabel}`}</option>
        </optgroup>
      )}
      <optgroup label="Popular (MS Word)">
        {POPULAR_FONTS.map((f) => <option key={f} value={f} style={{ fontFamily: cssStack(f) }}>{f}</option>)}
      </optgroup>
      <optgroup label="More fonts">
        {rest.map((f) => <option key={f} value={f} style={{ fontFamily: cssStack(f) }}>{f}</option>)}
      </optgroup>
    </select>
  );
};

const SizeInput = ({ value, onChange }) => (
  <input
    type="number"
    min="4"
    max="200"
    step="0.5"
    value={value}
    onChange={(e) => {
      const v = parseFloat(e.target.value);
      if (Number.isFinite(v)) onChange(Math.max(4, Math.min(200, v)));
    }}
    className={`${FIELD} w-16`}
    title="Font size (pt)"
  />
);

const ColorInput = ({ value, onChange, title = 'Colour' }) => (
  <input
    type="color"
    value={value || '#000000'}
    onChange={(e) => onChange(e.target.value)}
    className="h-8 w-9 cursor-pointer rounded-md border border-gray-300 bg-white p-0.5 dark:border-gray-600"
    title={title}
  />
);

const WidthSelect = ({ value, onChange }) => (
  <select value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className={`${FIELD} w-20`} title="Thickness">
    {WIDTHS.map((w) => <option key={w} value={w}>{`${w} pt`}</option>)}
  </select>
);

const Label = ({ children }) => <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{children}</span>;

const DeleteBtn = ({ onClick, label = 'Delete' }) => (
  <button
    type="button"
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`${SMALL_BTN} text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20`}
  >
    <LuTrash2 className="h-4 w-4" /> {label}
  </button>
);

/** Style controls for whatever text line / object / tool is active. */
export const ContextBar = ({
  tool, active, selected, defaults, originalLabel,
  onRec, onRecFont, onToggleStyle, onRecClear, onRecRevert,
  onObj, onObjDelete, onDefaults,
}) => {
  let body;

  if (active) {
    const bold = active.family === ORIGINAL ? active.origBold : active.bold;
    const italic = active.family === ORIGINAL ? active.origItalic : active.italic;
    body = (
      <>
        <Label>{active.kind === 'line' ? 'Editing text' : 'New text'}</Label>
        <FontSelect value={active.family} onChange={onRecFont} originalLabel={originalLabel} />
        <SizeInput value={active.size} onChange={(size) => onRec({ size })} />
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onToggleStyle('bold')} className={`${toggleCls(bold)} font-bold`} title="Bold (Ctrl+B)">B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => onToggleStyle('italic')} className={`${toggleCls(italic)} italic`} title="Italic (Ctrl+I)">I</button>
        <ColorInput value={active.color} onChange={(color) => onRec({ color })} title="Text colour" />
        <DeleteBtn onClick={onRecClear} label="Delete text" />
        {active.kind === 'line' && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onRecRevert}
            className={`${SMALL_BTN} text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700`}
            title="Put the original text back"
          >
            <LuRotateCcw className="h-4 w-4" /> Revert
          </button>
        )}
      </>
    );
  } else if (selected) {
    const o = selected;
    const set = (p) => onObj(o.id, p);
    body = (
      <>
        <Label>{TOOL_LABELS[o.type] || 'Object'}</Label>
        {o.type === 'whiteout' && <ColorInput value={o.color} onChange={(color) => set({ color })} title="Fill colour" />}
        {o.type === 'highlight' && HIGHLIGHTS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label="Highlight colour"
            onClick={() => set({ color: c })}
            className={`h-6 w-6 rounded-full border-2 ${o.color === c ? 'border-blue-600' : 'border-white shadow'}`}
            style={{ background: c }}
          />
        ))}
        {['underline', 'strike', 'line', 'pen', 'rect', 'ellipse'].includes(o.type) && (
          <>
            <ColorInput value={o.color} onChange={(color) => set({ color })} title="Line colour" />
            <WidthSelect value={o.width} onChange={(width) => set({ width })} />
          </>
        )}
        {(o.type === 'rect' || o.type === 'ellipse') && (
          <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
            <input type="checkbox" checked={!!o.fill} onChange={(e) => set({ fill: e.target.checked ? '#fde68a' : '' })} className="h-4 w-4 accent-blue-600" />
            Fill
            {o.fill && <ColorInput value={o.fill} onChange={(fill) => set({ fill })} title="Fill colour" />}
          </label>
        )}
        {o.type === 'link' && (
          <input
            autoFocus={!o.url}
            value={o.url || ''}
            onChange={(e) => set({ url: e.target.value })}
            placeholder="https://example.com"
            className={`${FIELD} w-64`}
            title="Web address this area opens"
          />
        )}
        {(o.type === 'field-text' || o.type === 'field-check') && (
          <>
            <span className="text-sm text-gray-500">Name</span>
            <input value={o.name || ''} onChange={(e) => set({ name: e.target.value })} className={`${FIELD} w-40`} />
          </>
        )}
        {o.type === 'image' && <span className="text-sm text-gray-500">Drag to move · corner to resize</span>}
        <DeleteBtn onClick={() => onObjDelete(o.id)} />
      </>
    );
  } else if (tool === 'text') {
    const d = defaults.text;
    body = (
      <>
        <Label>New text</Label>
        <FontSelect value={d.family} onChange={(family) => onDefaults('text', { family })} />
        <SizeInput value={d.size} onChange={(size) => onDefaults('text', { size })} />
        <button type="button" onClick={() => onDefaults('text', { bold: !d.bold })} className={`${toggleCls(d.bold)} font-bold`} title="Bold">B</button>
        <button type="button" onClick={() => onDefaults('text', { italic: !d.italic })} className={`${toggleCls(d.italic)} italic`} title="Italic">I</button>
        <ColorInput value={d.color} onChange={(color) => onDefaults('text', { color })} title="Text colour" />
      </>
    );
  } else if (defaults[tool]) {
    const d = defaults[tool];
    body = (
      <>
        <Label>{TOOL_LABELS[tool]}</Label>
        {tool === 'highlight' && HIGHLIGHTS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label="Highlight colour"
            onClick={() => onDefaults(tool, { color: c })}
            className={`h-6 w-6 rounded-full border-2 ${d.color === c ? 'border-blue-600' : 'border-white shadow'}`}
            style={{ background: c }}
          />
        ))}
        {tool === 'whiteout' && <ColorInput value={d.color} onChange={(color) => onDefaults(tool, { color })} title="Fill colour" />}
        {'width' in d && (
          <>
            <ColorInput value={d.color} onChange={(color) => onDefaults(tool, { color })} title="Line colour" />
            <WidthSelect value={d.width} onChange={(width) => onDefaults(tool, { width })} />
          </>
        )}
      </>
    );
  }

  const hint = !active && !selected ? TOOL_HINTS[tool] : null;

  return (
    <div data-fq-keep="" className="flex min-h-[2.5rem] flex-wrap items-center justify-center gap-2 px-2">
      {body}
      {hint && <span className="text-sm text-gray-500 dark:text-gray-400">{hint}</span>}
    </div>
  );
};

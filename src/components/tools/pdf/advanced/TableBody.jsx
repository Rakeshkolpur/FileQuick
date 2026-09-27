import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { LuPlus, LuGripVertical } from 'react-icons/lu';
import {
  CELL_PAD_X, CELL_PAD_Y, LINE_H, tableRowHeights,
} from './records';

/** One editable cell. Uncontrolled while focused; follows the model otherwise (undo). */
const Cell = ({
  text, style, onText, onKeyDown, onFocus, setRef,
}) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== text) el.innerText = text;
  }, [text]);
  return (
    <div
      ref={(el) => { ref.current = el; setRef(el); }}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      className="cursor-text outline-none transition-colors focus:bg-blue-500/10"
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onInput={(e) => onText(e.currentTarget.innerText.replace(/\n$/, ''))}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
    />
  );
};

const PlusButton = ({ title, onClick, style }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onPointerDown={(e) => e.stopPropagation()}
    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
    onClick={(e) => { e.stopPropagation(); onClick(); }}
    className="absolute z-20 grid h-5 w-5 place-items-center rounded-full bg-blue-600 text-white opacity-0 shadow-md ring-2 ring-white transition hover:scale-110 hover:bg-blue-700 group-hover:opacity-100"
    style={style}
  >
    <LuPlus className="h-3.5 w-3.5" />
  </button>
);

/**
 * A table: a CSS grid of editable cells whose rows grow with their text,
 * ruled lines drawn on top (skipping the edge shared with an existing PDF
 * table it extends), and + buttons to add a row / column.
 */
const TableBody = ({
  obj, scale, selected, fontCss, onCellText, onCellFocus, onAddRow, onAddCol, onMeasure, onGripDown,
}) => {
  const cells = useRef([]);
  const pendingFocus = useRef(null);
  const rows = obj.cells.length;
  const cols = obj.colW.length;

  // Row heights as rendered (text wraps and grows a row) -> model, so the
  // saved PDF has exactly the same layout.
  useLayoutEffect(() => {
    const got = obj.cells.map((_, r) => {
      const el = cells.current[r]?.[0];
      return el ? Math.round((el.offsetHeight / scale) * 10) / 10 : obj.rowH[r];
    });
    const prev = obj.rowAuto || [];
    if (got.length !== prev.length || got.some((h, i) => Math.abs(h - (prev[i] || 0)) > 0.3)) onMeasure(obj.id, got);
    if (pendingFocus.current) {
      const { r, c } = pendingFocus.current;
      const el = cells.current[r]?.[c];
      if (el) { el.focus(); pendingFocus.current = null; }
    }
  });

  const focusCell = (r, c) => {
    const el = cells.current[r]?.[c];
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  };

  const onKey = (r, c) => (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const i = r * cols + c + (e.shiftKey ? -1 : 1);
    if (i < 0) return;
    if (i >= rows * cols) {
      // Tab in the last cell adds a row, like Word.
      pendingFocus.current = { r: rows, c: 0 };
      onAddRow(obj.id);
      return;
    }
    focusCell(Math.floor(i / cols), i % cols);
  };

  const hs = tableRowHeights(obj);
  const W = obj.colW.reduce((a, b) => a + b, 0) * scale;
  const H = hs.reduce((a, b) => a + b, 0) * scale;
  const lw = Math.max(1, (obj.bw || 0.75) * scale);
  const xs = [0];
  obj.colW.forEach((w) => xs.push(xs[xs.length - 1] + w * scale));
  const ys = [0];
  hs.forEach((h) => ys.push(ys[ys.length - 1] + h * scale));

  return (
    <div className="group absolute left-0 top-0" style={{ width: W, height: H }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: obj.colW.map((w) => `${w * scale}px`).join(' '),
          width: W,
        }}
      >
        {obj.cells.map((row, r) => row.map((text, c) => (
          <Cell
            key={`${r}:${c}`}
            text={text}
            setRef={(el) => {
              if (!cells.current[r]) cells.current[r] = [];
              cells.current[r][c] = el;
            }}
            style={{
              minHeight: obj.rowH[r] * scale,
              padding: `${CELL_PAD_Y * scale}px ${CELL_PAD_X * scale}px`,
              fontFamily: fontCss,
              fontSize: obj.size * scale,
              lineHeight: LINE_H,
              fontWeight: obj.headerBold && r === 0 ? 700 : 400,
              color: obj.color,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
            }}
            onText={(t) => onCellText(obj.id, r, c, t)}
            onKeyDown={onKey(r, c)}
            onFocus={() => onCellFocus(obj.id, r, c)}
          />
        )))}
      </div>

      <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={W} height={H}>
        {ys.map((y, i) => (i === 0 && obj.attach === 'bottom' ? null : (
          <line key={`h${i}`} x1={0} x2={W} y1={y} y2={y} stroke={obj.border} strokeWidth={lw} />
        )))}
        {xs.map((x, i) => (i === 0 && obj.attach === 'right' ? null : (
          <line key={`v${i}`} x1={x} x2={x} y1={0} y2={H} stroke={obj.border} strokeWidth={lw} />
        )))}
      </svg>

      <span
        title="Drag to move the table"
        className={`absolute -left-6 top-0 grid h-7 w-5 cursor-grab place-items-center rounded-md bg-blue-600 text-white shadow-md transition-opacity active:cursor-grabbing ${selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
        style={{ touchAction: 'none' }}
        onPointerDown={onGripDown}
      >
        <LuGripVertical className="h-4 w-4" />
      </span>

      <PlusButton title="Add a row" onClick={() => onAddRow(obj.id)} style={{ left: W / 2 - 10, top: H + 5 }} />
      <PlusButton title="Add a column" onClick={() => onAddCol(obj.id)} style={{ left: W + 5, top: H / 2 - 10 }} />
    </div>
  );
};

export default TableBody;

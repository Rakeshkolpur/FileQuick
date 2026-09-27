import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { LuGripVertical } from 'react-icons/lu';
import {
  styleOf, underlineOf, justifyFit, anchorX, baseY, placeX,
} from './records';
import { textWidth } from './measure';
import { deltaToFrame } from './geometry';

const SNAP = 4; // pt

/**
 * One edited / new line of text: a cover hiding the original pixels, and a
 * contentEditable span sitting on the baseline (measured with a zero-size
 * probe so any font's ascent is handled). Justified lines keep their
 * stretched word spacing; underlines follow the new text. The grip on the
 * left drags the line anywhere, snapping to the page centre and margins.
 */
const EditBlock = ({
  rec, scale, view, R = 0, margins, active, fontCss, onText, onKey, onActivate, registerEl, onMove, onBeginMove,
}) => {
  const probeRef = useRef(null);
  const editRef = useRef(null);
  const drag = useRef(null);
  const [baseOff, setBaseOff] = useState(null);
  const [fontTick, setFontTick] = useState(0);
  const [textW, setTextW] = useState(0);
  const [guide, setGuide] = useState(null); // pt x of a snap guide while dragging
  const caretDone = useRef(false);
  const fontPx = rec.size * scale;
  const { bold, italic } = styleOf(rec);

  const measure = useCallback(() => {
    if (probeRef.current) setBaseOff(probeRef.current.offsetTop);
  }, []);
  useLayoutEffect(measure, [measure, fontCss, fontPx, bold, italic]);
  useEffect(() => {
    let alive = true;
    document.fonts?.ready.then(() => { if (alive) { measure(); setFontTick((t) => t + 1); } });
    return () => { alive = false; };
  }, [measure, fontCss]);

  // Word spacing (pt) that keeps a justified line as wide as it was.
  const { ws, cs } = useMemo(() => {
    if (!rec.justify) return { ws: 0, cs: 0 };
    const t = rec.text.replace(/\s+$/, '');
    return justifyFit(rec, textWidth(t, fontCss, rec.size, bold, italic), t.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.justify, rec.text, rec.size, rec.origWidth, rec.origExtra, fontCss, bold, italic, fontTick]);

  // Rendered text width (for centre / right alignment and the underline).
  useLayoutEffect(() => {
    if (editRef.current) setTextW(editRef.current.offsetWidth);
  }, [rec.text, ws, cs, fontCss, fontPx, bold, italic, baseOff, fontTick]);

  // Uncontrolled: set the text once, then the browser owns the caret.
  useEffect(() => {
    if (editRef.current) editRef.current.textContent = rec.text;
    registerEl(rec.id, editRef.current);
    return () => registerEl(rec.id, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Place the caret once per activation (where the user clicked, else at the
  // end) — never again while they're typing, even if a font load re-measures.
  useEffect(() => {
    if (!active) { caretDone.current = false; return; }
    if (baseOff == null || caretDone.current) return;
    const el = editRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const sel = window.getSelection();
    let range = null;
    if (rec.caret && document.caretRangeFromPoint) {
      const r = document.caretRangeFromPoint(rec.caret.x, rec.caret.y);
      if (r && el.contains(r.startContainer)) range = r;
    }
    caretDone.current = true;
    if (!range) {
      range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
    }
    sel.removeAllRanges();
    sel.addRange(range);
  }, [active, baseOff, rec.caret]);

  /* ---- drag to move ---- */
  const widthPt = textW / scale;
  const startDrag = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (!active) onActivate(rec.id);
    drag.current = { sx: e.clientX, sy: e.clientY, ax: anchorX(rec), by: baseY(rec), began: false };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
  };
  const moveDrag = (e) => {
    const d = drag.current;
    if (!d) return;
    const f = deltaToFrame(e.clientX - d.sx, e.clientY - d.sy, R);
    if (!d.began) {
      if (Math.abs(f.x) + Math.abs(f.y) < 2) return;
      d.began = true;
      onBeginMove(rec.id);
    }
    let ax = d.ax + f.x / scale;
    const by = d.by - f.y / scale;
    // Snap: page centre, left margin, right margin.
    const left = placeX({ ...rec, ax }, widthPt);
    const pageMid = (view[0] + view[2]) / 2;
    let g = null;
    if (Math.abs(left + widthPt / 2 - pageMid) < SNAP) { ax += pageMid - (left + widthPt / 2); g = pageMid; } else if (margins && Math.abs(left - margins.left) < SNAP) { ax += margins.left - left; g = margins.left; } else if (margins && Math.abs(left + widthPt - margins.right) < SNAP) { ax += margins.right - (left + widthPt); g = margins.right; }
    setGuide(g);
    onMove(rec.id, { ax, by });
  };
  const endDrag = () => { drag.current = null; setGuide(null); };

  const left = (placeX(rec, widthPt) - view[0]) * scale;
  const base = (view[3] - baseY(rec)) * scale;
  const origBase = (view[3] - rec.y) * scale;
  const ul = underlineOf(rec);
  const top = base - (baseOff ?? fontPx * 0.8);
  const boxH = fontPx * 1.2;

  return (
    <>
      {rec.kind === 'line' && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: (rec.x0 - view[0]) * scale - 1.5,
            top: origBase - rec.origSize * scale * 0.95 - 1.5,
            width: (rec.x1 - rec.x0) * scale + 3,
            height: rec.origSize * scale * 1.27 + 3,
            background: rec.bg,
          }}
        />
      )}
      {/* the original underline, hidden (it's redrawn to fit the new text) */}
      {(rec.ulRules || []).map((u) => (
        <div
          key={`${u.x0}:${u.y}`}
          className="pointer-events-none absolute"
          style={{
            left: (u.x0 - view[0]) * scale - 1,
            top: (view[3] - u.y - u.t / 2) * scale - 1,
            width: (u.x1 - u.x0) * scale + 2,
            height: u.t * scale + 2,
            background: rec.bg,
          }}
        />
      ))}
      {guide != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 border-l border-dashed border-pink-500"
          style={{ left: (guide - view[0]) * scale, height: (view[3] - view[1]) * scale }}
        />
      )}
      {ul && textW > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left,
            top: base + (ul.offset - ul.t / 2) * scale,
            width: textW,
            height: Math.max(1, ul.t * scale),
            background: ul.color,
          }}
        />
      )}
      <div
        data-fq-keep=""
        className={`group absolute whitespace-pre rounded-[2px] ${active ? 'outline outline-2 outline-offset-2 outline-blue-500/80' : 'cursor-text hover:outline hover:outline-1 hover:outline-blue-400/70'}`}
        style={{
          left,
          top,
          fontFamily: fontCss,
          fontSize: fontPx,
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? 'italic' : 'normal',
          wordSpacing: ws ? ws * scale : undefined,
          letterSpacing: cs ? cs * scale : undefined,
          fontKerning: 'normal',
          color: rec.color,
          lineHeight: 'normal',
          visibility: baseOff == null ? 'hidden' : 'visible',
          minWidth: 6,
        }}
        onMouseDown={() => { if (!active) onActivate(rec.id); }}
      >
        <span ref={probeRef} style={{ display: 'inline-block', width: 0, height: 0, verticalAlign: 'baseline' }} />
        <span
          ref={editRef}
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          className="outline-none"
          style={{ caretColor: '#2563eb' }}
          onInput={(e) => onText(rec.id, e.currentTarget.textContent || '')}
          onKeyDown={(e) => onKey(rec.id, e)}
          onPaste={(e) => {
            e.preventDefault();
            const t = (e.clipboardData.getData('text/plain') || '').replace(/[\r\n]+/g, ' ');
            document.execCommand('insertText', false, t);
          }}
          onDrop={(e) => e.preventDefault()}
        />
        {/* drag grip */}
        <span
          data-fq-keep=""
          data-fq-grip=""
          title="Drag to move"
          aria-label="Drag to move"
          className={`absolute top-1/2 grid -translate-y-1/2 cursor-grab place-items-center rounded-md bg-blue-600 text-white shadow-md transition-opacity active:cursor-grabbing ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
          style={{
            left: -Math.max(18, Math.min(26, boxH * 0.75)) - 6,
            width: Math.max(18, Math.min(26, boxH * 0.75)),
            height: Math.max(22, Math.min(32, boxH)),
            touchAction: 'none',
            fontSize: 0,
          }}
          contentEditable={false}
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <LuGripVertical className="h-4 w-4" />
        </span>
      </div>
    </>
  );
};

export default EditBlock;

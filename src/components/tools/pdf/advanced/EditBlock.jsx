import React, {
  useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState,
} from 'react';
import { styleOf, underlineOf, wordSpacingFor } from './records';
import { textWidth } from './measure';

/**
 * One edited / new line of text: a cover hiding the original pixels, and a
 * contentEditable span sitting exactly on the original baseline (measured
 * with a zero-size probe so any font's ascent is handled). Justified lines
 * keep their stretched word spacing; underlines follow the new text.
 */
const EditBlock = ({
  rec, scale, view, active, fontCss, onText, onKey, onActivate, registerEl,
}) => {
  const probeRef = useRef(null);
  const editRef = useRef(null);
  const [baseOff, setBaseOff] = useState(null);
  const [fontTick, setFontTick] = useState(0);
  const [textW, setTextW] = useState(0);
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
  const ws = useMemo(() => {
    if (!rec.justify) return 0;
    return wordSpacingFor(rec, textWidth(rec.text, fontCss, rec.size, bold, italic));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rec.justify, rec.text, rec.size, rec.origWidth, rec.origExtra, fontCss, bold, italic, fontTick]);

  // Rendered text width, for the underline.
  const ul = underlineOf(rec);
  const needW = !!ul || rec.align === 'center';
  useLayoutEffect(() => {
    if (needW && editRef.current) setTextW(editRef.current.offsetWidth);
  }, [needW, rec.text, ws, fontCss, fontPx, bold, italic, baseOff, fontTick]);

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

  // Centred lines (e.g. a heading) stay centred as the text changes.
  const left = rec.align === 'center' ? (rec.cx - view[0]) * scale - textW / 2 : (rec.x0 - view[0]) * scale;
  const baseY = (view[3] - rec.y) * scale;

  return (
    <>
      {rec.kind === 'line' && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: (rec.x0 - view[0]) * scale - 1.5,
            top: baseY - rec.origSize * scale * 0.95 - 1.5,
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
      {ul && textW > 0 && (
        <div
          className="pointer-events-none absolute"
          style={{
            left,
            top: baseY + (ul.offset - ul.t / 2) * scale,
            width: textW,
            height: Math.max(1, ul.t * scale),
            background: ul.color,
          }}
        />
      )}
      <div
        data-fq-keep=""
        className={`absolute whitespace-pre rounded-[2px] ${active ? 'outline outline-2 outline-offset-2 outline-blue-500/80' : 'cursor-text hover:outline hover:outline-1 hover:outline-blue-400/70'}`}
        style={{
          left,
          top: baseY - (baseOff ?? fontPx * 0.8),
          fontFamily: fontCss,
          fontSize: fontPx,
          fontWeight: bold ? 700 : 400,
          fontStyle: italic ? 'italic' : 'normal',
          wordSpacing: ws ? ws * scale : undefined,
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
      </div>
    </>
  );
};

export default EditBlock;

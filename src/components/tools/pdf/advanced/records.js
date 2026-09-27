/** Font value meaning "keep the PDF's own embedded font". */
export const ORIGINAL = '__original__';

/** Has this text record actually changed anything (worth saving)? */
export const isChanged = (r) => {
  if (r.kind === 'new') return r.text.trim() !== '';
  return r.text !== r.origText
    || r.family !== r.init.family || r.bold !== r.init.bold || r.italic !== r.init.italic
    || r.size !== r.init.size || r.color !== r.init.color || !!r.underline !== !!r.init.underline
    || moved(r) || !!r.justify !== !!r.init.justify;
};

/**
 * Where a line is drawn. `align` + `ax` is the anchor (left edge, centre or
 * right edge) and `by` the baseline — both move when the text is dragged or
 * re-aligned; x0/x1/y always stay the ORIGINAL spot (what gets removed).
 */
export const anchorX = (r) => r.ax ?? (r.align === 'center' ? r.cx : r.x0);
export const baseY = (r) => r.by ?? r.y;
export function placeX(r, width) {
  const a = anchorX(r);
  if (r.align === 'center') return a - width / 2;
  if (r.align === 'right') return a - width;
  return a;
}
export const moved = (r) => (r.by != null && Math.abs(r.by - r.y) > 0.01)
  || (r.ax != null && Math.abs(r.ax - (r.align === 'center' ? r.cx : r.x0)) > 0.01)
  || (r.align || 'left') !== (r.init.align || 'left');

/** Effective bold / italic (the PDF's own font carries its style itself). */
export const styleOf = (r) => (r.family === ORIGINAL
  ? { bold: !!r.origBold, italic: !!r.origItalic }
  : { bold: !!r.bold, italic: !!r.italic });

const spacesIn = (s) => (String(s).replace(/\s+$/, '').match(/ /g) || []).length;

/**
 * Extra space (pt) to add at every space so an edited line keeps the look of
 * the original. Justified lines (Word's "Justify") are stretched to their
 * original width again; if the new text is much shorter, the original extra
 * spacing is kept instead of opening huge gaps.
 */
export function justifyFit(r, natural, nChars) {
  const none = { ws: 0, cs: 0 };
  if (!r.justify) return none;
  const n = spacesIn(r.text);
  const extra = r.origWidth - natural;
  if (extra >= 0) return { ws: wordSpacingFor(r, natural), cs: 0 };
  // Too wide (e.g. made bold): close up the spaces (to half a space at
  // most), then tighten letters a little — like Word's justify.
  const ws = n ? Math.max(-0.12 * r.size, extra / n) : 0;
  const rest = extra - ws * n;
  const cs = rest < 0 && nChars > 1 ? Math.max(-0.05 * r.size, rest / nChars) : 0;
  return { ws, cs };
}

export function wordSpacingFor(r, natural) {
  if (!r.justify) return 0;
  const n = spacesIn(r.text);
  if (!n) return 0;
  const fill = (r.origWidth - natural) / n;
  if (fill <= 0) return 0;
  // Much sparser than the original line (e.g. half the words deleted): keep
  // the original spacing instead of opening huge gaps.
  if (fill > Math.max(r.size * 0.6, (r.origExtra || 0) * 1.6)) return Math.min(fill, r.origExtra || 0);
  return fill;
}

/** Underline geometry for a record, in pt: offset below baseline, thickness, colour. */
export function underlineOf(r) {
  if (!r.underline) return null;
  const ul = r.ul || { offsetEm: 0.12, tEm: 0.06, color: null };
  return {
    offset: ul.offsetEm * r.size,
    t: Math.max(0.4, ul.tEm * r.size),
    color: ul.color && r.color === r.init.color ? ul.color : r.color,
  };
}

/** Starting styles for each drawing tool (user can change them in the bar). */
export const TOOL_DEFAULTS = {
  whiteout: { color: '#ffffff' },
  highlight: { color: '#facc15' },
  underline: { color: '#dc2626', width: 1.5 },
  strike: { color: '#dc2626', width: 1.5 },
  rect: { color: '#dc2626', width: 2, fill: '' },
  ellipse: { color: '#dc2626', width: 2, fill: '' },
  line: { color: '#dc2626', width: 2 },
  pen: { color: '#1d4ed8', width: 2 },
  link: { url: '' },
  'field-text': {},
  'field-check': {},
  table: {
    rows: 3, cols: 3, family: 'Arial', size: 11, color: '#000000', border: '#000000', bw: 0.75, headerBold: false,
  },
  text: {
    family: 'Arial', size: 12, color: '#000000', bold: false, italic: false,
  },
};

export const TOOL_LABELS = {
  select: 'Select',
  text: 'Text',
  link: 'Link',
  'field-text': 'Text field',
  'field-check': 'Checkbox',
  whiteout: 'Whiteout',
  highlight: 'Highlight',
  underline: 'Underline',
  strike: 'Strikethrough',
  pen: 'Freehand',
  rect: 'Rectangle',
  ellipse: 'Ellipse',
  line: 'Line',
  image: 'Image',
  table: 'Table',
};

export const TOOL_HINTS = {
  select: 'Scroll freely and select things. Pick Text to edit words, or any tool above.',
  text: 'Click any text to edit it, or click an empty spot to add new text.',
  link: 'Drag a box over the text or area that should open a web address.',
  'field-text': 'Drag a box where people should type (a fillable field).',
  'field-check': 'Click where a tick box should go.',
  whiteout: 'Drag over anything you want to hide with a white box.',
  highlight: 'Drag over text to highlight it.',
  underline: 'Drag along text to underline it.',
  strike: 'Drag along text to strike it through.',
  pen: 'Draw freely on the page.',
  rect: 'Drag to draw a rectangle.',
  ellipse: 'Drag to draw an ellipse.',
  line: 'Drag to draw a line.',
  table: 'Click on the page to place the table, or drag to size it. Tab jumps to the next cell.',
};

/** Tools that create an object by dragging a box on the page. */
export const DRAG_TOOLS = new Set([
  'whiteout', 'highlight', 'underline', 'strike', 'rect', 'ellipse', 'line', 'link', 'field-text', 'field-check', 'table',
]);

/* ------------------------------ tables ------------------------------ */

export const CELL_PAD_X = 5; // pt, like Word's 0.08" cell margins
export const CELL_PAD_Y = 2.5;
export const LINE_H = 1.2; // line height, em

/** Actual row heights (pt): the minimum height, or what the text needs. */
export const tableRowHeights = (o) => o.rowH.map((h, i) => Math.max(h, (o.rowAuto && o.rowAuto[i]) || 0));

/** Empty rows x cols grid of strings. */
export const emptyCells = (rows, cols) => Array.from({ length: rows }, () => Array(cols).fill(''));

/** Font value meaning "keep the PDF's own embedded font". */
export const ORIGINAL = '__original__';

/** Has this text record actually changed anything (worth saving)? */
export const isChanged = (r) => {
  if (r.kind === 'new') return r.text.trim() !== '';
  return r.text !== r.origText
    || r.family !== r.init.family || r.bold !== r.init.bold || r.italic !== r.init.italic
    || r.size !== r.init.size || r.color !== r.init.color;
};

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
  text: {
    family: 'Arial', size: 12, color: '#000000', bold: false, italic: false,
  },
};

export const TOOL_LABELS = {
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
};

export const TOOL_HINTS = {
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
};

/** Tools that create an object by dragging a box on the page. */
export const DRAG_TOOLS = new Set([
  'whiteout', 'highlight', 'underline', 'strike', 'rect', 'ellipse', 'line', 'link', 'field-text', 'field-check',
]);

let ctx = null;

/** Width of text in CSS px (pass size in pt to get pt) in the given font stack. */
export function textWidth(text, fontCss, size, bold, italic) {
  if (!ctx) ctx = document.createElement('canvas').getContext('2d');
  ctx.font = `${italic ? 'italic ' : ''}${bold ? 700 : 400} ${size}px ${fontCss}`;
  return ctx.measureText(String(text).replace(/\s+$/, '')).width;
}

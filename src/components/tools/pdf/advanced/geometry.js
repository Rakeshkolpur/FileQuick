/**
 * Every page is laid out in its own unrotated frame (PDF points, top-left
 * origin, times `scale` for CSS px) and the whole frame is CSS-rotated for
 * display. Text, objects and hit-testing all live in the frame, so editing
 * works the same on rotated pages.
 */

/** Size of the on-screen box that holds a W×H frame rotated by R degrees. */
export const rotatedBox = (W, H, R) => (R % 180 ? { w: H, h: W } : { w: W, h: H });

/** CSS transform (origin top-left) that rotates the frame into that box. */
export function frameTransform(W, H, R) {
  if (R === 90) return `translate(${H}px, 0px) rotate(90deg)`;
  if (R === 180) return `translate(${W}px, ${H}px) rotate(180deg)`;
  if (R === 270) return `translate(0px, ${W}px) rotate(270deg)`;
  return 'none';
}

/** A point in the rotated box (px from its top-left) -> frame px. */
export function toFrame(dx, dy, W, H, R) {
  if (R === 90) return { x: dy, y: H - dx };
  if (R === 180) return { x: W - dx, y: H - dy };
  if (R === 270) return { x: W - dy, y: dx };
  return { x: dx, y: dy };
}

/** A screen-space movement -> the same movement in frame px. */
export function deltaToFrame(dx, dy, R) {
  if (R === 90) return { x: dy, y: -dx };
  if (R === 180) return { x: -dx, y: -dy };
  if (R === 270) return { x: -dy, y: dx };
  return { x: dx, y: dy };
}

export const norm = (deg) => (((deg % 360) + 360) % 360);

/** Rectangle from two corner points, always positive width/height. */
export const rectFrom = (a, b) => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  w: Math.abs(b.x - a.x),
  h: Math.abs(b.y - a.y),
});

/** SVG path for a freehand stroke. */
export const penPath = (points) => points
  .map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
  .join(' ');

/**
 * Apply rotation (any angle), 90° orientation and flips to an image,
 * returning a canvas sized to the rotated bounding box.
 */
export function transformToCanvas(img, { rotation = 0, straighten = 0, flipH = false, flipV = false } = {}) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const angle = (((rotation + straighten) % 360) + 360) % 360;
  const rad = (angle * Math.PI) / 180;

  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const bw = Math.max(1, Math.round(sw * cos + sh * sin));
  const bh = Math.max(1, Math.round(sw * sin + sh * cos));

  const canvas = document.createElement('canvas');
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(bw / 2, bh / 2);
  ctx.rotate(rad);
  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
  ctx.drawImage(img, -sw / 2, -sh / 2, sw, sh);
  return canvas;
}

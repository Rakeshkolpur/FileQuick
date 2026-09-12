/**
 * Cheap, dependency-free "smart fill" for a painted-over region: repeatedly
 * blurs the current image and blends the blur back in ONLY inside the mask,
 * with a shrinking radius each pass. This is not real AI inpainting — there
 * is no model, it just diffuses nearby colour and texture inward — but it
 * reads convincingly for a small or semi-transparent watermark over a fairly
 * flat area. A large, sharp logo on a busy photo can still leave a soft trace;
 * the Erase-only fallback (paint white/transparent) is there for that case.
 *
 * @param {HTMLCanvasElement} imageCanvas  mutated in place
 * @param {HTMLCanvasElement} maskCanvas   same size; painted area is opaque
 */
export function smartFill(imageCanvas, maskCanvas) {
  const w = imageCanvas.width;
  const h = imageCanvas.height;
  if (!w || !h) return;
  const ctx = imageCanvas.getContext('2d');
  const scratch = document.createElement('canvas');
  scratch.width = w;
  scratch.height = h;
  const sctx = scratch.getContext('2d');

  // Wide-to-narrow blur passes pull in colour from further away first, then
  // sharpen the fill up with local detail on the last couple of passes.
  const longEdge = Math.max(w, h);
  const radii = [0.05, 0.032, 0.02, 0.012, 0.007, 0.004, 0.002]
    .map((f) => Math.max(1, Math.round(f * longEdge)));

  radii.forEach((r) => {
    sctx.clearRect(0, 0, w, h);
    sctx.filter = `blur(${r}px)`;
    sctx.drawImage(imageCanvas, 0, 0);
    sctx.filter = 'none';
    sctx.globalCompositeOperation = 'destination-in';
    sctx.drawImage(maskCanvas, 0, 0);
    sctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(scratch, 0, 0);
  });
}

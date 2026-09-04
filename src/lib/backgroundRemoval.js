import { loadImageFromFile } from './imageResize';

let _mod = null;
async function lib() {
  if (!_mod) _mod = await import('@imgly/background-removal');
  return _mod;
}

/** Warm up the model in the background (optional). */
export async function preloadBackgroundModel() {
  try {
    const { preload } = await lib();
    if (preload) await preload();
  } catch (_) {
    /* non-fatal */
  }
}

/**
 * Cut the background out of an image.
 * @param {Blob|string} source
 * @param {(fraction:number)=>void} [onProgress] 0..1
 * @param {{ hq?: boolean, refine?: boolean }} [opts]
 *   hq     — use the full `isnet` model (heavier download, sharper hair/edges)
 *   refine — tighten + decontaminate the alpha edge afterwards (matte.js)
 * @returns {Promise<Blob>} transparent PNG
 */
export async function cutoutBackground(source, onProgress, opts = {}) {
  const { removeBackground } = await lib();
  const raw = await removeBackground(source, {
    model: opts.hq ? 'isnet' : 'isnet_fp16',
    output: { format: 'image/png', quality: 1 },
    progress: (_key, current, total) => {
      if (onProgress && total) onProgress(Math.min(0.97, current / total) * (opts.refine ? 0.9 : 1));
    },
  });
  if (!opts.refine) return raw;
  const { refineCutout } = await import('./matte');
  const clean = await refineCutout(raw);
  onProgress?.(1);
  return clean;
}

/** Load a transparent PNG blob into an <img>. */
export function loadCutout(blob) {
  return loadImageFromFile(blob);
}

/**
 * Paint a cutout onto a solid background colour.
 * @param {HTMLImageElement} cutoutImg
 * @param {string} color  css colour, or 'transparent'
 * @returns {HTMLCanvasElement}
 */
export function compositeOnColor(cutoutImg, color) {
  const w = cutoutImg.naturalWidth || cutoutImg.width;
  const h = cutoutImg.naturalHeight || cutoutImg.height;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (color && color !== 'transparent') {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(cutoutImg, 0, 0);
  return canvas;
}

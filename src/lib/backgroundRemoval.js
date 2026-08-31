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
 * @returns {Promise<Blob>} transparent PNG
 */
export async function cutoutBackground(source, onProgress) {
  const { removeBackground } = await lib();
  return removeBackground(source, {
    // isnet_fp16 (the library default) — highest-accuracy general segmentation model.
    model: 'isnet_fp16',
    output: { format: 'image/png' },
    progress: (_key, current, total) => {
      if (onProgress && total) onProgress(Math.min(1, current / total));
    },
  });
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

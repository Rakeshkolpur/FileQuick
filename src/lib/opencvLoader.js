// Lazy-load OpenCV.js (WebAssembly, ~9 MB) once. Only the Document Scanner
// pulls this in, and the browser caches the wasm after the first visit.

let _cv = null;

export function getCv() {
  if (_cv) return _cv;
  _cv = import('@techstark/opencv-js').then(async (m) => {
    const mod = m.default || m;
    if (mod instanceof Promise) return mod;
    if (mod && mod.Mat) return mod;
    await new Promise((resolve) => {
      mod.onRuntimeInitialized = () => resolve();
    });
    return mod;
  });
  return _cv;
}

export const preloadCv = () => { getCv().catch(() => {}); };

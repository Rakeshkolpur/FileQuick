import React, { useEffect, useMemo, useRef, useState } from 'react';
import RangeSlider from './RangeSlider';
import { smartFill } from '../../lib/inpaint';

const MAX_BOX_W = 620;
const MAX_BOX_H = 440;

/**
 * Paint over a watermark (or any unwanted mark) on a photo; Apply runs a
 * cheap, local "smart fill" that blends in colour and texture from around the
 * painted area — not AI inpainting, so it reads best on a small or faint mark
 * over a fairly plain area. "Just erase" is the honest fallback for a big,
 * sharp logo: it flattens the area to a flat colour instead of guessing.
 *
 * `image` — the source photo (HTMLImageElement). `onApply(canvas)` gets the
 * edited result as a plain canvas — the caller encodes it (format, quality)
 * however fits the job, since that varies by source file type here.
 */
const WatermarkBrushModal = ({ image, onApply, onClose }) => {
  const dataCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const scratchRef = useRef(null);
  const lastPointRef = useRef(null);
  const drawingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [flatColor, setFlatColor] = useState(null); // null = smart fill, else a plain colour to erase to

  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const shortSide = Math.max(1, Math.min(w, h));
  const brushBounds = useMemo(() => ({
    min: Math.max(3, Math.round(shortSide * 0.01)),
    max: Math.max(30, Math.round(shortSide * 0.18)),
  }), [shortSide]);
  const [brush, setBrush] = useState(() => Math.max(10, Math.round(shortSide * 0.045)));

  const scale = Math.min(1, MAX_BOX_W / w, MAX_BOX_H / h);
  const boxW = Math.round(w * scale);
  const boxH = Math.round(h * scale);

  useEffect(() => {
    const data = dataCanvasRef.current;
    data.width = w;
    data.height = h;
    data.getContext('2d').drawImage(image, 0, 0, w, h);

    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    maskCanvasRef.current = mask;

    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    scratchRef.current = scratch;

    const overlay = overlayCanvasRef.current;
    overlay.width = w;
    overlay.height = h;

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  const toCanvasPoint = (e) => {
    const rect = dataCanvasRef.current.getBoundingClientRect();
    const sx = dataCanvasRef.current.width / rect.width;
    const sy = dataCanvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  };

  const redrawOverlay = () => {
    const overlay = overlayCanvasRef.current;
    const octx = overlay.getContext('2d');
    octx.clearRect(0, 0, w, h);
    octx.drawImage(maskCanvasRef.current, 0, 0);
    octx.globalCompositeOperation = 'source-in';
    octx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    octx.fillRect(0, 0, w, h);
    octx.globalCompositeOperation = 'source-over';
  };

  const paintSegment = (p0, p1) => {
    const mctx = maskCanvasRef.current.getContext('2d');
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.lineWidth = brush * 2;
    mctx.strokeStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(p0.x, p0.y);
    mctx.lineTo(p1.x, p1.y);
    mctx.stroke();
    redrawOverlay();
  };

  const onPointerDown = (e) => {
    if (!ready) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const p = toCanvasPoint(e);
    drawingRef.current = true;
    lastPointRef.current = p;
    paintSegment(p, p);
    setDirty(true);
  };
  const onPointerMove = (e) => {
    const rect = dataCanvasRef.current.getBoundingClientRect();
    setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    if (!drawingRef.current) return;
    const p = toCanvasPoint(e);
    paintSegment(lastPointRef.current, p);
    lastPointRef.current = p;
  };
  const endStroke = () => { drawingRef.current = false; lastPointRef.current = null; };
  const onPointerLeave = () => { setCursor(null); endStroke(); };

  const clearMask = () => {
    maskCanvasRef.current.getContext('2d').clearRect(0, 0, w, h);
    redrawOverlay();
    setDirty(false);
  };

  const apply = () => {
    setApplying(true);
    setError(null);
    try {
      const data = dataCanvasRef.current;
      if (flatColor) {
        // Paint the flat colour only where the mask is: build the coloured
        // patch on the scratch canvas, masked to the painted shape, then lay
        // it over the image.
        const scratch = scratchRef.current;
        const sctx = scratch.getContext('2d');
        sctx.clearRect(0, 0, w, h);
        sctx.drawImage(maskCanvasRef.current, 0, 0);
        sctx.globalCompositeOperation = 'source-in';
        sctx.fillStyle = flatColor;
        sctx.fillRect(0, 0, w, h);
        sctx.globalCompositeOperation = 'source-over';
        data.getContext('2d').drawImage(scratch, 0, 0);
      } else {
        smartFill(data, maskCanvasRef.current);
      }
      onApply(data);
    } catch (err) {
      setError(err.message || 'Could not remove the watermark.');
      setApplying(false);
    }
  };

  const cursorDiameter = Math.max(6, brush * scale * 2);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">Paint over the watermark</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Paint over the mark, then Apply blends in a fill from the area around it. Not AI — best on a small or faint
          watermark over a fairly plain background.
        </p>

        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
          <div
            className="relative rounded-lg overflow-hidden touch-none select-none"
            style={{ width: boxW, height: boxH, cursor: 'none' }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          >
            <canvas ref={dataCanvasRef} style={{ width: boxW, height: boxH }} className="block touch-none" />
            <canvas
              ref={overlayCanvasRef}
              style={{ width: boxW, height: boxH }}
              className="absolute inset-0 touch-none"
              onPointerDown={onPointerDown}
            />
            {cursor && (
              <div
                className="pointer-events-none absolute rounded-full border-2 border-red-500 -translate-x-1/2 -translate-y-1/2"
                style={{ left: cursor.x, top: cursor.y, width: cursorDiameter, height: cursorDiameter }}
              />
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <RangeSlider label="Brush size" value={brush} min={brushBounds.min} max={brushBounds.max} onChange={setBrush} suffix="px" />
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 pb-1.5">
            <input
              type="checkbox"
              checked={!!flatColor}
              onChange={(e) => setFlatColor(e.target.checked ? '#ffffff' : null)}
              className="h-4 w-4 accent-purple-600"
            />
            Just erase to a flat colour instead
            {flatColor && (
              <input
                type="color"
                value={flatColor}
                onChange={(e) => setFlatColor(e.target.value)}
                className="h-6 w-6 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
              />
            )}
          </label>
        </div>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={apply}
            disabled={applying || !dirty}
            className="flex-1 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {applying ? 'Removing…' : 'Apply'}
          </button>
          {dirty && (
            <button type="button" onClick={clearMask} className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
              Clear painting
            </button>
          )}
          <button type="button" onClick={onClose} className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default WatermarkBrushModal;

import React, { useEffect, useMemo, useRef, useState } from 'react';
import RangeSlider from './RangeSlider';
import Segmented from './Segmented';
import { canvasToCutoutImage } from '../../lib/backgroundRemoval';

const MAX_BOX_W = 620;
const MAX_BOX_H = 440;

/**
 * Manual touch-up for an AI background cut-out: paint to erase a leftover
 * scrap of background, or restore a bit of the subject the model cut away
 * by mistake (stray hair, a finger, an earring…).
 *
 * `original` — the source photo the cutout was made from (HTMLImageElement).
 * `cutout`   — the current transparent-PNG result (HTMLImageElement).
 * `onApply(img, url)` — called with the edited cutout as a loaded <img> plus
 *   its object URL, in the same shape every caller already keeps its cutout in.
 * `onClose()` — cancel without applying.
 */
const MatteBrush = ({ original, cutout, onApply, onClose }) => {
  const dataCanvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const scratchCanvasRef = useRef(null);
  const lastPointRef = useRef(null);
  const drawingRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('erase');
  const [dirty, setDirty] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null); // { x, y } in on-screen px, relative to the canvas box

  const w = cutout.naturalWidth || cutout.width;
  const h = cutout.naturalHeight || cutout.height;
  const shortSide = Math.max(1, Math.min(w, h));
  const brushBounds = useMemo(() => ({
    min: Math.max(2, Math.round(shortSide * 0.006)),
    max: Math.max(24, Math.round(shortSide * 0.14)),
  }), [shortSide]);
  const [brush, setBrush] = useState(() => Math.max(6, Math.round(shortSide * 0.028)));

  const scale = Math.min(1, MAX_BOX_W / w, MAX_BOX_H / h);
  const boxW = Math.round(w * scale);
  const boxH = Math.round(h * scale);

  // Draw the starting cutout + prep the offscreen original / scratch canvases once.
  useEffect(() => {
    const data = dataCanvasRef.current;
    data.width = w;
    data.height = h;
    data.getContext('2d').drawImage(cutout, 0, 0, w, h);

    const orig = document.createElement('canvas');
    orig.width = w;
    orig.height = h;
    orig.getContext('2d').drawImage(original, 0, 0, w, h);
    originalCanvasRef.current = orig;

    const scratch = document.createElement('canvas');
    scratch.width = w;
    scratch.height = h;
    scratchCanvasRef.current = scratch;

    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutout, original]);

  const toCanvasPoint = (e) => {
    const rect = dataCanvasRef.current.getBoundingClientRect();
    const sx = dataCanvasRef.current.width / rect.width;
    const sy = dataCanvasRef.current.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy, rect };
  };

  const paintSegment = (p0, p1) => {
    const scratch = scratchCanvasRef.current;
    const sctx = scratch.getContext('2d');
    sctx.clearRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = 'source-over';
    sctx.lineCap = 'round';
    sctx.lineJoin = 'round';
    sctx.lineWidth = brush * 2;
    sctx.strokeStyle = '#fff';
    sctx.beginPath();
    sctx.moveTo(p0.x, p0.y);
    sctx.lineTo(p1.x, p1.y);
    sctx.stroke();

    const dctx = dataCanvasRef.current.getContext('2d');
    if (mode === 'erase') {
      dctx.globalCompositeOperation = 'destination-out';
      dctx.drawImage(scratch, 0, 0);
    } else {
      // Restore: mask the original photo by the stroke shape, then lay that
      // patch of real pixels back onto the cutout.
      sctx.globalCompositeOperation = 'source-in';
      sctx.drawImage(originalCanvasRef.current, 0, 0);
      dctx.globalCompositeOperation = 'source-over';
      dctx.drawImage(scratch, 0, 0);
    }
    dctx.globalCompositeOperation = 'source-over';
  };

  const onPointerDown = (e) => {
    if (!ready) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
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

  const resetEdits = () => {
    const data = dataCanvasRef.current;
    const ctx = data.getContext('2d');
    ctx.clearRect(0, 0, data.width, data.height);
    ctx.drawImage(cutout, 0, 0, data.width, data.height);
    setDirty(false);
  };

  const apply = async () => {
    setApplying(true);
    setError(null);
    try {
      const { img, url } = await canvasToCutoutImage(dataCanvasRef.current);
      onApply(img, url);
    } catch (err) {
      setError(err.message || 'Could not save the edit.');
    } finally {
      setApplying(false);
    }
  };

  const cursorDiameter = Math.max(4, brush * scale * 2);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">Touch up the cut-out</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
          Paint to <strong className="text-gray-600 dark:text-gray-300">erase</strong> a leftover scrap of background, or{' '}
          <strong className="text-gray-600 dark:text-gray-300">restore</strong> a bit of the subject that got cut away.
        </p>

        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-3">
          <div
            className="relative bg-checkered rounded-lg overflow-hidden touch-none select-none"
            style={{ width: boxW, height: boxH, cursor: 'none' }}
            onPointerMove={onPointerMove}
            onPointerLeave={onPointerLeave}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          >
            <canvas
              ref={dataCanvasRef}
              style={{ width: boxW, height: boxH }}
              className="block touch-none"
              onPointerDown={onPointerDown}
            />
            {cursor && (
              <div
                className={`pointer-events-none absolute rounded-full border-2 -translate-x-1/2 -translate-y-1/2 ${
                  mode === 'erase' ? 'border-red-500' : 'border-emerald-500'
                }`}
                style={{ left: cursor.x, top: cursor.y, width: cursorDiameter, height: cursorDiameter }}
              />
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
          <div>
            <span className="block mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">Brush</span>
            <Segmented
              options={[{ value: 'erase', label: 'Erase' }, { value: 'restore', label: 'Restore' }]}
              value={mode}
              onChange={setMode}
            />
          </div>
          <RangeSlider
            label="Brush size"
            value={brush}
            min={brushBounds.min}
            max={brushBounds.max}
            onChange={setBrush}
            suffix="px"
          />
        </div>

        {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 mt-3">
          <button
            type="button"
            onClick={apply}
            disabled={applying}
            className="flex-1 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50"
          >
            {applying ? 'Saving…' : 'Apply'}
          </button>
          {dirty && (
            <button type="button" onClick={resetEdits} className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
              Undo touch-ups
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

export default MatteBrush;

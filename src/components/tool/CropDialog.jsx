import React, { useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

const ASPECTS = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
];

const MAX_H = '56vh';

const fullCrop = () => ({ unit: '%', x: 5, y: 5, width: 90, height: 90 });
const aspectCrop = (a, w, h) => centerCrop(makeAspectCrop({ unit: '%', width: 90 }, a, w, h), w, h);

/**
 * Lightweight crop-in-place modal. Reused by any tool that wants a quick trim
 * without sending the user to the full Crop Image tool.
 *
 * @param {string}   src       image URL to crop
 * @param {(blob: Blob) => void} onApply  called with the cropped PNG
 * @param {() => void} onClose
 */
const CropDialog = ({ src, onApply, onClose }) => {
  const imgRef = useRef(null);
  const [crop, setCrop] = useState();
  const [completed, setCompleted] = useState(null);
  const [aspect, setAspect] = useState(null);
  const [busy, setBusy] = useState(false);

  const resetCropFor = (a) => {
    const img = imgRef.current;
    if (!img) return;
    setCrop(a ? aspectCrop(a, img.width, img.height) : fullCrop());
  };

  const onImgLoad = () => resetCropFor(aspect);

  const pickAspect = (a) => {
    setAspect(a);
    resetCropFor(a);
  };

  const apply = async () => {
    const img = imgRef.current;
    if (!img || !completed?.width) return;
    setBusy(true);
    try {
      const scaleX = img.naturalWidth / img.width;
      const scaleY = img.naturalHeight / img.height;
      const cw = Math.max(1, Math.round(completed.width * scaleX));
      const ch = Math.max(1, Math.round(completed.height * scaleY));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.getContext('2d').drawImage(
        img,
        completed.x * scaleX, completed.y * scaleY, cw, ch,
        0, 0, cw, ch,
      );
      const blob = await new Promise((res) => canvas.toBlob((b) => res(b), 'image/png'));
      onApply(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg flex-col rounded-2xl bg-white p-4 shadow-2xl dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900 dark:text-white">Crop photo</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
            aria-label="Close"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {ASPECTS.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={() => pickAspect(a.value)}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-medium ${
                aspect === a.value
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center overflow-hidden rounded-xl bg-checkered" style={{ maxHeight: MAX_H }}>
          <ReactCrop
            crop={crop}
            onChange={(_, p) => setCrop(p)}
            onComplete={(_, p) => setCompleted(p)}
            aspect={aspect ?? undefined}
            keepSelection
            ruleOfThirds
            style={{ maxHeight: MAX_H }}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              onLoad={onImgLoad}
              className="w-auto max-w-full select-none object-contain"
              style={{ maxHeight: MAX_H }}
            />
          </ReactCrop>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={busy || !completed?.width}
            className="rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-1.5 text-[13px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            {busy ? 'Cropping…' : 'Apply crop'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CropDialog;

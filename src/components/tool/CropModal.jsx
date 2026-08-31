import React, { useRef, useState } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import useObjectUrl from '../../hooks/useObjectUrl';

const ASPECTS = [
  { label: 'Free', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
];
const chip =
  'px-2.5 py-1 text-xs rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-purple-100 dark:hover:bg-purple-900/40';
const chipActive = 'px-2.5 py-1 text-xs rounded-md bg-purple-600 text-white';

const seedCrop = (a, w, h) =>
  a
    ? centerCrop(makeAspectCrop({ unit: '%', width: 85 }, a, w, h), w, h)
    : { unit: '%', x: 7.5, y: 7.5, width: 85, height: 85 };

const pctFromRect = (rect, w, h) => ({
  unit: '%',
  x: (rect.x / w) * 100,
  y: (rect.y / h) * 100,
  width: (rect.width / w) * 100,
  height: (rect.height / h) * 100,
});

/**
 * Crop dialog. Give it EITHER `file` (a File) or `src` (a URL/dataURL).
 * onApply is called with a rect { x, y, width, height } in the image's own pixels,
 * or null when the crop is removed.
 */
const CropModal = ({ file, src, naturalWidth, naturalHeight, initialRect, title, onApply, onClose }) => {
  const fileUrl = useObjectUrl(file || null);
  const url = src || fileUrl;
  const dims = useRef({ w: naturalWidth || 0, h: naturalHeight || 0 });

  const [aspect, setAspect] = useState(0);
  const [crop, setCrop] = useState(null);
  const [done, setDone] = useState(null);

  const seed = (a) => {
    const c = seedCrop(a, dims.current.w, dims.current.h);
    setCrop(c);
    setDone(c);
  };

  const onLoad = (e) => {
    const w = e.currentTarget.naturalWidth;
    const h = e.currentTarget.naturalHeight;
    dims.current = { w, h };
    if (initialRect && initialRect.width) {
      const c = pctFromRect(initialRect, w, h);
      setCrop(c);
      setDone(c);
    } else {
      seed(aspect);
    }
  };

  const apply = () => {
    if (!done || !done.width) {
      onClose();
      return;
    }
    const { w, h } = dims.current;
    onApply({
      x: Math.round((done.x / 100) * w),
      y: Math.round((done.y / 100) * h),
      width: Math.round((done.width / 100) * w),
      height: Math.round((done.height / 100) * h),
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl p-4 w-full max-w-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{title || 'Crop image'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">
            ✕
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ASPECTS.map((a) => (
            <button key={a.label} type="button" onClick={() => { setAspect(a.value); seed(a.value); }} className={aspect === a.value ? chipActive : chip}>
              {a.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center bg-gray-100 dark:bg-gray-900 rounded-lg p-2">
          {url && (
            <ReactCrop crop={crop} onChange={(_, p) => setCrop(p)} onComplete={(_, p) => setDone(p)} aspect={aspect || undefined}>
              <img src={url} alt={title || 'crop'} onLoad={onLoad} className="max-h-[60vh] w-auto object-contain" />
            </ReactCrop>
          )}
        </div>
        <div className="flex gap-2 mt-3">
          <button type="button" onClick={apply} className="flex-1 py-2 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700">
            Apply crop
          </button>
          {initialRect && (
            <button type="button" onClick={() => onApply(null)} className="py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm">
              Remove crop
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

export default CropModal;

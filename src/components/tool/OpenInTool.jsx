import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToolById } from '../../data/tools';
import { stashImage } from '../../lib/imageHandoff';

const ORDER = [
  'upscale-image',
  'crop-image',
  'resize-image',
  'profile-picture',
  'remove-background',
  'compress-image',
  'convert-image',
];

const SHORT = {
  'upscale-image': 'Upscale',
  'crop-image': 'Crop',
  'resize-image': 'Resize',
  'profile-picture': 'Profile picture',
  'remove-background': 'Remove background',
  'compress-image': 'Compress',
  'convert-image': 'Convert',
};

/**
 * A row of "carry this image into another tool" chips. Reuses the image every
 * tool already picks up on mount — no save / re-upload.
 *
 * @param {() => (Blob|File|string|Promise<Blob|File|string>)} getImage
 * @param {string[]} [exclude]  tool ids to hide (usually the current tool)
 * @param {string}   [heading]
 */
const OpenInTool = ({ getImage, exclude = [], heading = 'Keep going — send this image to' }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);

  const items = ORDER.filter((id) => !exclude.includes(id))
    .map((id) => getToolById(id))
    .filter(Boolean);
  if (!items.length) return null;

  const go = async (id) => {
    if (busy) return;
    setBusy(id);
    try {
      const img = await getImage?.();
      if (img) await stashImage(img);
    } catch {
      /* navigate anyway — the tool just opens empty */
    }
    navigate(`/${id}`);
  };

  return (
    <div>
      <p className="mb-2 text-[12px] font-medium text-gray-500 dark:text-gray-400">{heading}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => go(t.id)}
            disabled={!!busy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-medium text-gray-700 transition-colors hover:border-purple-300 hover:text-purple-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-purple-700 dark:hover:text-purple-300"
          >
            {SHORT[t.id] || t.title}
            {busy === t.id && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default OpenInTool;

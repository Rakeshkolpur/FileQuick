import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getToolById } from '../../data/tools';
import { stashPdf } from '../../lib/pdfHandoff';

const ORDER = [
  'merge-pdf',
  'organize-pdf',
  'split-pdf',
  'rotate-pdf',
  'crop-pdf',
  'delete-pages',
  'extract-pages',
  'page-numbers',
  'watermark-pdf',
  'pdf-editor',
  'fill-sign',
  'pdf-compressor',
];

const SHORT = {
  'merge-pdf': 'Merge',
  'organize-pdf': 'Organize pages',
  'split-pdf': 'Split',
  'rotate-pdf': 'Rotate',
  'crop-pdf': 'Crop pages',
  'delete-pages': 'Remove pages',
  'extract-pages': 'Extract pages',
  'page-numbers': 'Page numbers',
  'watermark-pdf': 'Watermark',
  'pdf-editor': 'Edit',
  'fill-sign': 'Fill & Sign',
  'pdf-compressor': 'Compress',
};

/**
 * A row of "carry this PDF into another PDF tool" chips — no save / re-upload.
 *
 * @param {() => (Blob|File|string|Promise<Blob|File|string>)} getPdf
 * @param {string[]} [exclude]  tool ids to hide (usually the current tool)
 * @param {string}   [heading]
 */
const OpenInPdfTool = ({ getPdf, exclude = [], heading = 'Keep going — send this PDF to' }) => {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);

  const items = ORDER.filter((id) => !exclude.includes(id))
    .map((id) => getToolById(id))
    .filter((t) => t && t.status !== 'soon');
  if (!items.length) return null;

  const go = async (id) => {
    if (busy) return;
    setBusy(id);
    try {
      const pdf = await getPdf?.();
      if (pdf) await stashPdf(pdf);
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

export default OpenInPdfTool;

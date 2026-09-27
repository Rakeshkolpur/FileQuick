import React, { useEffect, useState } from 'react';
import { openPdf, renderThumbnail } from '../../lib/pdfjs';

/**
 * The real pages of a PDF (a Blob), rendered with pdf.js — what the user
 * will actually download, not an approximation. Pages appear one by one.
 */
const PdfPagesPreview = ({ blob, width = 300, maxPages = 60, className = '' }) => {
  const [pages, setPages] = useState([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    setPages([]);
    setTotal(0);
    (async () => {
      const pdf = await openPdf(new Uint8Array(await blob.arrayBuffer()));
      if (!alive) return;
      setTotal(pdf.numPages);
      const n = Math.min(pdf.numPages, maxPages);
      for (let i = 1; i <= n; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        const t = await renderThumbnail(pdf, i, width * Math.min(2, window.devicePixelRatio || 1));
        if (!alive) return;
        setPages((p) => [...p, t]);
      }
    })().catch(() => {});
    return () => { alive = false; };
  }, [blob, width, maxPages]);

  return (
    <div className={className}>
      <div className="flex flex-wrap justify-center gap-5">
        {pages.map((p, i) => (
          <figure key={i} className="group" style={{ width }}>
            <div className="overflow-hidden rounded-md bg-white shadow-[0_2px_10px_rgba(15,23,42,0.12)] ring-1 ring-black/5 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_30px_-8px_rgba(15,23,42,0.35)]">
              <img src={p.dataUrl} alt={`Page ${i + 1}`} className="block w-full" style={{ aspectRatio: `${p.width} / ${p.height}` }} />
            </div>
            <figcaption className="mt-2 text-center text-xs font-medium text-gray-400">{`Page ${i + 1}`}</figcaption>
          </figure>
        ))}
        {total > pages.length && pages.length < Math.min(total, maxPages) && (
          <div className="grid place-items-center rounded-md bg-white/60 ring-1 ring-black/5 dark:bg-gray-800/60" style={{ width, aspectRatio: '1 / 1.414' }}>
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-gray-200 border-t-blue-600" />
          </div>
        )}
      </div>
      {total > maxPages && (
        <p className="mt-4 text-center text-xs text-gray-400">{`Showing the first ${maxPages} of ${total} pages`}</p>
      )}
    </div>
  );
};

export default PdfPagesPreview;

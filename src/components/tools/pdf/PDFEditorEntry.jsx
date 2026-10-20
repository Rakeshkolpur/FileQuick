import React, { Suspense, useEffect, useState } from 'react';
import FileDropzone from '../../tool/FileDropzone';
import { PDF_RENDER_MB } from '../../../lib/fileValidation';
import { hasPendingPdf, stashPdf } from '../../../lib/pdfHandoff';
import { withChunkRetry } from '../../../lib/chunkReload';

/**
 * The PDF Editor's front door. The editor itself needs pdf-lib + its own code
 * (~210 KB gz), which on a slow phone took seconds before even the upload box
 * appeared. This screen is tiny: it shows the upload box at once and fetches
 * the editor in the background; a chosen PDF is handed over through the usual
 * PDF handoff, which the editor picks up when it mounts.
 */
const loadEditor = () => import('./PDFTextEditor');
const Editor = React.lazy(withChunkRetry(loadEditor));

/** Called by preloadTool — warm the editor too, not just this screen. */
export const warm = () => { loadEditor().catch(() => {}); };

const Opening = () => (
  <div className="flex flex-col items-center justify-center py-24 text-gray-500">
    <div className="mb-3 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
    Opening your PDF…
  </div>
);

const PDFEditorEntry = (props) => {
  // a PDF handed over from another page (home card, "send to") opens directly
  const [ready, setReady] = useState(hasPendingPdf);

  useEffect(() => { warm(); }, []);

  if (ready) {
    return (
      <Suspense fallback={<Opening />}>
        <Editor {...props} />
      </Suspense>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <FileDropzone
        accept="application/pdf,.pdf"
        maxMB={PDF_RENDER_MB}
        onFiles={async (fs) => { if (await stashPdf(fs[0], fs[0].name)) setReady(true); }}
        paste={false}
        title="Drop a PDF to edit it"
        hint="edit existing text, add text, images, signatures, links, form fields, shapes & more"
        formats="Edits the PDF's real text in its own font — no white boxes"
      />
    </div>
  );
};

export default PDFEditorEntry;

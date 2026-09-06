// Carry the PDF the user just made from one PDF tool straight into the next —
// e.g. Merge → Split, or Rotate → Add page numbers — with no save/re-upload.
//
// The blob is held in module memory, which survives client-side navigation
// (OpenInPdfTool navigates without a full reload). A hard refresh loses it and
// the next tool just opens empty — acceptable.

let held = null; // { blob, name }
let inFlight = null; // kept alive across a StrictMode effect cleanup + re-run

/**
 * Stash a PDF for the next tool. Accepts a Blob/File or a blob:/http(s)/data: URL.
 * @returns {Promise<boolean>}
 */
export async function stashPdf(source, name = 'document') {
  try {
    const blob = typeof source === 'string'
      ? await fetch(source).then((r) => r.blob())
      : source;
    if (!blob || !blob.size) return false;
    held = { blob, name };
    return true;
  } catch {
    return false;
  }
}

/**
 * Wire the handoff into a tool: on mount, if a PDF was handed over, turn it
 * into a File and pass it to `onFile`. Returns a cleanup fn for useEffect.
 */
export function consumePdfHandoff(onFile, fallbackName = 'document') {
  const payload = held || inFlight;
  if (!payload) return () => {};
  held = null;
  inFlight = payload;
  let cancelled = false;
  Promise.resolve().then(() => {
    if (cancelled) return;
    inFlight = null;
    const name = (payload.name || fallbackName).replace(/\.pdf$/i, '');
    onFile(new File([payload.blob], `${name}.pdf`, { type: 'application/pdf' }));
  });
  return () => { cancelled = true; };
}

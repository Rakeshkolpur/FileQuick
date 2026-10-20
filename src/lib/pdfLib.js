/**
 * pdf-lib is ~175 KB gzipped. Helpers fetch it here, on first use, instead of
 * importing it at the top — so a tool's upload screen doesn't wait for it,
 * and image tools only pay for it when someone actually exports a PDF.
 */
let pending = null;

export const loadPdfLib = () => {
  if (!pending) pending = import('pdf-lib').catch((e) => { pending = null; throw e; });
  return pending;
};

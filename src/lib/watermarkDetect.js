/**
 * Find watermark-shaped text in a PDF: a run of text that shows up at
 * essentially the same spot on most pages (a stamped watermark), or several
 * times on one page (a tiled watermark) — as opposed to normal body text,
 * which differs page to page. No AI involved: this is a position-consistency
 * heuristic over pdf.js's text layer, so it only catches TEXT watermarks —
 * a logo/image stamp needs the manual "paint over" mode instead.
 *
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdf  an already-opened pdf.js document
 * @returns {Promise<Candidate[]>}
 *
 * @typedef {object} Occurrence
 * @property {number} page   1-based page number
 * @property {number} x      text origin x, in PDF user-space points
 * @property {number} y      text origin y, in PDF user-space points
 * @property {number} width
 * @property {number} height
 * @property {number} angle  degrees, text rotation
 *
 * @typedef {object} Candidate
 * @property {string} text
 * @property {Occurrence[]} occurrences
 * @property {number} pagesHit
 * @property {number} totalPages
 * @property {'high'|'medium'} confidence
 */

const MIN_LEN = 3;
const MAX_LEN = 80;
const MAX_CANDIDATES = 10;

export async function findWatermarkCandidates(pdf) {
  const totalPages = pdf.numPages;
  const byText = new Map();

  for (let p = 1; p <= totalPages; p += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await pdf.getPage(p);
    // eslint-disable-next-line no-await-in-loop
    const content = await page.getTextContent();
    const vp = page.getViewport({ scale: 1 });

    content.items.forEach((item) => {
      const text = (item.str || '').trim();
      if (text.length < MIN_LEN || text.length > MAX_LEN) return;
      const [a, b, c, d, e, f] = item.transform;
      const angle = Math.round(Math.atan2(b, a) * (180 / Math.PI));
      const width = item.width || Math.hypot(a, b) * text.length * 0.5;
      const height = item.height || Math.hypot(c, d) || 10;
      const rec = {
        page: p, x: e, y: f, width, height, angle, nx: e / vp.width, ny: f / vp.height,
      };
      if (!byText.has(text)) byText.set(text, []);
      byText.get(text).push(rec);
    });
    page.cleanup();
  }

  const candidates = [];
  byText.forEach((occ, text) => {
    const pagesHit = new Set(occ.map((o) => o.page)).size;
    const isTiledOnPage = occ.length > pagesHit * 1.5; // multiple hits per page
    if (pagesHit < 2 && !(totalPages === 1 && occ.length >= 2)) return;

    // One representative per page, to test whether the position holds steady.
    const perPage = new Map();
    occ.forEach((o) => { if (!perPage.has(o.page)) perPage.set(o.page, o); });
    const reps = [...perPage.values()];
    const meanNx = reps.reduce((s, o) => s + o.nx, 0) / reps.length;
    const meanNy = reps.reduce((s, o) => s + o.ny, 0) / reps.length;
    const varX = reps.reduce((s, o) => s + (o.nx - meanNx) ** 2, 0) / reps.length;
    const varY = reps.reduce((s, o) => s + (o.ny - meanNy) ** 2, 0) / reps.length;
    const positionStable = Math.sqrt(varX) < 0.04 && Math.sqrt(varY) < 0.04;
    const rotated = reps.some((o) => Math.abs(o.angle) > 5);
    const coverage = pagesHit / totalPages;

    // Neither "always in the same spot" nor "tiled" nor "on every page" — too
    // weak a signal to call it a watermark rather than coincidence.
    if (!positionStable && !isTiledOnPage && coverage < 1) return;

    const confidence = (positionStable || isTiledOnPage) && (rotated || coverage >= 0.8) ? 'high' : 'medium';
    candidates.push({ text, occurrences: occ, pagesHit, totalPages, confidence });
  });

  candidates.sort((a, b) => (b.confidence === 'high') - (a.confidence === 'high') || b.occurrences.length - a.occurrences.length);
  return candidates.slice(0, MAX_CANDIDATES);
}

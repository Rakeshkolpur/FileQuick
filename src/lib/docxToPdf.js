import { PDFDocument } from 'pdf-lib';

// docx-preview lays pages out in CSS pixels (96dpi). PDF works in points (72dpi).
const PX_TO_PT = 72 / 96;

let _docxPreview;
let _html2canvas;

const loadDeps = async () => {
  if (!_docxPreview) _docxPreview = import('docx-preview');
  if (!_html2canvas) _html2canvas = import('html2canvas');
  const [dp, h2c] = await Promise.all([_docxPreview, _html2canvas]);
  return { renderAsync: dp.renderAsync, html2canvas: h2c.default || h2c };
};

/**
 * Render a .docx into `container` with full styling (paragraph/character styles,
 * tables, images, lists, headers/footers, page size & margins) using docx-preview,
 * which parses the actual OOXML. Returns the page `<section>` elements.
 */
export async function renderDocx(data, container, styleContainer) {
  const { renderAsync } = await loadDeps();
  container.innerHTML = '';
  await renderAsync(data, container, styleContainer || container, {
    className: 'docx',
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    experimental: true,
    trimXmlDeclaration: true,
    useBase64URL: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
    renderEndnotes: true,
  });
  return [...container.querySelectorAll('.docx-wrapper > section.docx')];
}

const canvasToPngBytes = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Could not rasterize a page.'));
      return blob.arrayBuffer().then(resolve, reject);
    }, 'image/png');
  });

/**
 * Turn already-rendered docx page sections into a PDF whose pages match the
 * on-screen layout exactly (each page is captured with html2canvas and placed
 * at the document's own page size).
 */
export async function docxSectionsToPdf(sections, { scale = 2, onProgress } = {}) {
  if (!sections.length) throw new Error('Nothing to convert.');
  const { html2canvas } = await loadDeps();
  const pdf = await PDFDocument.create();

  for (let i = 0; i < sections.length; i += 1) {
    const section = sections[i];
    // eslint-disable-next-line no-await-in-loop
    const canvas = await html2canvas(section, {
      scale,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      imageTimeout: 20000,
      scrollX: 0,
      scrollY: 0,
    });

    const widthPt = section.offsetWidth * PX_TO_PT;
    const heightPt = Math.max(section.offsetHeight, section.scrollHeight) * PX_TO_PT;

    // eslint-disable-next-line no-await-in-loop
    const pngBytes = await canvasToPngBytes(canvas);
    // eslint-disable-next-line no-await-in-loop
    const image = await pdf.embedPng(pngBytes);
    const page = pdf.addPage([widthPt, heightPt]);
    page.drawImage(image, { x: 0, y: 0, width: widthPt, height: heightPt });

    if (onProgress) onProgress(i + 1, sections.length);
  }

  const bytes = await pdf.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

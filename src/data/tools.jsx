import React from 'react';

const Svg = ({ d }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={d} />
  </svg>
);

const I = {
  image: <Svg d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  compress: <Svg d="M19 14l-7 7m0 0l-7-7m7 7V3" />,
  crop: <Svg d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />,
  convert: <Svg d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />,
  scissors: <Svg d="M14.12 14.12L19 19M12 12l7-7m-7 7l-2.88 2.88M12 12L9.12 9.12m0 5.76a3 3 0 10-4.24 4.24 3 3 0 004.24-4.24zm0-5.76a3 3 0 10-4.24-4.24 3 3 0 004.24 4.24z" />,
  merge: <Svg d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />,
  pdf: <Svg d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  trash: <Svg d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />,
  organize: <Svg d="M4 6h16M4 10h16M4 14h16M4 18h16" />,
  unlock: <Svg d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />,
  lock: <Svg d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />,
  sign: <Svg d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />,
  text: <Svg d="M4 6h16M4 12h16M4 18h7" />,
  bg: <Svg d="M4 5a1 1 0 011-1h14a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM8 12l2 2 4-4" />,
  rotate: <Svg d="M4 4v5h5M4 9a8 8 0 0113.657-4M20 20v-5h-5M20 15A8 8 0 016.343 19" />,
  extract: <Svg d="M9 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2v-7M13 3h6v6M19 3l-8 8" />,
  hash: <Svg d="M9 4L7 20M17 4l-2 16M4 9h16M3 15h16" />,
  water: <Svg d="M12 3s6 6.5 6 11a6 6 0 11-12 0C6 9.5 12 3 12 3z" />,
  present: <Svg d="M3 4h18M4 4v9a2 2 0 002 2h12a2 2 0 002-2V4M9 20l3-4 3 4" />,
  grid: <Svg d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16" />,
  doc: <Svg d="M8 3h6l4 4v13a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v4h4M9 13h6M9 17h6" />,
  user: <Svg d="M15.5 8.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.5 20a7.5 7.5 0 0115 0" />,
  idcard: <Svg d="M3 6h18v12H3zM8 11a2 2 0 100-4 2 2 0 000 4zm-2 5a2.5 2.5 0 015 0M14 9h4M14 13h4" />,
  upscale: <Svg d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6M15 4h5v5M9 20H4v-5" />,
  scan: <Svg d="M4 7V5a1 1 0 011-1h2M4 17v2a1 1 0 001 1h2M20 7V5a1 1 0 00-1-1h-2M20 17v2a1 1 0 01-1 1h-2M4 12h16" />,
};

// category: 'image' | 'pdf'
const TOOLS = [
  // ============ IMAGE ============
  { id: 'resize-image', title: 'Resize Image', category: 'image', group: 'Resize & Crop', icon: I.image, popular: true,
    description: 'Change image dimensions by pixels, percentage, or a target file size.',
    load: () => import('../components/tools/image/ImageResize.jsx') },
  { id: 'crop-image', title: 'Crop Image', category: 'image', group: 'Resize & Crop', icon: I.crop,
    description: 'Crop, rotate and straighten images, with aspect and social-media presets.',
    load: () => import('../components/tools/image/ImageCrop.jsx') },
  { id: 'profile-picture', title: 'Profile Picture Maker', category: 'image', group: 'Resize & Crop', icon: I.user, popular: true, chrome: 'min',
    description: 'Crop a photo to the exact profile, post, story or cover size for WhatsApp, Instagram, Facebook, LinkedIn, YouTube and more.',
    load: () => import('../components/tools/image/ProfilePictureMaker.jsx') },
  { id: 'compress-image', title: 'Compress Image', category: 'image', group: 'Optimize', icon: I.compress, popular: true,
    description: 'Make an image file smaller by quality or a target size — same dimensions.',
    load: () => import('../components/tools/image/ImageCompress.jsx') },
  { id: 'remove-background', title: 'Remove Background', category: 'image', group: 'Enhance', icon: I.bg,
    description: 'Cut out the background and export a transparent PNG.',
    load: () => import('../components/tools/image/BackgroundRemover.jsx') },
  { id: 'upscale-image', title: 'Image Upscaler', category: 'image', group: 'Enhance', icon: I.upscale, popular: true,
    description: 'Enlarge a photo 2× or 4× with an in-browser AI model — sharper detail, no upload.',
    load: () => import('../components/tools/image/ImageUpscaler.jsx') },
  { id: 'document-scanner', title: 'Document Scanner', category: 'image', group: 'Enhance', icon: I.scan, popular: true, chrome: 'min',
    description: 'Turn phone photos of documents into clean, straightened scans — bulk upload, auto edge-detect, export to PDF.',
    load: () => import('../components/tools/image/DocumentScanner.jsx') },
  { id: 'convert-image', title: 'Convert Image', category: 'image', group: 'Convert', icon: I.convert,
    description: 'Turn images into a PDF, or convert between JPG, PNG and WebP.',
    load: () => import('../components/tools/image/ImageConvert.jsx') },

  // ============ PDF ============
  // -- Optimize --
  { id: 'pdf-compressor', title: 'Compress PDF', category: 'pdf', group: 'Optimize', icon: I.compress, popular: true,
    description: 'Shrink a PDF while keeping its text selectable (needs the conversion server).',
    load: () => import('../components/tools/pdf/PDFCompressor.jsx') },

  // -- Merge & Split --
  { id: 'merge-pdf', title: 'Merge PDF', category: 'pdf', group: 'Merge & Split', icon: I.merge, popular: true,
    description: 'Combine several PDFs and images into one document.',
    load: () => import('../components/tools/pdf/PDFMerge.jsx') },
  { id: 'split-pdf', title: 'Split PDF', category: 'pdf', group: 'Merge & Split', icon: I.scissors,
    description: 'Cut a PDF into separate files — by split points, every N pages, or one per page.',
    load: () => import('../components/tools/pdf/PDFSplit.jsx') },

  // -- View & Edit --
  { id: 'pdf-editor', title: 'PDF Editor', category: 'pdf', group: 'Edit', icon: I.pdf, popular: true, chrome: 'min',
    description: 'Add text, images and shapes to a PDF, or edit existing content.',
    load: () => import('../components/tools/pdf/PDFEditor.jsx') },
  { id: 'organize-pdf', title: 'Organize PDF', category: 'pdf', group: 'Pages', icon: I.organize,
    description: 'Reorder, rotate and remove pages with drag and drop.',
    load: () => import('../components/tools/pdf/PDFOrganize.jsx') },
  { id: 'rotate-pdf', title: 'Rotate PDF', category: 'pdf', group: 'Edit', icon: I.rotate,
    description: 'Turn all or selected pages 90° / 180° and save.',
    load: () => import('../components/tools/pdf/RotatePDF.jsx') },
  { id: 'crop-pdf', title: 'Crop PDF Page', category: 'pdf', group: 'Edit', icon: I.crop,
    description: 'Trim the page margins — drag a box or auto-trim white space.',
    load: () => import('../components/tools/pdf/CropPDF.jsx') },
  { id: 'delete-pages', title: 'Remove Pages', category: 'pdf', group: 'Pages', icon: I.trash,
    description: 'Pick the pages to delete — the rest are saved as a new PDF.',
    load: () => import('../components/tools/pdf/PDFDeletePages.jsx') },
  { id: 'extract-pages', title: 'Extract Pages', category: 'pdf', group: 'Pages', icon: I.extract,
    description: 'Pick the pages you want and save them as one new PDF.',
    load: () => import('../components/tools/pdf/ExtractPages.jsx') },
  { id: 'extract-images', title: 'Extract Images', category: 'pdf', group: 'Pages', icon: I.image,
    description: 'Save the photos and graphics embedded in a PDF as PNG files.',
    load: () => import('../components/tools/pdf/ExtractImages.jsx') },
  { id: 'page-numbers', title: 'Add Page Numbers', category: 'pdf', group: 'Pages', icon: I.hash,
    description: 'Stamp page numbers anywhere — position, format, start number, font and colour.',
    load: () => import('../components/tools/pdf/PageNumbers.jsx') },
  { id: 'watermark-pdf', title: 'Add Watermark', category: 'pdf', group: 'Pages', icon: I.water,
    description: 'Stamp text or a logo watermark — angle, opacity, tiled or centred.',
    load: () => import('../components/tools/pdf/WatermarkPDF.jsx') },
  { id: 'fill-sign', title: 'Fill & Sign', category: 'pdf', group: 'Edit', icon: I.sign, chrome: 'min',
    description: 'Add text, dates, checkmarks and your signature to a PDF — all in your browser.',
    load: () => import('../components/tools/pdf/PDFFillAndSign.jsx') },
  { id: 'extract-text', title: 'Extract Text', category: 'pdf', group: 'Edit', icon: I.text,
    description: 'Pull text out of a PDF — with OCR for scanned pages, all in your browser.',
    load: () => import('../components/tools/pdf/ExtractText.jsx') },

  // -- Convert to PDF --
  { id: 'image-to-pdf', title: 'Image to PDF', category: 'pdf', group: 'Convert to PDF', icon: I.image, popular: true,
    description: 'Combine JPG or PNG images into a single PDF.',
    load: () => import('../components/tools/conversion/JpgToPdf.jsx') },
  { id: 'word-to-pdf', title: 'Word to PDF', category: 'pdf', group: 'Convert to PDF', icon: I.doc,
    description: 'Convert a .docx to PDF keeping fonts, styles, tables and layout.',
    load: () => import('../components/tools/conversion/WordToPdf.jsx') },
  { id: 'powerpoint-to-pdf', title: 'PowerPoint to PDF', category: 'pdf', group: 'Convert to PDF', icon: I.present,
    description: 'Convert a PPT/PPTX presentation to PDF, keeping slide layout (needs the conversion server).',
    load: () => import('../components/tools/conversion/PowerPointToPdf.jsx') },
  { id: 'excel-to-pdf', title: 'Excel to PDF', category: 'pdf', group: 'Convert to PDF', icon: I.grid,
    description: 'Convert an XLS/XLSX/CSV spreadsheet to PDF, keeping sheet layout (needs the conversion server).',
    load: () => import('../components/tools/conversion/ExcelToPdf.jsx') },
  { id: 'text-to-pdf', title: 'Text to PDF', category: 'pdf', group: 'Convert to PDF', icon: I.text,
    description: 'Turn a plain-text file — or text you paste — into a clean PDF, all in your browser.',
    load: () => import('../components/tools/conversion/TextToPdf.jsx') },

  // -- Convert from PDF --
  { id: 'pdf-to-jpg', title: 'PDF to JPG', category: 'pdf', group: 'Convert from PDF', icon: I.image,
    description: 'Export PDF pages as JPG images.',
    load: () => import('../components/tools/conversion/PdfToJpg.jsx') },
  { id: 'pdf-to-word', title: 'PDF to Word', category: 'pdf', group: 'Convert from PDF', icon: I.doc, popular: true,
    description: 'Rebuild a PDF into an editable Word .docx — text, tables and images (needs the conversion server).',
    load: () => import('../components/tools/conversion/PdfToWord.jsx') },
  { id: 'pdf-to-powerpoint', title: 'PDF to PowerPoint', category: 'pdf', group: 'Convert from PDF', icon: I.present,
    description: 'Turn each PDF page into a slide in a .pptx deck (needs the conversion server).',
    load: () => import('../components/tools/conversion/PdfToPowerPoint.jsx') },
  { id: 'pdf-to-excel', title: 'PDF to Excel', category: 'pdf', group: 'Convert from PDF', icon: I.grid,
    description: 'Pull tables from a PDF into an .xlsx workbook (needs the conversion server).',
    load: () => import('../components/tools/conversion/PdfToExcel.jsx') },
  { id: 'pdf-to-text', title: 'PDF to Text', category: 'pdf', group: 'Convert from PDF', icon: I.text,
    description: 'Save a PDF as a plain-text file — with OCR for scanned pages, all in your browser.',
    load: () => import('../components/tools/pdf/ExtractText.jsx') },

  // -- Security --
  { id: 'unlock-pdf', title: 'Unlock PDF', category: 'pdf', group: 'Security', icon: I.unlock,
    description: 'Remove a PDF password and print / copy / edit restrictions (needs the conversion server).',
    load: () => import('../components/tools/pdf/PDFUnlock.jsx') },
  { id: 'protect-pdf', title: 'Protect PDF', category: 'pdf', group: 'Security', icon: I.lock,
    description: 'Add a password to a PDF so it asks for it on open (needs the conversion server).',
    load: () => import('../components/tools/pdf/PDFProtect.jsx') },
];

// These tools need the conversion server (server/ + LibreOffice). Until it's
// deployed and VITE_API_URL is set, show them as "coming soon" instead of a
// tool that can't work. Flip SERVER_TOOLS_COMING_SOON to false once it's live.
const SERVER_TOOLS_COMING_SOON = true;
const NEEDS_SERVER = new Set([
  'pdf-compressor',
  'word-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf',
  'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel',
  'unlock-pdf', 'protect-pdf',
]);
if (SERVER_TOOLS_COMING_SOON) {
  TOOLS.forEach((t) => { if (NEEDS_SERVER.has(t.id)) t.status = 'soon'; });
}

export const NAV_CATEGORIES = [
  { slug: 'image', label: 'Image Tools' },
  { slug: 'pdf', label: 'PDF Tools' },
  { slug: 'all', label: 'All Tools' },
];

const CATEGORY_TITLES = { image: 'Image Tools', pdf: 'PDF Tools' };

const GROUP_ORDER = {
  image: ['Resize & Crop', 'Optimize', 'Enhance', 'Convert'],
  pdf: ['Optimize', 'Merge & Split', 'Edit', 'Pages', 'Convert to PDF', 'Convert from PDF', 'Security'],
};

export const getAllTools = () => TOOLS;
export const getToolById = (id) => TOOLS.find((t) => t.id === id) || null;
export const getToolsByCategory = (slug) =>
  !slug || slug === 'all' ? TOOLS : TOOLS.filter((t) => t.category === slug);
export const getPopularTools = () => TOOLS.filter((t) => t.popular);

export const getMenuColumns = (slug) => {
  if (!slug || slug === 'all') {
    const pdf = getToolsByCategory('pdf');
    return [
      { title: 'Image Tools', to: '/image', tools: getToolsByCategory('image') },
      { title: 'PDF Tools', to: '/pdf', tools: pdf.filter((t) => t.popular), more: '/pdf' },
    ];
  }
  const order = GROUP_ORDER[slug] || [];
  const bucket = {};
  getToolsByCategory(slug).forEach((t) => {
    const g = t.group || 'More';
    (bucket[g] = bucket[g] || []).push(t);
  });
  const seen = new Set();
  const columns = [];
  order.forEach((g) => { if (bucket[g]) { columns.push({ title: g, tools: bucket[g] }); seen.add(g); } });
  Object.keys(bucket).forEach((g) => { if (!seen.has(g)) columns.push({ title: g, tools: bucket[g] }); });
  return columns;
};

export const getHomeSections = (categorySlug) => {
  if (categorySlug && categorySlug !== 'all') {
    return [{ id: categorySlug, title: CATEGORY_TITLES[categorySlug] || 'Tools', tools: getToolsByCategory(categorySlug) }];
  }
  return [
    { id: 'popular', title: 'Most Popular', tools: getPopularTools() },
    { id: 'image', title: 'Image Tools', tools: getToolsByCategory('image') },
    { id: 'pdf', title: 'PDF Tools', tools: getToolsByCategory('pdf') },
  ];
};

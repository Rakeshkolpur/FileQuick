import React from 'react';
import {
  LuImage, LuFileArchive, LuCrop, LuRepeat, LuScissors, LuCombine, LuFileText,
  LuTrash2, LuListOrdered, LuUnlock, LuLock, LuFileSignature, LuAlignLeft,
  LuEraser, LuRotateCw, LuFileOutput, LuHash, LuDroplet, LuPresentation,
  LuTable, LuFileType2, LuUser, LuContact, LuExpand, LuScanLine,
} from 'react-icons/lu';

const C = 'h-full w-full';
const I = {
  image: <LuImage className={C} />,
  compress: <LuFileArchive className={C} />,
  crop: <LuCrop className={C} />,
  convert: <LuRepeat className={C} />,
  scissors: <LuScissors className={C} />,
  merge: <LuCombine className={C} />,
  pdf: <LuFileText className={C} />,
  trash: <LuTrash2 className={C} />,
  organize: <LuListOrdered className={C} />,
  unlock: <LuUnlock className={C} />,
  lock: <LuLock className={C} />,
  sign: <LuFileSignature className={C} />,
  text: <LuAlignLeft className={C} />,
  bg: <LuEraser className={C} />,
  rotate: <LuRotateCw className={C} />,
  extract: <LuFileOutput className={C} />,
  hash: <LuHash className={C} />,
  water: <LuDroplet className={C} />,
  present: <LuPresentation className={C} />,
  grid: <LuTable className={C} />,
  doc: <LuFileType2 className={C} />,
  user: <LuUser className={C} />,
  idcard: <LuContact className={C} />,
  upscale: <LuExpand className={C} />,
  scan: <LuScanLine className={C} />,
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
  { id: 'passport-photo', title: 'Passport Photo Maker', category: 'image', group: 'Enhance', icon: I.idcard, popular: true, chrome: 'min',
    description: 'Make a passport / visa photo from a selfie — swap the background, size it for India, US, UK, Schengen and more, and lay out a printable sheet.',
    load: () => import('../components/tools/image/PassportPhotoMaker.jsx') },
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
// Of those, these six only need Python + a few small libraries — no
// LibreOffice (see server/requirements.txt) — so the desktop app bundles a
// tiny local engine for them (electron/main.cjs spawns it on 127.0.0.1:5000,
// matching lib/api.js's default — the tool components' existing health
// check just finds it, no other code change needed). Word/PowerPoint/Excel
// -> PDF genuinely need real LibreOffice and stay "coming soon" everywhere.
const DESKTOP_ENGINE_TOOLS = new Set([
  'pdf-compressor', 'pdf-to-word', 'pdf-to-powerpoint', 'pdf-to-excel', 'unlock-pdf', 'protect-pdf',
]);
const onDesktop = typeof window !== 'undefined' && !!window.fq && window.fq.isDesktop === true;
if (SERVER_TOOLS_COMING_SOON) {
  TOOLS.forEach((t) => {
    if (NEEDS_SERVER.has(t.id) && !(onDesktop && DESKTOP_ENGINE_TOOLS.has(t.id))) t.status = 'soon';
  });
}

export const NAV_CATEGORIES = [
  { slug: 'pdf', label: 'PDF Tools' },
  { slug: 'image', label: 'Image Tools' },
  { slug: 'all', label: 'All Tools' },
];
// `convert` and `ai` are still real category pages (linked from the homepage
// cards and reachable at /convert and /ai) — just not shown in the top nav.

const CATEGORY_TITLES = {
  image: 'Image Tools',
  pdf: 'PDF Tools',
  convert: 'Convert Tools',
  ai: 'AI Tools',
};

// Virtual categories — a curated slice of the real tools, not a `category` field.
const AI_TOOL_IDS = new Set([
  'upscale-image', 'remove-background', 'document-scanner', 'passport-photo',
  'profile-picture', 'pdf-to-word', 'pdf-to-text', 'extract-text',
]);
const isConvertTool = (t) => t.id === 'convert-image' || /convert/i.test(t.group || '');

export const getVirtualCategory = (key) => {
  if (key === 'ai') return TOOLS.filter((t) => AI_TOOL_IDS.has(t.id));
  if (key === 'convert') return TOOLS.filter(isConvertTool);
  return [];
};

const GROUP_ORDER = {
  image: ['Resize & Crop', 'Optimize', 'Enhance', 'Convert'],
  pdf: ['Optimize', 'Merge & Split', 'Edit', 'Pages', 'Convert to PDF', 'Convert from PDF', 'Security'],
};

// Per-tool icon colours for the mega-menu / tool lists — mirrors the HomeV2
// "Popular Tools" palette (solid tile + white glyph). Coloured by group so each
// mega-menu column reads as one hue.
const TINT_SOLID = {
  rose: 'bg-rose-500 text-white shadow-sm shadow-rose-500/30',
  indigo: 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30',
  violet: 'bg-violet-600 text-white shadow-sm shadow-violet-600/30',
  sky: 'bg-sky-500 text-white shadow-sm shadow-sky-500/30',
  emerald: 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30',
  blue: 'bg-blue-600 text-white shadow-sm shadow-blue-600/30',
  amber: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
  teal: 'bg-teal-500 text-white shadow-sm shadow-teal-500/30',
};
const GROUP_TINT = {
  'Resize & Crop': 'emerald',
  Optimize: 'rose',
  Enhance: 'violet',
  Convert: 'teal',
  'Merge & Split': 'indigo',
  Edit: 'violet',
  Pages: 'sky',
  'Convert to PDF': 'emerald',
  'Convert from PDF': 'blue',
  Security: 'amber',
};
export const getToolTint = (tool) => TINT_SOLID[GROUP_TINT[tool?.group]] || TINT_SOLID.indigo;

export const getAllTools = () => TOOLS;
export const getToolById = (id) => TOOLS.find((t) => t.id === id) || null;
export const getToolsByCategory = (slug) => {
  if (!slug || slug === 'all') return TOOLS;
  if (slug === 'ai' || slug === 'convert') return getVirtualCategory(slug);
  return TOOLS.filter((t) => t.category === slug);
};
export const getPopularTools = () => TOOLS.filter((t) => t.popular);

export const getMenuColumns = (slug) => {
  if (!slug || slug === 'all') {
    const pdf = getToolsByCategory('pdf');
    return [
      { title: 'Image Tools', to: '/image', tools: getToolsByCategory('image') },
      { title: 'PDF Tools', to: '/pdf', tools: pdf.filter((t) => t.popular), more: '/pdf' },
    ];
  }
  if (slug === 'ai' || slug === 'convert') {
    return [{ title: CATEGORY_TITLES[slug], tools: getToolsByCategory(slug) }];
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

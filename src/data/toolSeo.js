/**
 * Per-tool SEO copy rendered below the tool UI (see ToolSeoContent.jsx) and
 * turned into HowTo + FAQPage + SoftwareApplication structured data.
 *
 * Keep it honest and specific — this is the text Google shows in snippets and
 * the content that makes a tool page rank for "how to <thing>" queries. One
 * entry per tool id from src/data/tools.jsx. Tools with no entry just render
 * the plain tool + related-tools footer, no SEO section.
 *
 * Shape: {
 *   h1:      short heading for the SEO section (defaults to "How to <title>")
 *   intro:   1–2 plain sentences, keyword-rich but readable
 *   steps:   ["Do this", "then this", ...]  -> numbered list + HowTo schema
 *   faqs:    [{ q, a }]                     -> <details> list + FAQPage schema
 * }
 */

const B = 'Everything runs in your browser — the file never leaves your device.';

const toolSeo = {
  // ---------------- IMAGE ----------------
  'resize-image': {
    h1: 'How to resize an image online',
    intro:
      'Resize a JPG, PNG or WebP image to exact pixel dimensions, a percentage, or a target file size in KB or MB. Free, no sign-up, no watermark, and no upload — the resize happens on your device.',
    steps: [
      'Open the Resize Image tool and drop in your photo (or click to browse).',
      'Enter a new width or height in pixels, set a percentage, or type a target file size.',
      'Keep "lock aspect ratio" on so the image is not stretched.',
      'Click Download to save the resized image.',
    ],
    faqs: [
      { q: 'Does resizing reduce the file size?', a: 'Yes — fewer pixels means a smaller file. If you need a specific size (for example "under 200 KB") use the target-size option and the tool picks the dimensions and quality for you.' },
      { q: 'Will the image lose quality?', a: 'Making an image smaller keeps it sharp. Enlarging a small image past its real resolution will look soft — use the Image Upscaler for that.' },
      { q: 'Is my photo uploaded to a server?', a: 'No. The whole resize runs in your browser with JavaScript and the Canvas API, so the photo stays on your computer or phone.' },
    ],
  },
  'crop-image': {
    h1: 'How to crop an image online',
    intro:
      'Crop, straighten and rotate a photo in your browser, with ready-made aspect ratios for Instagram, Facebook, YouTube, passport photos and print sizes. Free and private — nothing is uploaded.',
    steps: [
      'Add your image to the Crop Image tool.',
      'Drag the crop box, or pick an aspect-ratio preset (1:1, 4:5, 16:9, …).',
      'Rotate or straighten the photo if it is tilted.',
      'Download the cropped image as JPG or PNG.',
    ],
    faqs: [
      { q: 'Can I crop to a square for a profile picture?', a: 'Yes — choose the 1:1 preset, or use the dedicated Profile Picture Maker which also has per-platform sizes.' },
      { q: 'Does cropping change the rest of the image?', a: 'No. Cropping only removes the area outside the box; the pixels you keep are untouched.' },
    ],
  },
  'profile-picture': {
    h1: 'How to make a profile picture',
    intro:
      'Crop any photo to the exact profile, post, story or cover size for WhatsApp, Instagram, Facebook, LinkedIn, YouTube, X and Discord. 100% free, no sign-up, no watermark, and the photo is never uploaded.',
    steps: [
      'Upload the photo you want to use.',
      'Pick the platform and the spot — for example "Instagram profile" or "Facebook cover".',
      'Drag and zoom your face inside the frame so it sits where you want it.',
      'Download the correctly sized image, ready to upload.',
    ],
    faqs: [
      { q: 'What size should a WhatsApp profile picture be?', a: 'WhatsApp displays it as a circle and stores it around 500×500 pixels. Pick the WhatsApp preset and the tool exports the right square size.' },
      { q: 'Will my face get cut off by the circle crop?', a: 'The tool shows the circular safe area while you position the photo, so you can see exactly what will be visible before you download.' },
      { q: 'Is the photo uploaded anywhere?', a: 'No. Cropping and resizing happen in your browser — the picture stays on your device.' },
    ],
  },
  'compress-image': {
    h1: 'How to compress an image online',
    intro:
      'Reduce the file size of a JPG, PNG or WebP image while keeping the same dimensions — compress by quality or to an exact target size like 100 KB or 1 MB. Free, unlimited, no watermark, no upload.',
    steps: [
      'Drop your image into the Compress Image tool.',
      'Choose a quality level, or enter a target file size.',
      'Compare the before/after size and preview.',
      'Download the smaller image.',
    ],
    faqs: [
      { q: 'How do I compress an image to under 100 KB?', a: 'Switch to "target size", type 100 KB, and the tool lowers the quality just enough to hit it while keeping the image as sharp as possible.' },
      { q: 'Does compressing change the width and height?', a: 'No — dimensions stay the same. Only the amount of data used to store the image goes down. To change dimensions too, use Resize Image.' },
      { q: 'Is it safe for private photos?', a: `Yes. ${B}` },
    ],
  },
  'remove-background': {
    h1: 'How to remove an image background',
    intro:
      'Cut the background out of a photo and download a transparent PNG — people, products, logos and signatures. Runs on an in-browser AI model, so it is free and nothing is uploaded.',
    steps: [
      'Upload the image you want to cut out.',
      'The tool detects the subject and removes the background automatically.',
      'Touch up the edges with the keep / erase brush if needed.',
      'Download the transparent PNG.',
    ],
    faqs: [
      { q: 'Is the background remover free?', a: 'Yes, with no sign-up, no credits and no watermark. The AI model runs on your own device.' },
      { q: 'Can I put a new background behind the cutout?', a: 'Download the transparent PNG, then use Convert Image or the Passport Photo Maker to place it on a solid colour or another photo.' },
      { q: 'What image quality do I get?', a: 'The cutout keeps the original resolution of your photo. Fine detail like stray hair may need a quick brush touch-up.' },
    ],
  },
  'upscale-image': {
    h1: 'How to upscale an image without losing quality',
    intro:
      'Enlarge a photo 2× or 4× with an in-browser AI upscaler that adds real detail instead of just stretching pixels. Free, no sign-up, no watermark — and the image is never uploaded to a server.',
    steps: [
      'Open the Image Upscaler and add a JPG or PNG.',
      'Choose the scale factor — 2× or 4×.',
      'Wait a few seconds while the AI model runs in your browser.',
      'Download the higher-resolution image.',
    ],
    faqs: [
      { q: 'How is this different from resizing?', a: 'Plain resizing spreads the same pixels over a bigger area, so the result looks blurry. The upscaler predicts new detail, so edges and textures stay sharp.' },
      { q: 'Is the AI upscaler really free?', a: 'Yes. There is no account, no credit limit and no watermark. The model downloads once and then runs on your device.' },
      { q: 'How large an image can I upscale?', a: 'Very large images use a lot of memory because everything runs locally. On a phone, stay under roughly 2000×2000 pixels for a 4× upscale.' },
    ],
  },
  'document-scanner': {
    h1: 'How to scan a document with your phone',
    intro:
      'Turn phone photos of documents, receipts and forms into clean, straightened, high-contrast scans and export them as a PDF or images. Bulk upload, automatic edge detection, free, and nothing is uploaded.',
    steps: [
      'Take photos of each page, then upload them all at once.',
      'The scanner finds the page edges and corrects the perspective automatically.',
      'Adjust the corners if a page needs it and pick a finish — colour, greyscale or black-and-white.',
      'Export as a single multi-page PDF, or as individual images / a ZIP.',
    ],
    faqs: [
      { q: 'Can I combine several photos into one PDF?', a: 'Yes — upload every page, reorder them if needed, and choose "Export PDF" to get one multi-page document.' },
      { q: 'Does it work without an internet connection?', a: 'After the page loads once, the scanning runs fully offline in your browser using OpenCV compiled to WebAssembly.' },
      { q: 'Are my documents uploaded?', a: 'No. Edge detection, perspective correction and PDF creation all happen on your device.' },
    ],
  },
  'passport-photo': {
    h1: 'How to make a passport photo at home',
    intro:
      'Make a passport, visa or ID photo from a normal selfie — replace the background with a plain white or blue, size it to the official spec for India, the US, UK, Schengen and more, and lay out a printable 4×6 sheet. Free and private.',
    steps: [
      'Upload a front-facing photo with even lighting.',
      'Pick the country / document so the crop and dimensions match the official rules.',
      'Let the tool swap in a compliant background colour.',
      'Download the single photo, or a print-ready sheet of copies.',
    ],
    faqs: [
      { q: 'What size is an Indian passport photo?', a: 'It is 51×51 mm (2×2 inch) with a plain white or light-blue background. Choose the India preset and the tool outputs exactly that.' },
      { q: 'Can I print several copies on one sheet?', a: 'Yes — the tool arranges multiple photos on a standard 4×6 inch (10×15 cm) sheet you can print at any photo lab.' },
      { q: 'Is my face photo uploaded?', a: `No. ${B}` },
    ],
  },
  'convert-image': {
    h1: 'How to convert an image format online',
    intro:
      'Convert between JPG, PNG and WebP, or combine several images into a single PDF — free, unlimited and without uploading anything.',
    steps: [
      'Add one or more images to the Convert Image tool.',
      'Pick the output format — JPG, PNG, WebP or PDF.',
      'Set quality (for JPG/WebP) or page size (for PDF).',
      'Download the converted file.',
    ],
    faqs: [
      { q: 'Which format is smallest?', a: 'WebP is usually 25–35% smaller than JPG at the same quality. Use PNG only when you need transparency or a lossless copy.' },
      { q: 'Can I convert PNG to JPG to remove transparency?', a: 'Yes — converting to JPG flattens transparency onto a white background.' },
    ],
  },

  // ---------------- PDF ----------------
  'merge-pdf': {
    h1: 'How to merge PDF files into one',
    intro:
      'Combine several PDFs — and JPG or PNG images — into a single document, in the order you choose. Free, no sign-up, no watermark, and the files are never uploaded.',
    steps: [
      'Drop all the PDFs and images you want to combine.',
      'Drag the thumbnails to put them in the right order.',
      'Click Merge.',
      'Download the single combined PDF.',
    ],
    faqs: [
      { q: 'Is there a limit on how many PDFs I can merge?', a: 'No fixed limit. Because it runs in your browser, very large jobs are only limited by your device memory.' },
      { q: 'Can I merge images and PDFs together?', a: 'Yes — JPG and PNG files are added as full pages in the same document.' },
      { q: 'Are my PDFs uploaded to a server?', a: `No. ${B}` },
    ],
  },
  'split-pdf': {
    h1: 'How to split a PDF into separate files',
    intro:
      'Cut one PDF into several — by split points, every N pages, or one file per page. Free, private, no upload.',
    steps: [
      'Open the Split PDF tool and add your file.',
      'Choose how to split: pick page ranges, split every N pages, or extract each page.',
      'Preview the resulting files.',
      'Download them individually or as a ZIP.',
    ],
    faqs: [
      { q: 'How do I extract just one page from a PDF?', a: 'Use "Extract Pages", type the page number, and download a one-page PDF. Split PDF is best when you want several pieces at once.' },
      { q: 'Does splitting reduce quality?', a: 'No — the pages are copied exactly, including text, fonts and images.' },
    ],
  },
  'pdf-editor': {
    h1: 'How to edit a PDF for free',
    intro:
      'Add text, images, shapes, highlights and white-out to a PDF, and edit existing content, right in your browser. Free, no sign-up, no watermark, and nothing is uploaded.',
    steps: [
      'Open the PDF Editor and load your document.',
      'Use the toolbar to add text boxes, images, drawings or shapes on any page.',
      'Move, resize or delete anything you have added.',
      'Download the edited PDF.',
    ],
    faqs: [
      { q: 'Can I edit the text that is already in the PDF?', a: 'You can white-out existing text and type over it. True inline text editing works best on PDFs that were exported from text (not scanned).' },
      { q: 'Is there a watermark on the output?', a: 'No. The exported PDF has no watermark and no page limit.' },
      { q: 'Are my documents private?', a: `Yes. ${B}` },
    ],
  },
  'organize-pdf': {
    h1: 'How to reorder pages in a PDF',
    intro:
      'Rearrange, rotate and delete PDF pages by drag and drop, then save a clean new file. Free and fully in-browser.',
    steps: [
      'Add your PDF to the Organize PDF tool.',
      'Drag page thumbnails to reorder them.',
      'Rotate or remove any page you do not want.',
      'Download the reorganised PDF.',
    ],
    faqs: [
      { q: 'Can I merge in pages from another PDF here?', a: 'Use Merge PDF to combine documents first, then Organize PDF to fine-tune the page order.' },
      { q: 'Will the page content change?', a: 'No — only the order and rotation change. Text and images are untouched.' },
    ],
  },
  'rotate-pdf': {
    h1: 'How to rotate a PDF and save it',
    intro:
      'Turn all pages, or just the ones you pick, 90°, 180° or 270° and save the rotation permanently. Free, no upload.',
    steps: [
      'Open the Rotate PDF tool and add your file.',
      'Select the pages to rotate (or choose "all").',
      'Click to rotate left or right until they are upright.',
      'Download the corrected PDF.',
    ],
    faqs: [
      { q: 'Why does my PDF look fine but print sideways?', a: 'Some viewers show a temporary rotation that is not saved in the file. This tool writes the rotation into the PDF so it prints correctly everywhere.' },
      { q: 'Can I rotate only one page?', a: 'Yes — select just that page before applying the rotation.' },
    ],
  },
  'delete-pages': {
    h1: 'How to delete pages from a PDF',
    intro:
      'Remove the pages you do not need and save the rest as a new PDF. Free, private, no sign-up.',
    steps: [
      'Add your PDF to the Remove Pages tool.',
      'Click the pages you want to delete, or type a range like 3-5.',
      'Check the preview of what remains.',
      'Download the trimmed PDF.',
    ],
    faqs: [
      { q: 'Is the original file changed?', a: 'No. You download a new PDF; the file on your computer stays as it was.' },
      { q: 'Can I keep only a few pages instead?', a: 'If you want to keep fewer pages than you remove, Extract Pages is faster — pick the ones to keep.' },
    ],
  },
  'extract-pages': {
    h1: 'How to extract pages from a PDF',
    intro:
      'Pick the pages you want and save them as one new PDF. Free and fully in-browser — nothing is uploaded.',
    steps: [
      'Open the Extract Pages tool and add your PDF.',
      'Select the pages to keep, or enter ranges like 1-3, 7, 10.',
      'Click Extract.',
      'Download the new PDF with just those pages.',
    ],
    faqs: [
      { q: 'Do the extracted pages keep their formatting?', a: 'Yes — text, fonts, links and images are copied exactly.' },
      { q: 'Can I get each page as its own file?', a: 'Use Split PDF with the "one file per page" option.' },
    ],
  },
  'extract-images': {
    h1: 'How to extract images from a PDF',
    intro:
      'Pull the embedded photos and graphics out of a PDF and save them as PNG files. Free, no upload.',
    steps: [
      'Add your PDF to the Extract Images tool.',
      'It lists every image it finds in the document.',
      'Select the ones you want.',
      'Download them individually or as a ZIP.',
    ],
    faqs: [
      { q: 'Does this screenshot the pages?', a: 'No — it pulls the original embedded image data, so you get the full resolution that is stored in the PDF.' },
      { q: 'What if I want the whole page as an image?', a: 'Use PDF to JPG to render each page as a picture.' },
    ],
  },
  'page-numbers': {
    h1: 'How to add page numbers to a PDF',
    intro:
      'Stamp page numbers onto a PDF — choose the position, format (1, 1/10, Page 1), starting number, font and colour. Free, no watermark, no upload.',
    steps: [
      'Open the Add Page Numbers tool and load your PDF.',
      'Pick where the number sits and how it looks.',
      'Set the first page to number and the starting value.',
      'Download the numbered PDF.',
    ],
    faqs: [
      { q: 'Can I skip the cover page?', a: 'Yes — set "start numbering from page 2" (or later) so the title page stays clean.' },
      { q: 'Can I use "Page X of Y"?', a: 'Yes, that format is one of the presets.' },
    ],
  },
  'watermark-pdf': {
    h1: 'How to add a watermark to a PDF',
    intro:
      'Stamp a text or image watermark across every page — set the angle, opacity, size and whether it is tiled or centred. Free and fully in-browser.',
    steps: [
      'Add your PDF to the Add Watermark tool.',
      'Type your watermark text or upload a logo.',
      'Adjust opacity, rotation and placement.',
      'Download the watermarked PDF.',
    ],
    faqs: [
      { q: 'Can I put "CONFIDENTIAL" diagonally across each page?', a: 'Yes — type the text, set rotation to about 45° and lower the opacity so the page stays readable.' },
      { q: 'Does FileQuick add its own watermark?', a: 'Never. The only watermark on the file is the one you add.' },
    ],
  },
  'fill-sign': {
    h1: 'How to fill and sign a PDF',
    intro:
      'Add text, dates, checkmarks and your signature to a PDF form — draw, type or upload a signature. Free, no account, and the document never leaves your browser.',
    steps: [
      'Open the Fill & Sign tool and load the PDF.',
      'Click anywhere to add text, a date or a checkmark.',
      'Add your signature by drawing it, typing it or uploading an image.',
      'Download the completed, signed PDF.',
    ],
    faqs: [
      { q: 'Is a drawn signature legally valid?', a: 'In most countries a clear intent to sign — including a drawn or typed signature — is valid for everyday agreements. For regulated documents check local rules.' },
      { q: 'Is my signed contract uploaded anywhere?', a: `No. ${B}` },
    ],
  },
  'extract-text': {
    h1: 'How to extract text from a PDF',
    intro:
      'Pull the text out of a PDF — including OCR for scanned pages and photos — and copy it or save it as a .txt file. Free and fully in-browser.',
    steps: [
      'Add your PDF to the Extract Text tool.',
      'For scanned documents, turn on OCR and pick the language.',
      'Review the extracted text.',
      'Copy it, or download it as a text file.',
    ],
    faqs: [
      { q: 'Does it work on scanned PDFs?', a: 'Yes — OCR (Tesseract, running in your browser) reads text from scans and images. Clear, straight scans give the best results.' },
      { q: 'Is my PDF sent to a server for OCR?', a: 'No. The OCR engine runs locally as WebAssembly.' },
    ],
  },
  'image-to-pdf': {
    h1: 'How to convert images to PDF',
    intro:
      'Combine JPG and PNG images into a single PDF — set page size, orientation and margins, and reorder pages before you export. Free, no sign-up, no upload.',
    steps: [
      'Drop your images into the Image to PDF tool.',
      'Drag them into the order you want.',
      'Choose page size (A4, Letter, fit-to-image) and margins.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I convert JPG to PDF on a phone?', a: 'Open this page in your mobile browser, select your photos, and download — no app to install.' },
      { q: 'Will the images be compressed?', a: 'They are embedded at full quality by default; you can lower it to shrink the PDF.' },
    ],
  },
  'text-to-pdf': {
    h1: 'How to convert text to PDF',
    intro:
      'Turn a .txt file — or text you paste in — into a clean, printable PDF with your choice of font, size and margins. Free and fully in-browser.',
    steps: [
      'Open the Text to PDF tool.',
      'Paste your text or upload a .txt file.',
      'Set the font, size, line spacing and page size.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'Does it keep my line breaks?', a: 'Yes. Paragraphs and blank lines are preserved; long lines wrap to the page width.' },
      { q: 'Can it handle other languages?', a: 'Yes — Unicode text including accented and non-Latin scripts is supported.' },
    ],
  },
  'pdf-to-jpg': {
    h1: 'How to convert a PDF to JPG',
    intro:
      'Render each page of a PDF as a JPG image at the resolution you choose. Free, no watermark, no upload.',
    steps: [
      'Add your PDF to the PDF to JPG tool.',
      'Pick the output resolution (DPI).',
      'Select which pages to convert.',
      'Download the images individually or as a ZIP.',
    ],
    faqs: [
      { q: 'How do I get one image per page?', a: 'That is the default — each page becomes a separate JPG.' },
      { q: 'PNG instead of JPG?', a: 'Choose PNG in the format option if you need lossless output or transparency.' },
    ],
  },
};

export const getToolSeo = (id) => toolSeo[id] || null;

export default toolSeo;

/**
 * Per-tool SEO copy rendered below the tool UI (see ToolSeoContent.jsx) and
 * turned into HowTo + FAQPage + WebApplication + BreadcrumbList structured data.
 *
 * One entry per tool id from src/data/tools.jsx. Keep every field honest,
 * specific and unique — no two tools should share the same sentences.
 *
 * Shape: {
 *   seoTitle:       <title> text WITHOUT the " — FileQuick" suffix (added by seo.js).
 *                   Primary keyword first, ~45–55 chars.
 *   seoDescription: <meta name="description">, ~140–160 chars, benefit-focused.
 *   breadcrumb:     short crumb label (defaults to the tool title).
 *   h1:             heading for the SEO section (NOT the page <h1>).
 *   intro:          1–2 keyword-rich but readable sentences.
 *   body:           ["para", "para", …]  extra context: what it does, formats,
 *                   privacy — aims for 250–500 useful words with the intro.
 *   steps:          ["do this", "then this", …]  -> numbered list + HowTo schema
 *   faqs:           [{ q, a }]                    -> <details> list + FAQPage schema
 *   related:        [{ id, text }]                -> internal links with anchor text
 * }
 */

const B = 'Everything runs in your browser — the file never leaves your device, so it works for private and confidential documents.';
const NO_UPLOAD = 'The file is processed on your own device and never uploaded to a server.';

const toolSeo = {
  // ============================ IMAGE ============================
  'resize-image': {
    seoTitle: 'Resize Image Online – Free Photo Resizer (px & KB)',
    seoDescription:
      'Resize an image online free — set exact pixel dimensions, a percentage, or a target file size in KB. Works with JPG, PNG, WebP and PDF. No sign-up, no watermark.',
    h1: 'How to resize an image online',
    intro:
      'Resize a JPG, PNG or WebP image to exact pixel dimensions, a percentage, or a target file size in KB or MB. Free, no sign-up, no watermark, and no upload — the resize runs on your device.',
    body: [
      'A resized image is useful in dozens of places: a photo that fits a website banner, a picture small enough to email, a display picture cropped to a square, or an ID photo that must be under a strict KB limit for an online form. This tool covers all of them in one place — type the width and height you need, drag a percentage slider, or switch to "target size" and let the tool pick the dimensions and quality that land just under the number you want.',
      'When the target is small (say "under 50 KB" for a government portal) lowering quality alone often is not enough, so the tool scales the picture down just enough to reach the size and tells you the new dimensions. When the target is comfortable it keeps the full resolution and only trims quality. You can also choose the output format — JPG, JPEG, PNG, WebP or a single-page PDF.',
      `Supported input formats are JPG, JPEG, PNG and WebP. ${NO_UPLOAD} If you also want to keep the same dimensions and only shrink the file, use Compress Image instead; to make a small photo meet a minimum size, use Increase Image Size.`,
    ],
    steps: [
      'Open the Resize Image tool and drop in your photo (or click to browse).',
      'Enter a new width or height in pixels, drag the percentage slider, or type a target file size in KB / MB.',
      'Keep "lock aspect ratio" on so the image is not stretched, and pick an output format.',
      'Click Resize, then Download to save the new image.',
    ],
    faqs: [
      { q: 'How do I resize an image to a specific size in KB?', a: 'Switch to the "File size" option, type the size you need (for example 50 KB), and the tool lowers the quality — and, if needed, the dimensions — until the file lands at or just under that size.' },
      { q: 'Will resizing reduce image quality?', a: 'Making an image smaller keeps it sharp. Enlarging a small image past its real resolution looks soft — use the Image Upscaler for that.' },
      { q: 'Can I resize an image without losing quality?', a: 'Downscaling to reasonable dimensions is effectively lossless to the eye. Keep the aspect ratio locked and avoid over-compressing and the result stays clean.' },
      { q: 'Which formats can I resize?', a: 'JPG, JPEG, PNG and WebP images. You can save the result as JPG, PNG, WebP or a one-page PDF.' },
      { q: 'Is my photo uploaded to a server?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'compress-image', text: 'shrink the file but keep the same width and height' },
      { id: 'increase-image-size', text: 'make a photo bigger to clear a minimum KB limit' },
      { id: 'crop-image', text: 'cut the image to a new shape or aspect ratio' },
      { id: 'image-to-pdf', text: 'turn the resized images into a PDF' },
    ],
  },

  'compress-image': {
    seoTitle: 'Compress Image to KB – Free JPG & PNG Compressor',
    seoDescription:
      'Compress JPG, JPEG, PNG or WebP images online free. Reduce photo size by quality or to an exact target like 100 KB or 1 MB — same dimensions, no watermark, no upload.',
    h1: 'How to compress an image online',
    intro:
      'Reduce the file size of a JPG, PNG or WebP image while keeping the same dimensions — compress by quality or to an exact target size like 100 KB or 1 MB. Free, unlimited, no watermark, no upload.',
    body: [
      'Image compression removes data your eye barely notices — subtle colour steps, fine noise — so the file gets much smaller while the picture looks the same. It is the right tool when the dimensions are already fine and you just need a lighter file: faster-loading web pages, smaller email attachments, or a photo that fits an upload limit.',
      'Use the quality slider for a quick "good enough" reduction, or switch to target size and type the exact number the situation calls for. If a very small target cannot be reached at the current dimensions, the tool will scale the picture down just enough to hit it and show you the new size, so you always get a file that actually meets the limit.',
      `JPG, JPEG, PNG and WebP are supported. PNGs are saved as WebP where the browser allows it, because PNG cannot be quality-compressed. ${B}`,
    ],
    steps: [
      'Drop your image into the Compress Image tool.',
      'Choose a quality level, or enter a target file size in KB or MB.',
      'Compare the before / after size and preview.',
      'Download the smaller image.',
    ],
    faqs: [
      { q: 'How do I compress an image to under 100 KB?', a: 'Switch to "target size", type 100 KB, and the tool lowers the quality just enough to hit it while keeping the image as sharp as possible.' },
      { q: 'Does compressing change the width and height?', a: 'No — dimensions stay the same by default. Only the amount of data used to store the image goes down. To change dimensions too, use Resize Image.' },
      { q: 'How do I compress a JPEG without losing quality?', a: 'There is always some loss when a JPEG gets smaller, but at 70–80% quality it is invisible in normal viewing. The tool defaults to a safe level.' },
      { q: 'Can I compress PNG images?', a: 'Yes. Because PNG is lossless, the tool converts it to WebP (or JPG) to actually reduce the size while keeping it crisp.' },
      { q: 'Is it safe for private photos?', a: `Yes. ${B}` },
    ],
    related: [
      { id: 'resize-image', text: 'also change the pixel dimensions' },
      { id: 'convert-image', text: 'change the format between JPG, PNG and WebP' },
      { id: 'exam-photo-resizer', text: 'hit the exact photo + signature size an exam form needs' },
      { id: 'image-to-pdf', text: 'combine the compressed images into one PDF' },
    ],
  },

  'crop-image': {
    seoTitle: 'Crop Image Online – Free Photo Cropper',
    seoDescription:
      'Crop a photo online free — drag the box or pick an aspect ratio for Instagram, YouTube, passport photos and print. Straighten and rotate too. No upload, no watermark.',
    h1: 'How to crop an image online',
    intro:
      'Crop, straighten and rotate a photo in your browser, with ready-made aspect ratios for Instagram, Facebook, YouTube, passport photos and print sizes. Free and private — nothing is uploaded.',
    body: [
      'Cropping is the fastest way to fix a photo: cut out empty space, centre the subject, straighten a tilted horizon, or force a picture into the exact shape a platform expects. Drag the corners for a free crop, or lock an aspect ratio (1:1, 4:5, 16:9, 3:2 and more) so the result fits without guesswork.',
      'The pixels you keep are copied exactly — cropping never re-compresses or blurs the part of the image that stays. You can rotate in 90° steps or nudge the angle to level a photo, then download as JPG or PNG.',
      `${NO_UPLOAD} For social profile and cover images at the right per-platform size, the Profile Picture Maker is quicker; for a square passport crop with a plain background, use the Passport Photo Maker.`,
    ],
    steps: [
      'Add your image to the Crop Image tool.',
      'Drag the crop box, or pick an aspect-ratio preset (1:1, 4:5, 16:9, …).',
      'Rotate or straighten the photo if it is tilted.',
      'Download the cropped image as JPG or PNG.',
    ],
    faqs: [
      { q: 'How do I crop a photo to a square?', a: 'Choose the 1:1 preset and the crop box locks to a square; drag it over the part you want to keep, then download.' },
      { q: 'Does cropping reduce image quality?', a: 'No. Cropping only removes the area outside the box; the pixels you keep are untouched and not re-compressed.' },
      { q: 'Can I crop a JPG and a PNG?', a: 'Yes — both are supported as input, and you can export to either format.' },
      { q: 'Is the image uploaded anywhere?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'resize-image', text: 'change the pixel dimensions after cropping' },
      { id: 'profile-picture', text: 'crop to the exact size for WhatsApp, Instagram, LinkedIn…' },
      { id: 'passport-photo', text: 'square ID-photo crop with a plain background' },
    ],
  },

  'profile-picture': {
    seoTitle: 'Profile Picture Maker – Resize DP for Any App',
    seoDescription:
      'Make a profile picture online free. Crop any photo to the exact profile, post, story or cover size for WhatsApp, Instagram, Facebook, LinkedIn, YouTube and X.',
    h1: 'How to make a profile picture',
    intro:
      'Crop any photo to the exact profile, post, story or cover size for WhatsApp, Instagram, Facebook, LinkedIn, YouTube, X and Discord. 100% free, no sign-up, no watermark, and the photo is never uploaded.',
    body: [
      'Every platform stores its display picture at a particular size and shows it in a particular shape — a circle on WhatsApp and LinkedIn, a rounded square on Discord, a wide banner for a Facebook or YouTube cover. Upload a photo once, pick the platform and the spot, and the tool crops and exports it at the right dimensions with the safe area shown while you position your face.',
      'Because you can see the circular or rectangular mask before you download, nothing important gets clipped once you upload it for real. The output is a clean JPG or PNG at the platform’s native resolution.',
      NO_UPLOAD,
    ],
    steps: [
      'Upload the photo you want to use.',
      'Pick the platform and the spot — for example "Instagram profile" or "Facebook cover".',
      'Drag and zoom your face inside the frame so it sits where you want it.',
      'Download the correctly sized image, ready to upload.',
    ],
    faqs: [
      { q: 'What size should a WhatsApp profile picture be?', a: 'WhatsApp displays it as a circle and stores it around 500×500 pixels. Pick the WhatsApp preset and the tool exports the right square size.' },
      { q: 'What size is a LinkedIn profile photo?', a: 'LinkedIn recommends 400×400 pixels and shows it in a circle. Use the LinkedIn preset for an exact fit.' },
      { q: 'Will my face get cut off by the circle crop?', a: 'No — the tool shows the circular safe area while you position the photo, so you see exactly what will be visible before you download.' },
      { q: 'Is the photo uploaded anywhere?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'crop-image', text: 'free-form crop with custom aspect ratios' },
      { id: 'remove-background', text: 'drop a clean background behind your headshot' },
      { id: 'compress-image', text: 'shrink the final picture for a faster upload' },
    ],
  },

  'exam-photo-resizer': {
    seoTitle: 'Exam Photo & Signature Resizer – SSC, UPSC, IBPS',
    seoDescription:
      'Resize your photo and signature for Indian government exam forms — SSC, UPSC, IBPS, RRB, NTA. Exact pixel size, white/blue background, under the KB limit. Free, no upload.',
    h1: 'How to resize a photo and signature for an exam form',
    intro:
      'Online forms for SSC, UPSC, IBPS bank exams, RRB railway, NTA (JEE / NEET) and most government jobs demand a photo and signature at an exact pixel size and under a strict KB limit — usually a 20–50 KB photo and a 10–20 KB signature. This tool crops, sets a plain white or blue background, and resizes and compresses both to spec, all in your browser.',
    body: [
      'The frustrating part of every application form is the photo upload: it rejects the file for being a few KB too large, or the wrong dimensions, or the background is not plain. This tool fixes all of that at once. Pick your exam and it loads the official photo and signature specs; upload your pictures, crop them, optionally replace the background with the plain white or light-blue that forms expect, and it centre-crops, resizes and squeezes each one under the KB limit.',
      'A green "Within limits" badge confirms the result is acceptable before you download. If your notification lists different numbers, choose Custom size and type the exact pixels and KB range.',
      `${NO_UPLOAD} Your photo and signature never leave your phone or computer — important for documents you would not want on a random server.`,
    ],
    steps: [
      'Pick your exam (SSC, UPSC, IBPS, RRB, NTA…) or choose Custom size and type the numbers from the notification.',
      'Upload your photo, and a photo of your signature on white paper.',
      'Crop each one, and for the photo optionally remove the background and set plain white or blue.',
      'Click "Prepare for the form" — each image is centre-cropped, resized and squeezed under the KB limit.',
      'Check the green "Within limits" badge and download the photo and signature.',
    ],
    faqs: [
      { q: 'What photo and signature size does SSC / IBPS want?', a: 'Most SSC and IBPS forms want a JPG photo around 200×230 px at 20–50 KB and a signature around 140×60 px at 10–20 KB. Pick the preset and the tool hits those numbers — always cross-check the current notification.' },
      { q: 'The form says my photo is too large — what do I do?', a: 'Use the preset for your exam, or Custom size with the exact KB range from the notification. The badge turns red if it cannot get under the maximum at the required pixel size.' },
      { q: 'How do I make my photo background white for a government form?', a: 'The photo has a "remove & replace background" option that cuts you out and puts you on plain white or light-blue — the colours official forms expect.' },
      { q: 'Can I resize only the signature?', a: 'Yes — the photo is the main input but the signature is optional. Add just the signature if that is all you need to fix.' },
      { q: 'Is my photo uploaded anywhere?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'passport-photo', text: 'passport / visa photo with an official background' },
      { id: 'compress-image', text: 'compress any image to a target KB size' },
      { id: 'increase-image-size', text: 'when the form needs the photo above a minimum KB' },
      { id: 'crop-image', text: 'fine-tune the crop before resizing' },
    ],
  },

  'increase-image-size': {
    seoTitle: 'Increase Image Size in KB Online – Free',
    seoDescription:
      'Increase the file size of a photo in KB online free. Meet a minimum upload size like "image must be at least 20 KB" — raises quality, enlarges and adds grain. No upload.',
    h1: 'How to increase the file size of a photo',
    intro:
      'Some upload forms reject a photo for being too small — "image must be at least 20 KB", say. This tool makes a JPG bigger to clear that minimum: it raises quality to the maximum, then enlarges the picture, then adds a faint grain if it still needs more KB.',
    body: [
      'This is the opposite problem to compression, and it comes up on the same government and job portals: the form has both a maximum and a minimum size, and your already-compressed photo falls under the minimum. You cannot recreate detail that earlier compression threw away — no tool can — but you can reliably push the file size up until it clears the check.',
      'The tool works in order: first it re-saves at top quality, then it scales the image up, then as a last resort it adds fine luma grain. Turn off "allow enlarging" if the form also caps the pixel dimensions, and it will use quality and grain only.',
      NO_UPLOAD,
    ],
    steps: [
      'Upload the photo that is under the required size.',
      'Type the minimum size the form wants (for example 20 KB or 50 KB).',
      'Leave "allow enlarging" on unless the form also caps the pixel dimensions.',
      'Click "Increase file size" and download the bigger JPG.',
    ],
    faqs: [
      { q: 'Can you really increase a photo’s size?', a: 'You can reliably increase the file size in KB. You cannot restore detail lost to earlier compression. This maxes out quality and enlarges the image so the file clears a minimum-size upload check.' },
      { q: 'The form says "photo must be more than 20 KB" — will this fix it?', a: 'Yes. Set the target just above the minimum (say 22 KB) and download the result.' },
      { q: 'How do I increase image size from 20 KB to 100 KB?', a: 'Type 100 KB as the target. The tool raises quality and enlarges the picture until the file reaches roughly that size.' },
      { q: 'Why did it enlarge my photo?', a: 'Raising quality alone is often not enough to reach the target. Enlarging adds pixels, which adds data. Turn off "allow enlarging" to keep the dimensions.' },
      { q: 'Is the photo uploaded to a server?', a: `No — ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'compress-image', text: 'the reverse — make a photo smaller in KB' },
      { id: 'exam-photo-resizer', text: 'exact photo + signature specs for exam forms' },
      { id: 'upscale-image', text: 'actually add detail with an AI upscaler' },
    ],
  },

  'remove-background': {
    seoTitle: 'Remove Background from Image – Free & Automatic',
    seoDescription:
      'Remove the background from an image online free. Automatic AI cut-out for people, products and logos — download a transparent PNG. No sign-up, no watermark, no upload.',
    h1: 'How to remove an image background',
    intro:
      'Cut the background out of a photo and download a transparent PNG — people, products, logos and signatures. Runs on an in-browser AI model, so it is free and nothing is uploaded.',
    body: [
      'A transparent cut-out is the starting point for a lot of design work: a product shot on a white catalogue page, a headshot for a team grid, a logo over a coloured banner, or a signature to drop into a document. This tool finds the subject automatically and removes everything behind it in a few seconds.',
      'The AI model runs entirely in your browser — it downloads once, then works offline with no per-image credit or watermark. If it leaves a scrap of background or cuts away a bit of the subject, "Touch up edges" gives you an erase brush and a restore brush to fix it by hand.',
      `${NO_UPLOAD} To place the cut-out on a solid colour or another photo afterwards, use Convert Image or the Passport Photo Maker.`,
    ],
    steps: [
      'Upload the image you want to cut out.',
      'The tool detects the subject and removes the background automatically.',
      'If a bit of background is left or a bit of the subject got cut away, click "Touch up edges" and paint it right with the erase / restore brush.',
      'Download the transparent PNG.',
    ],
    faqs: [
      { q: 'Is the background remover free?', a: 'Yes, with no sign-up, no credits and no watermark. The AI model runs on your own device.' },
      { q: 'How do I make an image background transparent?', a: 'Upload it here — the subject is detected and the background is deleted, and you download a PNG with a transparent background.' },
      { q: 'Can I put a new background behind the cut-out?', a: 'Download the transparent PNG, then use Convert Image or the Passport Photo Maker to place it on a solid colour or another photo.' },
      { q: 'What resolution do I get?', a: 'The cut-out keeps the original resolution of your photo. Fine detail like stray hair may need a quick brush touch-up.' },
      { q: 'The AI missed a spot — can I fix it by hand?', a: 'Yes. Click "Touch up edges" for a brush editor: Erase paints away any leftover background, Restore paints back a bit of the subject the model cut by mistake, using the real pixels from your original photo.' },
      { q: 'Is my photo uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'passport-photo', text: 'swap in an official white or blue background' },
      { id: 'profile-picture', text: 'crop the cut-out to a profile size' },
      { id: 'convert-image', text: 'flatten the PNG onto a solid colour' },
    ],
  },

  'upscale-image': {
    seoTitle: 'Image Upscaler – Increase Image Resolution Free',
    seoDescription:
      'Upscale an image 2× or 4× online free with an AI model that adds real detail, not just stretched pixels. Improve photo resolution and quality — no upload, no watermark.',
    h1: 'How to upscale an image without losing quality',
    intro:
      'Enlarge a photo 2× or 4× with an in-browser AI upscaler that adds real detail instead of just stretching pixels. Free, no sign-up, no watermark — and the image is never uploaded to a server.',
    body: [
      'Plain resizing spreads the same pixels over a larger area, so an enlarged photo looks soft and blocky. An AI upscaler predicts what the extra detail should be — sharp edges, clean text, believable texture — so the result looks like it was shot at the higher resolution. It is the right tool for a small product photo you need to print, an old picture you want to enlarge, or a low-res graphic for a bigger screen.',
      'The model downloads once and then runs on your device. Large images use a lot of memory locally, so on a phone stay under roughly 2000×2000 pixels for a 4× upscale.',
      NO_UPLOAD,
    ],
    steps: [
      'Open the Image Upscaler and add a JPG or PNG.',
      'Choose the scale factor — 2× or 4×.',
      'Wait a few seconds while the AI model runs in your browser.',
      'Download the higher-resolution image.',
    ],
    faqs: [
      { q: 'How is upscaling different from resizing?', a: 'Resizing spreads existing pixels over a bigger area and looks blurry. The upscaler predicts new detail, so edges and textures stay sharp.' },
      { q: 'Can I increase image resolution for free?', a: 'Yes. There is no account, no credit limit and no watermark — the model downloads once and then runs on your device.' },
      { q: 'How large an image can I upscale?', a: 'Very large images use a lot of memory because everything runs locally. On a phone, stay under about 2000×2000 pixels for a 4× upscale.' },
      { q: 'Does it work on old or blurry photos?', a: 'It sharpens and adds plausible detail, which helps mildly soft photos a lot. Severely damaged images have limits.' },
      { q: 'Is the image uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'resize-image', text: 'plain resize when you only need different dimensions' },
      { id: 'remove-background', text: 'isolate the subject before enlarging' },
      { id: 'compress-image', text: 'shrink the larger file afterwards' },
    ],
  },

  'document-scanner': {
    seoTitle: 'Document Scanner Online – Photo to Scanned PDF',
    seoDescription:
      'Scan a document online free — turn phone photos of pages, receipts and forms into clean, straightened scans and export them as one PDF. Auto edge-detect, bulk upload, no upload to a server.',
    h1: 'How to scan a document with your phone',
    intro:
      'Turn phone photos of documents, receipts and forms into clean, straightened, high-contrast scans and export them as a PDF or images. Bulk upload, automatic edge detection, free, and nothing is uploaded.',
    body: [
      'A photo of a document is not a scan — it is skewed, shadowed and cluttered with the desk behind it. This tool fixes that: it detects the page edges, corrects the perspective so the page is a clean rectangle, and applies a scan finish (colour, greyscale or crisp black-and-white) so the text is sharp and the background is white.',
      'Upload every page at once, reorder them if needed, adjust any corner the detector missed, and export a single multi-page PDF — or individual images and a ZIP. After the page loads once, the processing runs fully offline using OpenCV compiled to WebAssembly.',
      NO_UPLOAD,
    ],
    steps: [
      'Take photos of each page, then upload them all at once.',
      'The scanner finds the page edges and corrects the perspective automatically.',
      'Adjust the corners if a page needs it and pick a finish — colour, greyscale or black-and-white.',
      'Export as a single multi-page PDF, or as individual images / a ZIP.',
    ],
    faqs: [
      { q: 'How do I scan a document without a scanner?', a: 'Photograph each page with your phone, upload the photos here, and the tool straightens and cleans them into scans you can save as a PDF.' },
      { q: 'Can I combine several photos into one PDF?', a: 'Yes — upload every page, reorder them if needed, and choose "Export PDF" to get one multi-page document.' },
      { q: 'Does it work offline?', a: 'After the page loads once, scanning runs fully offline in your browser using OpenCV compiled to WebAssembly.' },
      { q: 'Are my documents uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'image-to-pdf', text: 'plain image-to-PDF without the scan clean-up' },
      { id: 'extract-text', text: 'pull the text out of the scanned pages with OCR' },
      { id: 'pdf-compressor', text: 'shrink the finished scan PDF' },
    ],
  },

  'passport-photo': {
    seoTitle: 'Passport Size Photo Maker – India, US, UK, EU',
    seoDescription:
      'Make a passport size photo online free from a selfie. Plain white or blue background, official sizes for India, US, UK and Schengen, plus a printable 4×6 sheet. No upload.',
    h1: 'How to make a passport photo at home',
    intro:
      'Make a passport, visa or ID photo from a normal selfie — replace the background with plain white or blue, size it to the official spec for India, the US, UK, Schengen and more, and lay out a printable 4×6 sheet. Free and private.',
    body: [
      'Photo studios charge for something you can do at home: take a front-facing photo in even light, and this tool crops it to the exact head size the document requires, swaps in a compliant background colour, and outputs the precise dimensions — 51×51 mm for India, 2×2 inch for the US, 35×45 mm for the UK and Schengen, and many more.',
      'It can also arrange several copies on a standard 4×6 inch (10×15 cm) sheet, so one print at any photo lab gives you a full set to cut out.',
      `${NO_UPLOAD} Your face photo stays on your device.`,
    ],
    steps: [
      'Upload a front-facing photo with even lighting.',
      'Pick the country / document so the crop and dimensions match the official rules.',
      'Let the tool swap in a compliant background colour.',
      'Download the single photo, or a print-ready sheet of copies.',
    ],
    faqs: [
      { q: 'What size is an Indian passport photo?', a: 'It is 51×51 mm (2×2 inch) with a plain white or light-blue background. Choose the India preset and the tool outputs exactly that.' },
      { q: 'What is the US passport photo size?', a: '2×2 inches (51×51 mm) with the head between roughly 1 and 1⅜ inches. Pick the US preset for a compliant crop.' },
      { q: 'Can I print several copies on one sheet?', a: 'Yes — the tool arranges multiple photos on a standard 4×6 inch (10×15 cm) sheet you can print at any photo lab.' },
      { q: 'Is my face photo uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'exam-photo-resizer', text: 'photo + signature sized for Indian exam forms' },
      { id: 'remove-background', text: 'manual background removal for tricky shots' },
      { id: 'crop-image', text: 'free-form crop if you need a custom size' },
    ],
  },

  'convert-image': {
    seoTitle: 'Image Converter – JPG, PNG, WebP & PDF',
    seoDescription:
      'Convert images online free — JPG to PNG, PNG to JPG, WebP to JPG, JPG to WebP — or combine several images into one PDF. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to convert an image format online',
    intro:
      'Convert between JPG, PNG and WebP, or combine several images into a single PDF — free, unlimited and without uploading anything.',
    body: [
      'Different jobs need different formats: JPG for photos and email, PNG when you need transparency or a lossless copy, WebP for the smallest file on a web page. This tool converts between all three in a batch, and can also merge a set of images straight into a PDF.',
      'For lossy targets (JPG, WebP) you can set the quality; converting to JPG flattens any transparency onto a white background. WebP is typically 25–35% smaller than JPG at the same quality.',
      NO_UPLOAD,
    ],
    steps: [
      'Add one or more images to the Convert Image tool.',
      'Pick the output format — JPG, PNG, WebP or PDF.',
      'Set quality (for JPG / WebP) or page size (for PDF).',
      'Download the converted file.',
    ],
    faqs: [
      { q: 'How do I convert PNG to JPG?', a: 'Add the PNG, choose JPG as the output, and download. Transparency is flattened onto a white background.' },
      { q: 'How do I convert JPG to WebP?', a: 'Add the JPG, pick WebP, set a quality level, and download a file that is usually 25–35% smaller.' },
      { q: 'Which format is smallest?', a: 'WebP is usually the smallest at a given quality. Use PNG only when you need transparency or a lossless copy.' },
      { q: 'Can I convert several images at once?', a: 'Yes — add a batch and they are all converted to the format you choose.' },
      { q: 'Is anything uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'compress-image', text: 'reduce the file size after converting' },
      { id: 'resize-image', text: 'change dimensions as well as format' },
      { id: 'image-to-pdf', text: 'combine images into a multi-page PDF' },
    ],
  },

  // ============================ PDF ============================
  'pdf-compressor': {
    seoTitle: 'Compress PDF – Reduce PDF File Size Online Free',
    seoDescription:
      'Compress a PDF online free — reduce PDF file size for email, WhatsApp or a government upload while keeping the text selectable. No watermark, no sign-up.',
    h1: 'How to compress a PDF',
    intro:
      'Reduce the file size of a PDF — for an email attachment, a WhatsApp share, or a portal that caps uploads at 1 MB or 2 MB — while keeping the text selectable and the layout intact. Free, no watermark.',
    body: [
      'Most oversized PDFs are heavy because of high-resolution scanned pages or embedded photos. Compressing re-samples those images to a sensible screen resolution and re-encodes them, which typically cuts the file to a fraction of its size without a visible drop in quality for on-screen reading.',
      'Text, fonts and vector content are preserved, so the document stays searchable and prints cleanly. If you need to hit a specific limit, compress and check the result against the number your portal or mail client allows.',
      'This tool uses FileQuick’s conversion engine. Choose it when a PDF is too large to send; if the file is mostly photos you scanned, the Document Scanner produces smaller output to begin with.',
    ],
    steps: [
      'Open Compress PDF and upload your file.',
      'Pick a compression level (more compression = smaller file, lower image quality).',
      'Start the compression and wait for it to finish.',
      'Download the smaller PDF and check it opens correctly.',
    ],
    faqs: [
      { q: 'How do I reduce a PDF to under 1 MB?', a: 'Upload it, choose a stronger compression level, and download. Very image-heavy PDFs may need the highest level; text-only PDFs are already small.' },
      { q: 'Will compressing a PDF lose quality?', a: 'Embedded images are re-sampled, so photos lose some detail. Text, fonts and vector graphics are untouched and stay crisp.' },
      { q: 'How do I compress a PDF for email or WhatsApp?', a: 'Most mail and chat limits are 25 MB or less. Compress at a medium level first, and increase it only if the file is still too big.' },
      { q: 'Does the compressed PDF keep selectable text?', a: 'Yes — the text layer is preserved, so the document stays searchable and copy-able.' },
      { q: 'Is my PDF safe?', a: 'Files are processed for conversion and not stored long-term. For fully on-device processing, use the browser-only tools like Merge or Split PDF.' },
    ],
    related: [
      { id: 'merge-pdf', text: 'combine files first, then compress the result' },
      { id: 'split-pdf', text: 'send only the pages you need instead' },
      { id: 'pdf-to-jpg', text: 'turn pages into images for a lighter share' },
      { id: 'protect-pdf', text: 'add a password before sending' },
    ],
  },

  'merge-pdf': {
    seoTitle: 'Merge PDF – Combine PDF Files Online Free',
    seoDescription:
      'Merge PDF files online free — combine multiple PDFs, and JPG or PNG images, into one document in any order. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to merge PDF files into one',
    intro:
      'Combine several PDFs — and JPG or PNG images — into a single document, in the order you choose. Free, no sign-up, no watermark, and the files are never uploaded.',
    body: [
      'Merging is the everyday fix for a document that arrives in pieces: a scanned form plus its annexes, a contract plus signed pages, a set of receipts for one claim. Drop everything in, drag the thumbnails into the right order, and download one clean PDF.',
      'Images are added as full pages, so you can mix a photographed page into a PDF without converting it first. Pages are copied exactly — text, fonts and images are unchanged.',
      `${B} There is no fixed page or file limit; very large jobs are only bound by your device memory.`,
    ],
    steps: [
      'Drop all the PDFs and images you want to combine.',
      'Drag the thumbnails to put them in the right order.',
      'Click Merge.',
      'Download the single combined PDF.',
    ],
    faqs: [
      { q: 'How do I merge multiple PDF files into one?', a: 'Add all the files, drag them into the order you want, and click Merge. You get one PDF containing every page.' },
      { q: 'Can I combine images and PDFs together?', a: 'Yes — JPG and PNG files are added as full pages in the same document.' },
      { q: 'Is there a limit on how many PDFs I can merge?', a: 'No fixed limit. Because it runs in your browser, very large jobs are only limited by your device memory.' },
      { q: 'Are my PDFs uploaded to a server?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'split-pdf', text: 'the reverse — break one PDF into several' },
      { id: 'organize-pdf', text: 'fine-tune page order and rotation after merging' },
      { id: 'pdf-compressor', text: 'shrink the combined file for email' },
      { id: 'delete-pages', text: 'drop any pages you did not need' },
    ],
  },

  'split-pdf': {
    seoTitle: 'Split PDF – Separate PDF Pages Online Free',
    seoDescription:
      'Split a PDF online free — divide it by page ranges, every N pages, or one file per page. Separate PDF pages without losing quality. No sign-up, nothing uploaded.',
    h1: 'How to split a PDF into separate files',
    intro:
      'Cut one PDF into several — by split points, every N pages, or one file per page. Free, private, no upload.',
    body: [
      'Splitting is useful when a single PDF holds several things that belong apart: chapters of a book, individual invoices in a batch export, or the one section of a report you need to send. Choose page ranges to carve out specific pieces, split every N pages for equal chunks, or burst the file into one PDF per page.',
      'Every output page is an exact copy — text, fonts, links and images are preserved. Download the pieces individually or as a ZIP.',
      `${NO_UPLOAD} To pull out a few pages and keep just those, Extract Pages is quicker; to remove a few and keep the rest, use Remove Pages.`,
    ],
    steps: [
      'Open the Split PDF tool and add your file.',
      'Choose how to split: pick page ranges, split every N pages, or extract each page.',
      'Preview the resulting files.',
      'Download them individually or as a ZIP.',
    ],
    faqs: [
      { q: 'How do I split a PDF into separate pages?', a: 'Choose the "one file per page" option and every page is saved as its own PDF, delivered as a ZIP.' },
      { q: 'How do I extract just one page from a PDF?', a: 'Use Extract Pages, type the page number, and download a one-page PDF. Split PDF is best when you want several pieces at once.' },
      { q: 'Does splitting reduce quality?', a: 'No — the pages are copied exactly, including text, fonts and images.' },
      { q: 'Is my PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'merge-pdf', text: 'the reverse — join files into one' },
      { id: 'extract-pages', text: 'keep only a chosen set of pages' },
      { id: 'delete-pages', text: 'remove unwanted pages and keep the rest' },
      { id: 'organize-pdf', text: 'reorder pages before splitting' },
    ],
  },

  'pdf-editor': {
    seoTitle: 'PDF Editor – Edit PDF Online Free, No Sign-up',
    seoDescription:
      'Edit a PDF online free — add text, images, shapes, highlights and white-out, and edit existing content, right in your browser. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to edit a PDF for free',
    intro:
      'Add text, images, shapes, highlights and white-out to a PDF, and edit existing content, right in your browser. Free, no sign-up, no watermark, and nothing is uploaded.',
    body: [
      'A full PDF editor for the things people actually need: correct a typo by whiting it out and typing over it, add a paragraph or a stamp, drop in a logo or a photo, highlight a clause, or sketch an arrow. Everything you add stays editable — move it, resize it, delete it — until you export.',
      'True inline text editing works best on PDFs that were exported from a document (not scanned images). Scanned pages are better handled by whiting-out and overtyping.',
      `${B} The exported PDF has no watermark and no page limit.`,
    ],
    steps: [
      'Open the PDF Editor and load your document.',
      'Use the toolbar to add text boxes, images, drawings or shapes on any page.',
      'Move, resize or delete anything you have added.',
      'Download the edited PDF.',
    ],
    faqs: [
      { q: 'Can I edit existing text in a PDF?', a: 'You can white-out existing text and type over it. Direct inline editing works best on PDFs exported from text rather than scans.' },
      { q: 'Is this PDF editor really free?', a: 'Yes — no account, no watermark and no page limit on the exported file.' },
      { q: 'Can I add an image or signature to the PDF?', a: 'Yes — insert any JPG or PNG and position it on the page. For a dedicated signing flow, use Fill & Sign.' },
      { q: 'Are my documents private?', a: `Yes. ${B}` },
    ],
    related: [
      { id: 'fill-sign', text: 'a focused flow for filling forms and signing' },
      { id: 'watermark-pdf', text: 'stamp every page with text or a logo' },
      { id: 'page-numbers', text: 'add page numbers across the document' },
      { id: 'organize-pdf', text: 'reorder, rotate or delete pages' },
    ],
  },

  'organize-pdf': {
    seoTitle: 'Organize PDF – Rearrange & Reorder PDF Pages',
    seoDescription:
      'Organize a PDF online free — rearrange, reorder, rotate and delete pages by drag and drop, then save a clean new file. No sign-up, nothing uploaded.',
    h1: 'How to reorder pages in a PDF',
    intro:
      'Rearrange, rotate and delete PDF pages by drag and drop, then save a clean new file. Free and fully in-browser.',
    body: [
      'Scanned or exported PDFs often come out in the wrong order — pages reversed, a cover in the middle, one page sideways. This tool shows every page as a thumbnail so you can drag them into the right sequence, spin any page upright, and drop the ones you do not want, all on one screen.',
      'Only the page order and rotation change; the content of each page is untouched. Download the reorganised PDF when the layout looks right.',
      NO_UPLOAD,
    ],
    steps: [
      'Add your PDF to the Organize PDF tool.',
      'Drag page thumbnails to reorder them.',
      'Rotate or remove any page you do not want.',
      'Download the reorganised PDF.',
    ],
    faqs: [
      { q: 'How do I rearrange pages in a PDF?', a: 'Drag the page thumbnails into the order you want, then download. The page content is not changed.' },
      { q: 'Can I merge pages from another PDF here?', a: 'Use Merge PDF to combine documents first, then Organize PDF to fine-tune the page order.' },
      { q: 'Will reordering change the page content?', a: 'No — only the order and rotation change. Text and images are untouched.' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'merge-pdf', text: 'combine several PDFs before organising' },
      { id: 'rotate-pdf', text: 'rotate pages only and save' },
      { id: 'delete-pages', text: 'bulk-remove pages by range' },
      { id: 'split-pdf', text: 'break the ordered file into pieces' },
    ],
  },

  'rotate-pdf': {
    seoTitle: 'Rotate PDF – Turn & Save PDF Pages Online Free',
    seoDescription:
      'Rotate a PDF online free — turn all pages or just the ones you pick 90°, 180° or 270° and save the rotation permanently. No sign-up, nothing uploaded.',
    h1: 'How to rotate a PDF and save it',
    intro:
      'Turn all pages, or just the ones you pick, 90°, 180° or 270° and save the rotation permanently so it prints and opens the right way everywhere. Free, no upload.',
    body: [
      'A PDF that looks fine in one viewer can print sideways in another, because some viewers apply a temporary on-screen rotation that is never written into the file. This tool bakes the rotation into the PDF itself, so every reader, printer and email preview shows it upright.',
      'Rotate the whole document at once, or select individual pages — handy when a single scanned page went in landscape.',
      NO_UPLOAD,
    ],
    steps: [
      'Open the Rotate PDF tool and add your file.',
      'Select the pages to rotate (or choose "all").',
      'Click to rotate left or right until they are upright.',
      'Download the corrected PDF.',
    ],
    faqs: [
      { q: 'Why does my PDF look fine but print sideways?', a: 'Some viewers show a temporary rotation that is not saved in the file. This tool writes the rotation into the PDF so it prints correctly everywhere.' },
      { q: 'Can I rotate only one page?', a: 'Yes — select just that page before applying the rotation.' },
      { q: 'Does rotating reduce quality?', a: 'No — pages are copied exactly, only their orientation flag changes.' },
      { q: 'Is my file uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'organize-pdf', text: 'rotate, reorder and delete pages together' },
      { id: 'crop-pdf', text: 'trim the page margins as well' },
      { id: 'pdf-editor', text: 'add content after fixing the orientation' },
    ],
  },

  'crop-pdf': {
    seoTitle: 'Crop PDF – Trim PDF Page Margins Online Free',
    seoDescription:
      'Crop a PDF online free — trim white margins, remove borders, or cut every page to the same box. Auto white-space trim or a manual crop. No sign-up, nothing uploaded.',
    h1: 'How to crop a PDF page',
    intro:
      'Trim the page margins of a PDF — drag a crop box, or auto-trim the surrounding white space — and apply it to one page or the whole document. Free and fully in-browser.',
    body: [
      'Cropping a PDF is how you remove wide scanner margins, cut a header or footer you do not want, or tighten a page so it fills the screen on a phone or e-reader. Drag a box on the page and the same crop can be applied to every page, or let the tool detect and shave the blank border automatically.',
      'Cropping only changes the visible page box; nothing inside the crop is re-rendered or compressed, so text stays sharp and selectable.',
      NO_UPLOAD,
    ],
    steps: [
      'Add your PDF to the Crop PDF tool.',
      'Drag the crop box on a page, or use auto-trim to remove white space.',
      'Choose whether to apply it to one page or all pages.',
      'Download the cropped PDF.',
    ],
    faqs: [
      { q: 'How do I remove white margins from a PDF?', a: 'Use auto-trim to detect and cut the blank border, or drag the crop box in tight and apply it to all pages.' },
      { q: 'Does cropping a PDF delete content?', a: 'It hides whatever falls outside the crop box by changing the page size; the underlying content is not re-rendered.' },
      { q: 'Can I crop every page the same way?', a: 'Yes — set the box once and choose "apply to all pages".' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'rotate-pdf', text: 'fix orientation before cropping' },
      { id: 'organize-pdf', text: 'reorder or delete pages' },
      { id: 'pdf-compressor', text: 'shrink the cropped file' },
    ],
  },

  'delete-pages': {
    seoTitle: 'Delete Pages from PDF – Remove PDF Pages Free',
    seoDescription:
      'Delete pages from a PDF online free — remove blank, duplicate or unwanted pages and save the rest as a new file. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to delete pages from a PDF',
    intro:
      'Remove the pages you do not need — blanks, duplicates, an unwanted appendix — and save the rest as a new PDF. Free, private, no sign-up.',
    body: [
      'When a PDF has more than you want to send, the quickest fix is to delete the extra pages. Click the pages to drop in the thumbnail view, or type a range like 3-5, 9, and check the preview of what remains before downloading.',
      'Your original file is not touched — you download a new PDF, and the pages you keep are copied exactly.',
      `${NO_UPLOAD} If you want to keep fewer pages than you would remove, Extract Pages is faster.`,
    ],
    steps: [
      'Add your PDF to the Remove Pages tool.',
      'Click the pages you want to delete, or type a range like 3-5.',
      'Check the preview of what remains.',
      'Download the trimmed PDF.',
    ],
    faqs: [
      { q: 'How do I remove a page from a PDF for free?', a: 'Open the file here, click the page (or type its number), and download the new PDF without it.' },
      { q: 'Is the original file changed?', a: 'No. You download a new PDF; the file on your computer stays as it was.' },
      { q: 'Can I remove several pages at once?', a: 'Yes — select multiple pages or type ranges like 2, 5-7, 12.' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'extract-pages', text: 'keep only a chosen set of pages instead' },
      { id: 'split-pdf', text: 'break the file into multiple PDFs' },
      { id: 'organize-pdf', text: 'reorder and rotate what is left' },
    ],
  },

  'extract-pages': {
    seoTitle: 'Extract Pages from PDF – Save Selected Pages',
    seoDescription:
      'Extract pages from a PDF online free — pick the pages you want and save them as one new PDF. Keeps text, fonts and images. No sign-up, nothing uploaded.',
    h1: 'How to extract pages from a PDF',
    intro:
      'Pick the pages you want and save them as one new PDF. Free and fully in-browser — nothing is uploaded.',
    body: [
      'Extracting is the "keep only these" operation: choose the pages that matter — a single section, the signed pages of a contract, the figures from a report — and get a compact PDF with just those, in order.',
      'Text, fonts, links and images on the extracted pages are copied exactly. Enter ranges like 1-3, 7, 10 or click pages in the thumbnail grid.',
      `${NO_UPLOAD} To get each page as its own file, use Split PDF with the "one file per page" option.`,
    ],
    steps: [
      'Open the Extract Pages tool and add your PDF.',
      'Select the pages to keep, or enter ranges like 1-3, 7, 10.',
      'Click Extract.',
      'Download the new PDF with just those pages.',
    ],
    faqs: [
      { q: 'How do I save selected pages from a PDF?', a: 'Select the page numbers or type ranges, click Extract, and download a new PDF containing only those pages.' },
      { q: 'Do the extracted pages keep their formatting?', a: 'Yes — text, fonts, links and images are copied exactly.' },
      { q: 'Can I get each page as its own file?', a: 'Use Split PDF with the "one file per page" option.' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'delete-pages', text: 'the reverse — remove pages, keep the rest' },
      { id: 'split-pdf', text: 'split into several files at once' },
      { id: 'merge-pdf', text: 'combine extracted sets into one document' },
    ],
  },

  'extract-images': {
    seoTitle: 'Extract Images from PDF – Save Photos as PNG',
    seoDescription:
      'Extract images from a PDF online free — pull out the embedded photos and graphics at full resolution and save them as PNG files. No sign-up, nothing uploaded.',
    h1: 'How to extract images from a PDF',
    intro:
      'Pull the embedded photos and graphics out of a PDF and save them as PNG files at their original resolution. Free, no upload.',
    body: [
      'When you need a picture that is inside a PDF — a chart, a product photo, a logo — this tool lists every image embedded in the document and lets you save the ones you want. It pulls the original image data, so you get the full resolution stored in the file, not a screenshot.',
      'Download images one at a time or as a ZIP.',
      `${NO_UPLOAD} If you want a whole page as a picture rather than the images on it, use PDF to JPG.`,
    ],
    steps: [
      'Add your PDF to the Extract Images tool.',
      'It lists every image it finds in the document.',
      'Select the ones you want.',
      'Download them individually or as a ZIP.',
    ],
    faqs: [
      { q: 'Does this screenshot the pages?', a: 'No — it pulls the original embedded image data, so you get the full resolution stored in the PDF.' },
      { q: 'What format are the extracted images?', a: 'PNG, which is lossless and preserves transparency where the source image had it.' },
      { q: 'What if I want the whole page as an image?', a: 'Use PDF to JPG to render each page as a picture.' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'pdf-to-jpg', text: 'render entire pages as images' },
      { id: 'extract-text', text: 'pull the text out instead' },
      { id: 'extract-pages', text: 'save whole pages as a smaller PDF' },
    ],
  },

  'page-numbers': {
    seoTitle: 'Add Page Numbers to PDF Online – Free',
    seoDescription:
      'Add page numbers to a PDF online free — choose the position, format (1, 1/10, Page 1 of 10), starting number, font and colour. No watermark, nothing uploaded.',
    h1: 'How to add page numbers to a PDF',
    intro:
      'Stamp page numbers onto a PDF — choose the position, format (1, 1/10, "Page 1 of 10"), starting number, font and colour. Free, no watermark, no upload.',
    body: [
      'Page numbers make a printed report, contract or submission easy to reference and reassemble. This tool adds them without opening the source document: pick a corner or the centre, choose a numbering style, and set which page to start from so a cover or table of contents can stay unnumbered.',
      'The numbers are drawn directly onto the pages and the file downloads with no watermark.',
      NO_UPLOAD,
    ],
    steps: [
      'Open the Add Page Numbers tool and load your PDF.',
      'Pick where the number sits and how it looks.',
      'Set the first page to number and the starting value.',
      'Download the numbered PDF.',
    ],
    faqs: [
      { q: 'Can I skip the cover page?', a: 'Yes — set "start numbering from page 2" (or later) so the title page stays clean.' },
      { q: 'Can I use "Page X of Y"?', a: 'Yes, that format is one of the presets, along with plain "1" and "1 / 10".' },
      { q: 'Can I choose where the number appears?', a: 'Yes — any corner, or bottom/top centre, with adjustable margin.' },
      { q: 'Is my PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'watermark-pdf', text: 'add a text or logo watermark too' },
      { id: 'merge-pdf', text: 'combine documents before numbering' },
      { id: 'pdf-editor', text: 'add headers, footers or other text' },
    ],
  },

  'watermark-pdf': {
    seoTitle: 'Add Watermark to PDF – Text or Logo, Free',
    seoDescription:
      'Add a watermark to a PDF online free — a text stamp like "CONFIDENTIAL" or an image logo across every page, with angle, opacity and tiling. No upload, no watermark from us.',
    h1: 'How to add a watermark to a PDF',
    intro:
      'Stamp a text or image watermark across every page — set the angle, opacity, size and whether it is tiled or centred. Free and fully in-browser.',
    body: [
      'A watermark marks a document as a draft, a copy, or confidential, or brands each page with a logo. Type your text or upload a PNG logo, set the opacity so the page stays readable, and choose a diagonal angle or a tiled repeat.',
      'The watermark is applied to every page and the result downloads with no added branding from FileQuick.',
      NO_UPLOAD,
    ],
    steps: [
      'Add your PDF to the Add Watermark tool.',
      'Type your watermark text or upload a logo.',
      'Adjust opacity, rotation and placement.',
      'Download the watermarked PDF.',
    ],
    faqs: [
      { q: 'How do I add "CONFIDENTIAL" diagonally across each page?', a: 'Type the text, set rotation to about 45° and lower the opacity so the page stays readable.' },
      { q: 'Can I use an image or logo as the watermark?', a: 'Yes — upload a PNG (transparency supported) and position or tile it across the pages.' },
      { q: 'Does FileQuick add its own watermark?', a: 'Never. The only watermark on the file is the one you add.' },
      { q: 'Is my PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'page-numbers', text: 'add page numbers in the same pass' },
      { id: 'protect-pdf', text: 'password-protect the document as well' },
      { id: 'pdf-editor', text: 'place text or images on specific pages' },
    ],
  },

  'fill-sign': {
    seoTitle: 'Fill and Sign PDF Online Free – Add Signature',
    seoDescription:
      'Fill and sign a PDF online free — add text, dates, checkmarks and your signature (draw, type or upload). No account, no watermark, and the document never leaves your browser.',
    h1: 'How to fill and sign a PDF',
    intro:
      'Add text, dates, checkmarks and your signature to a PDF form — draw, type or upload a signature. Free, no account, and the document never leaves your browser.',
    body: [
      'Most forms that arrive as a PDF are not fillable — there are no form fields, just lines to write on. This tool lets you click anywhere to drop text, a date or a tick, and add a signature by drawing it with a mouse or finger, typing it in a handwriting font, or uploading a photo of your signature.',
      'Save one signature and reuse it across the document. The completed PDF downloads with no watermark.',
      `${B}`,
    ],
    steps: [
      'Open the Fill & Sign tool and load the PDF.',
      'Click anywhere to add text, a date or a checkmark.',
      'Add your signature by drawing it, typing it or uploading an image.',
      'Download the completed, signed PDF.',
    ],
    faqs: [
      { q: 'How do I sign a PDF online for free?', a: 'Open the PDF here, add your signature by drawing, typing or uploading it, place it on the page, and download the signed file — no account needed.' },
      { q: 'Is a drawn signature legally valid?', a: 'In most countries a clear intent to sign — including a drawn or typed signature — is valid for everyday agreements. For regulated documents, check local rules.' },
      { q: 'Can I fill a PDF that has no form fields?', a: 'Yes — you can place text anywhere on the page, so non-interactive forms work fine.' },
      { q: 'Is my signed document uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'pdf-editor', text: 'a fuller editor for images, shapes and redaction' },
      { id: 'watermark-pdf', text: 'mark the document as a copy or draft' },
      { id: 'protect-pdf', text: 'password-protect the signed file' },
    ],
  },

  'extract-text': {
    seoTitle: 'Extract Text from PDF – Copy PDF Text (OCR)',
    seoDescription:
      'Extract text from a PDF online free — copy the text or save it as .txt, with OCR for scanned pages and photos. Runs in your browser, nothing uploaded.',
    h1: 'How to extract text from a PDF',
    intro:
      'Pull the text out of a PDF — including OCR for scanned pages and photos — and copy it or save it as a .txt file. Free and fully in-browser.',
    body: [
      'When a PDF holds text you want to reuse — a quote, a table of data, a whole document to edit elsewhere — this tool reads it out. For digital PDFs it takes the real text layer instantly; for scans and photos it runs OCR (optical character recognition) to recognise the characters in the image.',
      'OCR runs locally as WebAssembly and supports many languages. Clear, straight scans give the best results.',
      `${NO_UPLOAD} For an editable Word document rather than plain text, use PDF to Word.`,
    ],
    steps: [
      'Add your PDF to the Extract Text tool.',
      'For scanned documents, turn on OCR and pick the language.',
      'Review the extracted text.',
      'Copy it, or download it as a text file.',
    ],
    faqs: [
      { q: 'How do I copy text from a scanned PDF?', a: 'Turn on OCR and choose the language. The tool recognises the characters in the scanned image and gives you selectable text.' },
      { q: 'Does it work on photos of documents?', a: 'Yes — image files run through the same OCR engine as scanned PDF pages.' },
      { q: 'Is my PDF sent to a server for OCR?', a: 'No. The OCR engine runs locally as WebAssembly.' },
      { q: 'What languages does the OCR support?', a: 'Many, including English and major Indian and European languages — pick the closest match for best accuracy.' },
    ],
    related: [
      { id: 'pdf-to-word', text: 'get an editable .docx instead of plain text' },
      { id: 'pdf-to-text', text: 'the same extraction with a .txt-first flow' },
      { id: 'document-scanner', text: 'clean up photos of pages before OCR' },
    ],
  },

  'image-to-pdf': {
    seoTitle: 'Image to PDF – Convert JPG to PDF Online Free',
    seoDescription:
      'Convert images to PDF online free — JPG, JPEG or PNG into one PDF, with page size, orientation, margins and drag-to-reorder. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to convert images to PDF',
    intro:
      'Combine JPG, JPEG and PNG images into a single PDF — set page size, orientation and margins, and reorder pages before you export. Free, no sign-up, no upload.',
    body: [
      'Turning photos into a PDF is how you submit scanned documents, send a set of pictures as one file, or make a simple portfolio. Drop the images in, drag them into order, choose A4, Letter or fit-to-image pages, set margins, and export.',
      'Images are embedded at full quality by default; you can lower it to shrink the PDF. This tool runs entirely in your browser.',
      NO_UPLOAD,
    ],
    steps: [
      'Drop your images into the Image to PDF tool.',
      'Drag them into the order you want.',
      'Choose page size (A4, Letter, fit-to-image) and margins.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I convert JPG to PDF on a phone?', a: 'Open this page in your mobile browser, select your photos, and download — there is no app to install.' },
      { q: 'How do I combine multiple images into one PDF?', a: 'Add all of them, drag to set the order, and export — each image becomes a page in a single PDF.' },
      { q: 'Will the images be compressed?', a: 'They are embedded at full quality by default; you can lower the quality to shrink the PDF.' },
      { q: 'Is anything uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'pdf-to-jpg', text: 'the reverse — PDF pages back to images' },
      { id: 'merge-pdf', text: 'combine the PDF with other documents' },
      { id: 'compress-image', text: 'shrink the photos before making the PDF' },
      { id: 'document-scanner', text: 'clean, straighten and de-shadow photographed pages first' },
    ],
  },

  'word-to-pdf': {
    seoTitle: 'Word to PDF – Convert DOCX to PDF Online Free',
    seoDescription:
      'Convert Word to PDF online free — DOC and DOCX to PDF keeping fonts, styles, tables, images and layout. No sign-up, no watermark.',
    h1: 'How to convert Word to PDF',
    intro:
      'Convert a .doc or .docx file to PDF while keeping the fonts, styles, tables, images and page layout exactly as they were. Free, no watermark.',
    body: [
      'A PDF is the right format to send a finished document: it looks identical on every device, cannot be accidentally edited, and prints predictably. This tool renders your Word file to PDF with the layout preserved — headings, spacing, tables, headers and footers, embedded images and page breaks all stay put.',
      'It handles both the older .doc and the modern .docx. If the document uses an unusual font that is not embedded, a close substitute is used.',
      'This tool uses FileQuick’s conversion engine. For the reverse — turning a PDF back into an editable document — use PDF to Word.',
    ],
    steps: [
      'Open Word to PDF and upload your .doc or .docx file.',
      'Wait while the document is rendered to PDF.',
      'Review the preview.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I convert a Word document to PDF without changing the formatting?', a: 'Upload the .docx here — the converter renders the exact layout, so fonts, tables, images and page breaks match the original.' },
      { q: 'Does it work with .doc as well as .docx?', a: 'Yes, both older Word .doc files and modern .docx files are supported.' },
      { q: 'Will my fonts be preserved?', a: 'Embedded fonts are kept. If a font is missing and not embedded, a close substitute is used so the layout still holds.' },
      { q: 'Is there a watermark?', a: 'No — the output PDF has no watermark.' },
    ],
    related: [
      { id: 'pdf-to-word', text: 'the reverse — PDF back to an editable .docx' },
      { id: 'merge-pdf', text: 'combine the PDF with other files' },
      { id: 'pdf-compressor', text: 'shrink the PDF for email' },
      { id: 'protect-pdf', text: 'add a password before sending' },
    ],
  },

  'powerpoint-to-pdf': {
    seoTitle: 'PowerPoint to PDF – Convert PPT to PDF Free',
    seoDescription:
      'Convert PowerPoint to PDF online free — PPT and PPTX to PDF keeping slide layout, fonts and images. One slide per page. No sign-up, no watermark.',
    h1: 'How to convert PowerPoint to PDF',
    intro:
      'Convert a .ppt or .pptx presentation to PDF, keeping every slide’s layout, fonts and images. One slide becomes one page. Free, no watermark.',
    body: [
      'A PDF of a deck is easier to share and review than the editable file: it opens without PowerPoint, keeps the design locked, and prints as handouts. This tool renders each slide to a full page with the layout intact — text boxes, charts, images and backgrounds all in place.',
      'Both .ppt and .pptx are supported. Animations and transitions are flattened to their final state, as they would appear on screen.',
      'This tool uses FileQuick’s conversion engine. To turn a PDF into slides, use PDF to PowerPoint.',
    ],
    steps: [
      'Open PowerPoint to PDF and upload your .ppt or .pptx file.',
      'Wait while each slide is rendered.',
      'Review the preview.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I convert a PPT to PDF with the layout intact?', a: 'Upload the file here — each slide is rendered to a page with its fonts, images and positioning preserved.' },
      { q: 'Does it support .pptx as well as .ppt?', a: 'Yes, both formats are supported.' },
      { q: 'What happens to animations?', a: 'They are flattened to the final on-screen state, one static page per slide.' },
      { q: 'Is there a watermark?', a: 'No — the output PDF has no watermark.' },
    ],
    related: [
      { id: 'pdf-to-powerpoint', text: 'the reverse — PDF pages into a .pptx deck' },
      { id: 'merge-pdf', text: 'combine the deck PDF with other documents' },
      { id: 'pdf-compressor', text: 'shrink an image-heavy deck PDF' },
    ],
  },

  'excel-to-pdf': {
    seoTitle: 'Excel to PDF – Convert XLSX to PDF Online Free',
    seoDescription:
      'Convert Excel to PDF online free — XLS, XLSX or CSV to PDF keeping the sheet layout, gridlines and formatting. No sign-up, no watermark.',
    h1: 'How to convert Excel to PDF',
    intro:
      'Convert an .xls, .xlsx or .csv spreadsheet to PDF, keeping the sheet layout, gridlines, fonts and number formatting. Free, no watermark.',
    body: [
      'A spreadsheet as a PDF is a fixed, printable record — useful for invoices, reports and anything you need to send without letting the recipient re-sort or edit the numbers. This tool renders your sheets to PDF pages with the column widths, borders and cell formatting preserved.',
      'CSV files are laid out into a clean table. Large sheets are split across pages the way Excel would print them.',
      'This tool uses FileQuick’s conversion engine. To pull tables out of a PDF into a workbook, use PDF to Excel.',
    ],
    steps: [
      'Open Excel to PDF and upload your .xls, .xlsx or .csv file.',
      'Wait while the sheets are rendered.',
      'Review the preview.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I convert an Excel sheet to PDF?', a: 'Upload the .xlsx here — the sheet is rendered to PDF with its gridlines, formatting and column widths kept.' },
      { q: 'Does it support CSV files?', a: 'Yes — a CSV is laid out into a clean table and converted the same way.' },
      { q: 'What about large spreadsheets?', a: 'They are split across multiple pages, following the print layout Excel would use.' },
      { q: 'Is there a watermark?', a: 'No — the output PDF has no watermark.' },
    ],
    related: [
      { id: 'pdf-to-excel', text: 'the reverse — extract PDF tables to .xlsx' },
      { id: 'merge-pdf', text: 'combine the spreadsheet PDF with other files' },
      { id: 'protect-pdf', text: 'password-protect financial data before sending' },
    ],
  },

  'text-to-pdf': {
    seoTitle: 'Text to PDF – Convert TXT to PDF Online Free',
    seoDescription:
      'Convert text to PDF online free — a .txt file or text you paste, into a clean printable PDF with your choice of font, size and margins. Runs in your browser, nothing uploaded.',
    h1: 'How to convert text to PDF',
    intro:
      'Turn a .txt file — or text you paste in — into a clean, printable PDF with your choice of font, size, line spacing and margins. Free and fully in-browser.',
    body: [
      'This is the quickest way to give plain text a proper page: notes, a code snippet, a letter, a list. Paste it in or upload a .txt file, choose a font and page size, and download a tidy PDF. Paragraphs and blank lines are kept; long lines wrap to the page width.',
      'Unicode text is supported, including accented and non-Latin scripts.',
      NO_UPLOAD,
    ],
    steps: [
      'Open the Text to PDF tool.',
      'Paste your text or upload a .txt file.',
      'Set the font, size, line spacing and page size.',
      'Download the PDF.',
    ],
    faqs: [
      { q: 'How do I turn a .txt file into a PDF?', a: 'Upload the file (or paste the text), pick a font and page size, and download the PDF.' },
      { q: 'Does it keep my line breaks?', a: 'Yes. Paragraphs and blank lines are preserved; long lines wrap to the page width.' },
      { q: 'Can it handle other languages?', a: 'Yes — Unicode text including accented and non-Latin scripts is supported.' },
      { q: 'Is anything uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'pdf-to-text', text: 'the reverse — PDF back to plain text' },
      { id: 'merge-pdf', text: 'combine the text PDF with other documents' },
      { id: 'pdf-editor', text: 'format the text visually instead' },
    ],
  },

  'pdf-to-jpg': {
    seoTitle: 'PDF to JPG – Convert PDF to Image Online Free',
    seoDescription:
      'Convert a PDF to JPG online free — render each page as a JPG or PNG image at the resolution you choose. One image per page. No sign-up, no watermark, nothing uploaded.',
    h1: 'How to convert a PDF to JPG',
    intro:
      'Render each page of a PDF as a JPG (or PNG) image at the resolution you choose. Free, no watermark, no upload.',
    body: [
      'Turning PDF pages into images is useful for posting a page to social media, embedding it in a slide, or sending a preview to someone who cannot open PDFs. Pick the DPI — higher for print, lower for a quick share — and choose which pages to convert.',
      'Each page becomes a separate image; download them individually or as a ZIP. Choose PNG instead of JPG if you need lossless output.',
      NO_UPLOAD,
    ],
    steps: [
      'Add your PDF to the PDF to JPG tool.',
      'Pick the output resolution (DPI).',
      'Select which pages to convert.',
      'Download the images individually or as a ZIP.',
    ],
    faqs: [
      { q: 'How do I convert a PDF to JPG?', a: 'Upload the PDF, choose a resolution, and download — each page is saved as its own JPG.' },
      { q: 'Can I get PNG instead of JPG?', a: 'Yes — choose PNG in the format option for lossless output or transparency.' },
      { q: 'How do I get one image per page?', a: 'That is the default — every page becomes a separate image.' },
      { q: 'Is the PDF uploaded?', a: `No. ${NO_UPLOAD}` },
    ],
    related: [
      { id: 'image-to-pdf', text: 'the reverse — images back into a PDF' },
      { id: 'extract-images', text: 'pull only the embedded photos, not whole pages' },
      { id: 'pdf-compressor', text: 'shrink the PDF instead of converting it' },
    ],
  },

  'pdf-to-word': {
    seoTitle: 'PDF to Word – Convert PDF to DOCX Online Free',
    seoDescription:
      'Convert PDF to Word online free — rebuild a PDF into an editable .docx with its text, tables and images. Handles digital and scanned PDFs. No sign-up, no watermark.',
    h1: 'How to convert a PDF to an editable Word document',
    intro:
      'Rebuild a PDF into an editable Word .docx — text, headings, tables and images — so you can change it in Word, Google Docs or LibreOffice. Free, no watermark.',
    body: [
      'When you only have the PDF but need to edit the content, this converter reconstructs it as a Word document: paragraphs become editable text, tables become real tables, and images are placed back in. For a scanned PDF it runs OCR first so the text is recognised rather than left as a picture.',
      'Complex multi-column layouts and heavy design may need light tidying in Word afterwards — that is true of every PDF-to-Word converter, because a PDF describes positions, not structure.',
      'This tool uses FileQuick’s conversion engine. For plain text with no formatting, Extract Text is faster.',
    ],
    steps: [
      'Open PDF to Word and upload your PDF.',
      'Wait while the document is rebuilt (OCR runs automatically for scans).',
      'Download the .docx file.',
      'Open it in Word or Google Docs and edit.',
    ],
    faqs: [
      { q: 'How do I convert a PDF to an editable Word document?', a: 'Upload the PDF here — the converter rebuilds it as a .docx with editable text, tables and images.' },
      { q: 'Can it convert a scanned PDF to Word?', a: 'Yes — OCR runs automatically on scanned pages so the text becomes editable rather than an image.' },
      { q: 'Will the formatting be exactly the same?', a: 'Simple documents convert cleanly. Complex multi-column layouts may need light adjustment in Word, as with any converter.' },
      { q: 'Is there a watermark?', a: 'No — the .docx has no watermark.' },
    ],
    related: [
      { id: 'word-to-pdf', text: 'the reverse — Word back to PDF' },
      { id: 'extract-text', text: 'plain text only, no layout' },
      { id: 'pdf-to-excel', text: 'send tables to a spreadsheet instead' },
      { id: 'pdf-editor', text: 'make small edits without leaving PDF' },
    ],
  },

  'pdf-to-powerpoint': {
    seoTitle: 'PDF to PowerPoint – Convert PDF to PPT Free',
    seoDescription:
      'Convert PDF to PowerPoint online free — turn each PDF page into an editable slide in a .pptx deck. No sign-up, no watermark.',
    h1: 'How to convert a PDF to PowerPoint',
    intro:
      'Turn each page of a PDF into a slide in a .pptx presentation, so you can present or edit it in PowerPoint, Keynote or Google Slides. Free, no watermark.',
    body: [
      'When a deck only exists as a PDF — a shared handout, an exported report — this converter puts it back into slide form. Every page becomes one slide at the right proportions, with the page content placed on it, ready to open in PowerPoint.',
      'Text that was selectable in the PDF comes across as text where possible; heavily designed pages come across as a full-slide image you can build on.',
      'This tool uses FileQuick’s conversion engine. To go the other way, use PowerPoint to PDF.',
    ],
    steps: [
      'Open PDF to PowerPoint and upload your PDF.',
      'Wait while each page is turned into a slide.',
      'Download the .pptx file.',
      'Open it in PowerPoint or Google Slides.',
    ],
    faqs: [
      { q: 'How do I turn a PDF into a PowerPoint presentation?', a: 'Upload the PDF here — each page becomes a slide in a .pptx file you can open and edit.' },
      { q: 'Will the slides be editable?', a: 'Text is kept as text where the PDF allows; complex pages come across as a full-slide image.' },
      { q: 'What slide size is used?', a: 'The deck matches the aspect ratio of your PDF pages so nothing is stretched.' },
      { q: 'Is there a watermark?', a: 'No — the .pptx has no watermark.' },
    ],
    related: [
      { id: 'powerpoint-to-pdf', text: 'the reverse — PPT to PDF' },
      { id: 'pdf-to-jpg', text: 'get plain page images instead' },
      { id: 'merge-pdf', text: 'combine PDFs before converting' },
    ],
  },

  'pdf-to-excel': {
    seoTitle: 'PDF to Excel – Extract PDF Tables to XLSX',
    seoDescription:
      'Convert PDF to Excel online free — pull tables from a PDF into an editable .xlsx workbook with rows and columns intact. No sign-up, no watermark.',
    h1: 'How to convert a PDF to Excel',
    intro:
      'Pull the tables out of a PDF into an .xlsx workbook, with the rows and columns kept as real cells you can sort and calculate. Free, no watermark.',
    body: [
      'Financial statements, price lists and reports often lock their data in a PDF table. This converter detects the table structure and rebuilds it as a spreadsheet, so numbers land in their own cells instead of one long text blob.',
      'Clean, ruled tables convert best; tables without borders may need a little column adjustment afterwards.',
      'This tool uses FileQuick’s conversion engine. To go from a spreadsheet to PDF, use Excel to PDF.',
    ],
    steps: [
      'Open PDF to Excel and upload your PDF.',
      'Wait while the tables are detected and rebuilt.',
      'Download the .xlsx workbook.',
      'Open it in Excel, Google Sheets or LibreOffice.',
    ],
    faqs: [
      { q: 'How do I extract a table from a PDF to Excel?', a: 'Upload the PDF — the converter finds the tables and writes them to an .xlsx file with the rows and columns as real cells.' },
      { q: 'Does it work on scanned PDFs?', a: 'Digital PDFs convert best. Scans depend on OCR quality and may need more clean-up.' },
      { q: 'What if the table has no borders?', a: 'Borderless tables are harder to detect — expect to adjust a few column splits after converting.' },
      { q: 'Is there a watermark?', a: 'No — the .xlsx has no watermark.' },
    ],
    related: [
      { id: 'excel-to-pdf', text: 'the reverse — spreadsheet to PDF' },
      { id: 'pdf-to-word', text: 'get the whole document, not just tables' },
      { id: 'extract-text', text: 'plain text extraction' },
    ],
  },

  'pdf-to-text': {
    seoTitle: 'PDF to Text – Convert PDF to TXT Online Free',
    seoDescription:
      'Convert PDF to text online free — extract all the text from a PDF and save it as a .txt file, with OCR for scanned pages. Runs in your browser, nothing uploaded.',
    h1: 'How to convert a PDF to a text file',
    intro:
      'Save a PDF as a plain .txt file — every bit of readable text, with OCR for scanned pages. Free and fully in-browser.',
    body: [
      'A .txt copy of a PDF is the most portable form of its content: no fonts, no layout, just the words, ready to paste anywhere, feed to a script, or search. Digital PDFs are read from their text layer instantly; scanned pages go through OCR.',
      'OCR runs locally as WebAssembly and supports many languages. Straight, high-contrast scans give the cleanest text.',
      `${NO_UPLOAD} For an editable document with formatting, use PDF to Word instead.`,
    ],
    steps: [
      'Add your PDF to the PDF to Text tool.',
      'Turn on OCR for scanned pages and pick the language.',
      'Review the extracted text.',
      'Download it as a .txt file.',
    ],
    faqs: [
      { q: 'How do I convert a PDF to a plain text file?', a: 'Upload the PDF here, let it read the text (with OCR for scans), and download a .txt file.' },
      { q: 'Does it handle scanned PDFs?', a: 'Yes — OCR recognises the text in scanned images. Clear scans give the best accuracy.' },
      { q: 'Is my PDF uploaded for OCR?', a: `No. ${NO_UPLOAD}` },
      { q: 'What is the difference from PDF to Word?', a: 'PDF to Text gives you unformatted words; PDF to Word rebuilds an editable document with layout, tables and images.' },
    ],
    related: [
      { id: 'text-to-pdf', text: 'the reverse — text file to PDF' },
      { id: 'pdf-to-word', text: 'editable document with formatting' },
      { id: 'extract-text', text: 'the same extraction with copy-to-clipboard' },
    ],
  },

  'unlock-pdf': {
    seoTitle: 'Unlock PDF – Remove PDF Password Online Free',
    seoDescription:
      'Unlock a PDF online free — remove the open password and print/copy/edit restrictions from a PDF you own or are authorized to access. No sign-up, no watermark.',
    h1: 'How to unlock a PDF',
    intro:
      'Remove the password and the print / copy / edit restrictions from a PDF you own or are authorized to access, so it opens and works normally. Free, no watermark.',
    body: [
      'Password-protected PDFs are a chore when you open them every day — a bank statement, a payslip, a policy document you have the right to read. This tool removes the protection so the file opens without a prompt and lets you print, copy and annotate it.',
      'You will be asked for the current password if the PDF needs one to open. Only unlock PDFs you own or are authorized to access — do not use this to bypass protection on documents that are not yours.',
      'This tool uses FileQuick’s conversion engine.',
    ],
    steps: [
      'Open Unlock PDF and upload your protected file.',
      'Enter the current password if the PDF asks for one to open.',
      'Start the unlock.',
      'Download the PDF with the password and restrictions removed.',
    ],
    faqs: [
      { q: 'How do I remove a password from a PDF I own?', a: 'Upload it, enter the current password if it needs one to open, and download an unrestricted copy.' },
      { q: 'Can this open a PDF if I do not know the password?', a: 'No. If the PDF needs a password to open, you must provide it. This tool removes protection from files you are authorized to access, not documents that are not yours.' },
      { q: 'Does it remove printing and copying restrictions?', a: 'Yes — owner-password restrictions on printing, copying and editing are cleared.' },
      { q: 'Is my file safe?', a: 'Files are processed for conversion and not stored long-term.' },
    ],
    related: [
      { id: 'protect-pdf', text: 'the reverse — add a password' },
      { id: 'pdf-editor', text: 'edit the unlocked document' },
      { id: 'merge-pdf', text: 'combine it with other files' },
    ],
  },

  'protect-pdf': {
    seoTitle: 'Protect PDF – Password Protect PDF Online Free',
    seoDescription:
      'Password protect a PDF online free — add an open password and encryption so only people with the password can read it. No sign-up, no watermark.',
    h1: 'How to password protect a PDF',
    intro:
      'Add a password to a PDF so it asks for it every time someone opens the file, with real encryption behind it. Free, no watermark.',
    body: [
      'Before you email a contract, a statement or anything with personal data, adding an open password means an intercepted or forwarded copy is unreadable without the key. Choose a strong password, share it with the recipient through a separate channel, and send the protected file.',
      'The PDF is encrypted, not just flagged — the content cannot be read without the password.',
      'This tool uses FileQuick’s conversion engine. To remove a password from a file you own, use Unlock PDF.',
    ],
    steps: [
      'Open Protect PDF and upload your file.',
      'Type the password you want to set (and confirm it).',
      'Start the protection.',
      'Download the encrypted PDF and share the password separately.',
    ],
    faqs: [
      { q: 'How do I password protect a PDF?', a: 'Upload the PDF, set a password, and download the encrypted file. Anyone opening it will be asked for that password.' },
      { q: 'Is the PDF actually encrypted?', a: 'Yes — the content is encrypted, not just marked read-only, so it cannot be read without the password.' },
      { q: 'What if I forget the password?', a: 'There is no recovery. Store it safely — without it the file cannot be opened, by you or anyone else.' },
      { q: 'Is my file uploaded?', a: 'Files are processed for conversion and not stored long-term.' },
    ],
    related: [
      { id: 'unlock-pdf', text: 'the reverse — remove a password you own' },
      { id: 'watermark-pdf', text: 'mark pages confidential as well' },
      { id: 'fill-sign', text: 'sign the document before protecting it' },
    ],
  },
};

export const getToolSeo = (id) => toolSeo[id] || null;

export default toolSeo;

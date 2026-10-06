/**
 * Search landing pages — real, working tool pages for specific jobs people
 * search for ("compress image to 50kb", "ssc photo resizer", "compress pdf to
 * 100kb"). Each one is an EXISTING tool with a preset applied (`toolId` +
 * `toolProps`) plus content written for that job — never a copy of another
 * page with the keyword swapped.
 *
 * Consolidation rules (see docs/SEO-STRATEGY.md):
 *  - "compress / resize / reduce image to N kb", "image compressor to N kb",
 *    "photo resize to N kb", "compress jpg to N kb" are one intent → one page
 *    per size: /compress-image-to-Nkb. Old /jpg-to-Nkb URLs redirect there.
 *  - SSC photo + SSC signature share one exam spec → one exam page, plus a
 *    signature-only page because the Signature Resizer is a different tool.
 *  - Sizes not listed here still work by URL (any size) but are noindex.
 *
 * Read by: src/routes.jsx (rendering), scripts/prerender.mjs (static HTML,
 * sitemap) and src/components/tool/LandingLinks.jsx (internal links).
 */
import { getFormSpec, specLine } from './formSpecs';

const kbText = (kb) => (kb >= 1024 && kb % 1024 === 0 ? `${kb / 1024} MB` : `${kb} KB`);
const kbSlug = (kb) => (kb >= 1024 && kb % 1024 === 0 ? `${kb / 1024}mb` : `${kb}kb`);

/* ================================================================ images */

// What each size is typically for, and roughly what fits at good quality.
// (A photo encodes at ~1 bit per pixel as a good-quality JPEG.)
const IMAGE_SIZES = {
  10: {
    use: 'signatures and tiny thumbnails — NEET and JEE accept signatures from 4 KB, SSC and IBPS from 10 KB',
    fits: 'about 250 × 320 px for a photo, or a full signature at 300 × 100 px',
    tip: 'At 10 KB a photo has to be small. If the form wants a photo, check whether its minimum is really 10 KB — most exam photos are allowed 20–50 KB.',
  },
  20: {
    use: 'exam signatures (SSC and IBPS cap them at 20 KB) and small passport-style photos',
    fits: 'about 350 × 450 px — the standard 3.5 × 4.5 cm exam photo — at decent quality',
    tip: 'Crop to just the head and shoulders before compressing: fewer pixels of background means more bytes for the face.',
  },
  50: {
    use: 'exam and job-application photos — SSC, IBPS, SBI and RRB all ask for 20–50 KB',
    fits: 'about 550 × 700 px, comfortably more than any exam portal asks for',
    tip: 'A plain, light background compresses far better than a busy room behind you.',
  },
  100: {
    use: 'university, scholarship and job-portal uploads, and photos attached to visa or passport applications',
    fits: 'about 800 × 1000 px — sharp on screen and fine for most printed forms',
    tip: 'If the form also has a pixel limit, set it first in Resize Image, then compress.',
  },
  200: {
    use: 'NTA exams (NEET, JEE Main and CUET accept photos up to 200 KB), email attachments and websites',
    fits: 'about 1100 × 1450 px — close to full-HD',
    tip: 'Most phone photos land under 200 KB without being resized at all, just by lowering the JPEG quality a little.',
  },
  500: {
    use: 'documents photographed on a phone, ID card scans, listings and portfolio uploads',
    fits: 'about 1700 × 2300 px — enough to read small print on a photographed document',
    tip: 'For a photographed page, the Document Scanner gives a cleaner, smaller result than compressing the raw photo.',
  },
};
export const IMAGE_SIZE_PRESETS = Object.keys(IMAGE_SIZES).map(Number);

function imageSizePage(kb, indexed) {
  const size = kbText(kb);
  const info = IMAGE_SIZES[kb];
  const others = IMAGE_SIZE_PRESETS.filter((k) => k !== kb).slice(0, 4);
  return {
    slug: `compress-image-to-${kbSlug(kb)}`,
    toolId: 'compress-image',
    toolProps: { presetKB: kb, presetFormat: 'jpeg' },
    group: 'image-size',
    label: `Image to ${size}`,
    indexed,
    title: `Compress Image to ${size.replace(' ', '')} Online – Resize Photo to ${size}`,
    h1: `Compress Image to ${size}`,
    description: `Reduce a photo to under ${size} in seconds — the target is already set to ${size}, it keeps the best quality that fits and resizes only if it must. JPG output for forms. Free, nothing uploaded.`,
    seo: {
      breadcrumb: `Compress Image to ${size}`,
      h1: `How to reduce an image to ${size}`,
      intro: `Drop a JPG, PNG or WebP above — the target is preset to ${size}. FileQuick lowers the JPEG quality step by step until the file is just under ${size}, and only scales the picture down if quality alone can't get there. It runs in your browser, so the photo never leaves your device.`,
      body: [
        info
          ? `${size} is a common upload limit for ${info.use}. At this size you can expect ${info.fits}.`
          : `Set any size you need — the tool searches for the highest JPEG quality that fits under ${size}.`,
        'Compress and resize mean different things: resizing changes the width and height in pixels, compressing changes how many bytes those pixels take. Most "resize image to KB" searches really need compression, which is what this page does first — it only resizes when the target is too small for the photo at its current dimensions.',
        'The result is always a JPG, because that is the format online forms accept and the one that gets smallest. A PNG or WebP you drop in is converted automatically; transparency becomes white.',
        ...(info ? [info.tip] : []),
      ],
      steps: [
        'Drop your image (or several) onto the box above.',
        `The target is already ${size} — change it if your form says something else.`,
        'Click Compress. Each image is brought just under the target, and resized only if needed.',
        'Check the preview and file size, then download the JPG (or all of them as a ZIP).',
      ],
      faqs: [
        { q: `How do I reduce my photo size to ${size}?`, a: `Upload it here — the target is set to ${size}. The tool lowers quality until the file is just under ${size}; a very small target on a large photo also reduces the pixel size, because quality alone can't reach it.` },
        { q: `Will my image look worse at ${size}?`, a: kb <= 20 ? 'Somewhat — at this size the picture has to be small or noticeably compressed. Cropping out empty background first keeps the face sharper.' : 'Usually not noticeably. It keeps the highest quality that still fits, and only shrinks the dimensions when there is no other way.' },
        { q: 'Is "resize image to KB" the same as this?', a: `Yes — when a form says "resize to ${size}" it means the file size. This tool hits the file size; if you also need exact pixels (for example 200 × 230), use the Exam Photo Resizer, which does both.` },
        { q: 'Is my photo uploaded anywhere?', a: 'No. Compression runs in your browser with the Canvas API — the image never leaves your device.' },
        { q: 'Can I do several photos at once?', a: `Yes. Drop as many as you like; each is compressed to ${size} and you can download them together as a ZIP.` },
      ],
      related: [
        { id: 'exam-photo-resizer', text: 'exact pixels and KB for exam forms in one go' },
        { id: 'signature-resizer', text: 'signatures cleaned up and sized for forms' },
        ...others.map((k) => ({ id: `compress-image-to-${kbSlug(k)}`, text: `when the limit is ${kbText(k)}` })),
        { id: 'resize-image', text: 'change the width and height in pixels' },
        { id: 'passport-photo', text: 'passport and visa photos with the right background' },
      ],
    },
  };
}

/* ============================================================ exam pages */

const EXAMS = {
  ssc: {
    slug: 'ssc-photo-resizer',
    name: 'SSC',
    exams: 'SSC CGL, CHSL, MTS, GD, CPO and Stenographer',
    title: 'SSC Photo Resizer – Photo 20–50 KB & Signature 10–20 KB (CGL, CHSL, MTS)',
    h1: 'SSC Photo & Signature Resizer',
    intro: 'Resize your photo and signature for the SSC application form — photo 20–50 KB, signature 10–20 KB, JPG. The SSC preset is already selected; nothing is uploaded.',
    rejections: [
      'Signature above 20 KB or below 10 KB — the most common SSC upload error. The tool lands it inside the window, topping up tiny files.',
      'Signature in capital letters — SSC rejects it. Sign in running hand.',
      'Photo with a cap, dark glasses or a busy background.',
    ],
  },
  upsc: {
    slug: 'upsc-photo-resizer',
    name: 'UPSC',
    exams: 'UPSC Civil Services (IAS), NDA, CDS, CAPF, ESE and other UPSC exams',
    title: 'UPSC Photo Resizer – Photo & Signature 20–300 KB, 350–1000 px (OTR)',
    h1: 'UPSC Photo & Signature Resizer',
    intro: 'Resize your photo and signature for UPSC One Time Registration and exam forms — 20–300 KB JPG, between 350 and 1000 px on each side. Nothing is uploaded.',
    rejections: [
      'Image smaller than 350 px on any side — UPSC rejects it even if the KB size is fine.',
      'File under 20 KB — very plain signatures can come out this small; the tool tops them up automatically.',
      'Photo older than the limit in the notice, or with the face too small in the frame.',
    ],
  },
  ibps: {
    slug: 'ibps-photo-resizer',
    name: 'IBPS & SBI',
    exams: 'IBPS PO, Clerk, SO and RRB, SBI PO and Clerk, RBI and other bank exams',
    title: 'IBPS & SBI Photo Resizer – 200×230 px Photo, 140×60 px Signature',
    h1: 'IBPS & SBI Photo & Signature Resizer',
    intro: 'Make the photo (200 × 230 px, 20–50 KB) and signature (140 × 60 px, 10–20 KB) that IBPS and SBI forms ask for. Thumb impression? Use the Signature Resizer\'s thumb preset.',
    rejections: [
      'A signature photographed with lots of empty paper around it looks tiny at 140 × 60 — the auto-clean trims the paper so the ink fills the box.',
      'Left thumb impression smudged or too faint — press firmly on a fresh ink pad.',
      'Handwritten declaration not in your own handwriting or not in English.',
    ],
  },
  rrb: {
    slug: 'rrb-photo-resizer',
    name: 'RRB (Railway)',
    exams: 'RRB NTPC, Group D, ALP, JE and other Railway Recruitment Board exams',
    title: 'RRB Photo Resizer – Railway Photo 20–50 KB & Signature Resize (NTPC, Group D)',
    h1: 'RRB Railway Photo & Signature Resizer',
    intro: 'Resize your photo (20–50 KB) and signature for Railway (RRB) applications — NTPC, Group D, ALP. Check your CEN notification for the exact numbers; adjust them with Custom size.',
    rejections: [
      'Photo not recent or face not clearly visible — RRB also matches it at the exam centre.',
      'Signature in capital letters or in pencil.',
      'Wrong format — upload JPG, not PNG or PDF.',
    ],
  },
  nta: {
    slug: 'neet-photo-resizer',
    name: 'NEET',
    exams: 'NEET UG, JEE Main, CUET and other NTA exams',
    title: 'NEET Photo Resizer – Photo 10–200 KB & Signature 4–30 KB (NTA, JEE, CUET)',
    h1: 'NEET Photo & Signature Resizer',
    intro: 'Resize your passport-size photo (10–200 KB) and signature (4–30 KB) for NEET, JEE Main and CUET forms. The NTA preset is already selected; nothing is uploaded.',
    rejections: [
      'Photo with less than about 80 % of the frame showing your face, or not on a white background.',
      'Signature in capital letters — NTA asks for running hand in black ink.',
      'Using an old photo — NTA asks for a recent one taken in the exam year.',
    ],
  },
};

function examPage(key) {
  const e = EXAMS[key];
  const s = getFormSpec(key);
  return {
    slug: e.slug,
    toolId: 'exam-photo-resizer',
    toolProps: { presetKey: key, heading: e.h1, intro: e.intro },
    group: 'exam',
    label: `${e.name} photo`,
    indexed: true,
    title: e.title,
    h1: e.h1,
    description: `${e.intro.split('.')[0]}. Crops, sets a white background and hits the KB limit automatically. Free, works on your phone.`,
    seo: {
      breadcrumb: e.h1,
      h1: `How to resize your photo and signature for ${e.name}`,
      intro: `This page opens the Exam Photo & Signature Resizer with the ${e.name} sizes already chosen. It centre-crops your photo to the right shape, can replace the background with white or light blue, trims and whitens your signature, and brings each file inside the KB range — all in your browser.`,
      body: [
        `Used for: ${e.exams}.`,
        `Sizes used here — photo: ${specLine(s.photo)}; signature: ${specLine(s.sign)}.${s.thumb ? ` Thumb impression: ${specLine(s.thumb)}.` : ''}`,
        s.note,
        `Common reasons ${e.name} uploads get rejected: ${e.rejections.join(' ')}`,
        'Portals change the numbers between recruitment cycles. If your notification says something different, pick "Custom size" and type its numbers in — everything else works the same.',
      ],
      steps: [
        `The ${e.name} preset is already selected above.`,
        'Add your photo — a clear, front-facing picture. Use Crop if you need to frame it, and tick "Remove & replace the background" for a plain white one.',
        'Add your signature — sign on white paper and photograph it. It is trimmed and whitened automatically.',
        'Press "Prepare for the form", check the green "Within limits" badges, and download.',
      ],
      faqs: [
        { q: `What is the photo size for ${e.name}?`, a: `${specLine(s.photo)} is what this preset produces. Always confirm against the current notification.` },
        { q: `What is the signature size for ${e.name}?`, a: `${specLine(s.sign)}. Sign in running hand (not capital letters) with a black or blue pen on white paper.` },
        { q: 'My signature file is too small — what do I do?', a: 'Nothing: if the file comes out under the minimum KB, the tool tops it up to the minimum without changing the picture, so the portal accepts it.' },
        { q: 'Can I do this on my phone?', a: 'Yes. Take the photos with your phone camera and use this page in your phone browser — no app needed.' },
        { q: 'Are my photo and signature uploaded?', a: 'No. Everything is processed on your device; the only thing that leaves it is the file you choose to upload to the exam portal.' },
      ],
      related: [
        { id: 'signature-resizer', text: 'signature or thumb impression only' },
        ...Object.keys(EXAMS).filter((k) => k !== key).map((k) => ({ id: EXAMS[k].slug, text: `${EXAMS[k].name} sizes` })),
        { id: 'compress-image-to-50kb', text: 'just get a photo under 50 KB' },
        { id: 'passport-photo', text: 'printable passport-size photos' },
      ],
    },
  };
}

const SSC_SIGN = {
  slug: 'ssc-signature-resizer',
  toolId: 'signature-resizer',
  toolProps: {
    presetKey: 'ssc',
    heading: 'SSC Signature Resizer',
    intro: 'Make your signature exactly what the SSC form accepts — JPG, 10–20 KB, 6 × 2 cm. It trims the empty paper and makes the background white automatically. Nothing is uploaded.',
  },
  group: 'exam',
  label: 'SSC signature',
  indexed: true,
  title: 'SSC Signature Resizer – Resize Signature to 10–20 KB JPG (6 × 2 cm)',
  h1: 'SSC Signature Resizer',
  description: 'Resize your signature for SSC CGL, CHSL, MTS and GD forms: 10–20 KB JPG, 6 × 2 cm. Auto-trims the paper and whitens the background. Free, nothing uploaded.',
  seo: {
    breadcrumb: 'SSC Signature Resizer',
    h1: 'How to resize your signature for the SSC form',
    intro: 'SSC rejects signatures outside 10–20 KB, and a signature photographed on a phone is usually far bigger — with grey paper and shadows around it. This page fixes all of that in one step.',
    body: [
      'What it does: finds your signature on the page, crops away the empty paper, flattens shadows to pure white, fits the signature into the SSC size and saves a JPG between 10 and 20 KB. If a very clean signature would come out under 10 KB, the file is topped up to the minimum without changing the picture.',
      'SSC asks for a signature in running hand — not in capital letters — with black or blue ink on white paper. A thick pen photographs better than a thin one.',
      'Doing the photo as well? The SSC Photo & Signature Resizer prepares both together.',
    ],
    steps: [
      'Sign on plain white paper and photograph it from straight above in good light.',
      'Drop the photo above — the SSC preset is already selected.',
      'Check the result: it should say "Ready to upload" with a size between 10 and 20 KB.',
      'Download the JPG and upload it to the SSC portal.',
    ],
    faqs: [
      { q: 'What is the SSC signature size?', a: '10–20 KB, JPG, about 6.0 × 2.0 cm. This page produces a 300 × 100 px JPG inside that range.' },
      { q: 'Why does the SSC portal say my signature is too small?', a: 'A clean signature compresses to just a few KB. This tool tops the file up to the 10 KB minimum so it is accepted, without changing the image.' },
      { q: 'Can I use a signature in capital letters?', a: 'No — SSC explicitly rejects signatures in capital letters. Sign the way you normally do.' },
      { q: 'Is my signature uploaded to your server?', a: 'No. It is processed in your browser and never leaves your device.' },
    ],
    related: [
      { id: 'ssc-photo-resizer', text: 'SSC photo and signature together' },
      { id: 'signature-resizer', text: 'signatures for other exams and forms' },
      { id: 'compress-image-to-20kb', text: 'any image under 20 KB' },
    ],
  },
};

/* ================================================================== PDF */

const PDF_SIZES = {
  100: {
    fits: 'one or two scanned pages at readable quality, or a text-only PDF of many pages',
    use: 'certificates, mark sheets and ID proofs on exam and government portals',
  },
  200: {
    fits: 'two to four scanned pages, or a digital PDF with a few photos',
    use: 'admission forms, caste and income certificates, and bank KYC uploads',
  },
  500: {
    fits: 'around five to ten scanned pages',
    use: 'job applications, scholarship documents and multi-page forms',
  },
  1024: {
    fits: 'ten to twenty scanned pages, or a long report with images',
    use: 'email attachments, tender documents and portals with a 1 MB cap',
  },
};
export const PDF_SIZE_PRESETS = Object.keys(PDF_SIZES).map(Number);

function pdfSizePage(kb, indexed) {
  const size = kbText(kb);
  const info = PDF_SIZES[kb];
  const others = PDF_SIZE_PRESETS.filter((k) => k !== kb);
  return {
    slug: `compress-pdf-to-${kbSlug(kb)}`,
    toolId: 'pdf-compressor',
    toolProps: { presetKB: kb },
    group: 'pdf-size',
    label: `PDF to ${size}`,
    indexed,
    title: kb === 1024
      ? 'Reduce PDF to 1 MB – Compress PDF Under 1 MB Online Free'
      : `Compress PDF to ${size} Online – Reduce PDF File Size to ${size}`,
    h1: kb === 1024 ? 'Compress PDF to 1 MB' : `Compress PDF to ${size}`,
    description: `Shrink a PDF to under ${size} for an upload limit. It keeps text sharp and selectable and lowers image quality only as far as needed to fit ${size}. Free, no sign-up.`,
    seo: {
      breadcrumb: `Compress PDF to ${size}`,
      h1: `How to reduce a PDF to ${size}`,
      intro: `Drop your PDF above — "Aim for a target size" is already set to ${size}. The engine tries a lossless clean-up first, then recompresses the images inside the PDF, searching for the highest image quality that still fits under ${size}. Text and fonts are never rasterised, so they stay sharp and searchable.`,
      body: [
        info
          ? `${size} usually holds ${info.fits}. It is a typical limit for ${info.use}.`
          : `Any target works — the engine stops at the sharpest version that fits under ${size}.`,
        'What makes a PDF big is almost always the pictures in it — scanned pages are one big photo each. Text costs very little. That is why a scanned 10-page certificate bundle needs much more squeezing than a 50-page typed report.',
        `If the result still doesn't fit, the tool tells you instead of quietly wrecking the file. Then: delete pages the form doesn't need with Remove Pages, or split the PDF and upload the parts. For scans, rescanning at 150 DPI in greyscale makes a much smaller starting file.`,
        'Your PDF is sent over a secure connection to our compression server, processed, and deleted straight away — it is never stored or looked at.',
      ],
      steps: [
        'Drop your PDF onto the box above.',
        `The target is already ${size} — tap another size or type your own if the form asks for something else.`,
        'Click Compress PDF and wait a few seconds.',
        `Check the new size (it should be under ${size}) and download.`,
      ],
      faqs: [
        { q: `How do I compress a PDF to ${size}?`, a: `Upload it here — the ${size} target is already set. The engine recompresses the images inside the PDF until it fits, keeping the text as real, selectable text.` },
        { q: 'Will my PDF become blurry?', a: 'Text stays perfectly sharp. Photos and scanned pages get softer the smaller the target — the engine keeps the highest quality that still fits.' },
        { q: `What if my PDF can't get down to ${size}?`, a: 'You will see "Target not reached" with the smallest safe version. Remove pages you don\'t need, or split the PDF, and try again.' },
        { q: 'Is it safe to upload my documents?', a: 'The file travels over HTTPS, is processed on our server and deleted immediately afterwards. Nothing is kept.' },
      ],
      related: [
        { id: 'delete-pages', text: 'drop pages the form doesn\'t need' },
        { id: 'split-pdf', text: 'upload a big PDF in parts' },
        ...others.map((k) => ({ id: `compress-pdf-to-${kbSlug(k)}`, text: `when the limit is ${kbText(k)}` })),
        { id: 'image-to-pdf', text: 'turn photos into a PDF first' },
        { id: 'document-scanner', text: 'clean, small scans from phone photos' },
      ],
    },
  };
}

/* ============================================================== registry */

export const LANDING_PAGES = [
  ...IMAGE_SIZE_PRESETS.map((kb) => imageSizePage(kb, true)),
  ...Object.keys(EXAMS).map(examPage),
  SSC_SIGN,
  ...PDF_SIZE_PRESETS.map((kb) => pdfSizePage(kb, true)),
];

const BY_SLUG = new Map(LANDING_PAGES.map((p) => [p.slug, p]));

const SIZE_RE = /^compress-(image|pdf)-to-(\d+)(kb|mb)$/;
// sane bounds for ad-hoc sizes (anything else is a 404)
const LIMITS = { image: [1, 25 * 1024], pdf: [20, 100 * 1024] };

/**
 * The landing page for a URL slug: a registered page, or an ad-hoc size like
 * /compress-image-to-37kb (works, but noindex). null if it isn't one.
 */
export function getLandingPage(slug) {
  const s = (slug || '').toLowerCase();
  if (BY_SLUG.has(s)) return BY_SLUG.get(s);
  const m = SIZE_RE.exec(s);
  if (!m) return null;
  const kb = parseInt(m[2], 10) * (m[3] === 'mb' ? 1024 : 1);
  const [lo, hi] = LIMITS[m[1]];
  if (!(kb >= lo && kb <= hi)) return null;
  const page = m[1] === 'image' ? imageSizePage(kb, false) : pdfSizePage(kb, false);
  // canonical spelling of the size (e.g. 1024kb -> 1mb)
  return page.slug === s ? page : { ...page, redirect: page.slug };
}

/** Indexable pages of a group, for internal links. */
export const getLandingGroup = (group) => LANDING_PAGES.filter((p) => p.group === group && p.indexed);

/** What the router hands ToolWrapper for a landing page. */
export const landingPageMeta = (p) => ({
  title: p.title,
  h1: p.h1,
  description: p.description,
  robots: p.indexed ? 'index, follow' : 'noindex, follow',
  path: `/${p.slug}`,
  seoContent: { ...p.seo, path: `/${p.slug}`, seoDescription: p.description },
});

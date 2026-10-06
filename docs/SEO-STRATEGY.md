# FileQuick SEO strategy — "exact file preparation for online forms"

Positioning: not another iLovePDF clone. FileQuick wins where a generic tool
fails — getting a **photo, signature or PDF to exactly what an online form
accepts** (pixels, a KB *window*, JPG, white background), on a phone, without
uploading anything.

Rule for new pages: a page exists only if it is a **working tool** (an
existing tool with a preset) **and** its content answers a different question.
Same tool + same intent = one page; other spellings 308-redirect to it.

## 1. What already existed (reused, not rebuilt)

| Need | Existing tool | Notes |
| --- | --- | --- |
| Image to N KB | `compress-image` (`ImageCompress.jsx`) | target-KB mode, resizes only if quality can't reach it, batch + ZIP |
| Pixels + KB for exams | `exam-photo-resizer` | presets, crop, background replace |
| Passport / visa photo | `passport-photo` | country sizes, print sheet |
| Resize by px / % / KB | `resize-image` | |
| PDF to a size | `pdf-compressor` + server `/pdf/compress` | had `targetKb`, but stopped at fixed presets |
| PDF editing | `pdf-editor`, `fill-sign` | edit text, add text/images/signatures, forms |
| PDF pages | `delete-pages`, `organize-pdf`, `rotate-pdf`, `extract-pages`, `split-pdf`, `merge-pdf` | |
| Conversions | `image-to-pdf`, `pdf-to-jpg` (JPG + PNG), `pdf-to-word`, `word-to-pdf`, … | |
| Missing | — | dedicated signature tool (trim / whiten / KB window), below-minimum KB handling, PDF target search, landing pages, real 404 |

## 2–4. Keyword → page map (consolidated)

| Keywords (from the 100) | Page | Status |
| --- | --- | --- |
| 1–20: compress / resize / reduce image to 20/50/100 KB, image compressor to N KB, photo resize to N KB, compress jpg to N KB, reduce jpg size to N KB | `/compress-image-to-{10,20,50,100,200,500}kb` | **new** (one page per size, size-specific content). `/jpg-to-Nkb`, `/resize-image-to-Nkb`, `/reduce-image-size-to-Nkb`, … 308 here |
| 21–24: SSC photo / signature resize(r) | `/ssc-photo-resizer` (photo + signature) and `/ssc-signature-resizer` (signature only) | **new** |
| 25–27: UPSC photo / signature | `/upsc-photo-resizer` | **new** |
| 28–29: NEET photo / signature | `/neet-photo-resizer` (NEET, JEE, CUET) | **new** |
| 30–33: IBPS / SBI photo / signature | `/ibps-photo-resizer` (`/sbi-photo-resizer` → here) | **new** |
| 34–36: RRB / railway | `/rrb-photo-resizer` (`/railway-photo-resizer` → here) | **new** |
| 37–40: government exam / exam photo / exam signature / photo for online form | `/exam-photo-resizer` (hub) | existing, retitled |
| 41–45, 48–49: passport photo resize / maker / 50 KB / 100 KB, visa photo | `/passport-photo` (`/passport-photo-resizer` → here); KB caps link to `/compress-image-to-{50,100}kb` | existing, retitled |
| 46–47: PAN card photo / signature | `/exam-photo-resizer` + `/signature-resizer` custom size | not a separate page yet (spec not verified) |
| 50–60: signature resize (online / 10 / 20 / 50 KB), signature compressor, scanned signature, thumb impression | `/signature-resizer` | **new tool** |
| 61–65, 70: compress pdf, pdf compressor, reduce pdf size, pdf size reducer | `/pdf-compressor` (`/compress-pdf`, `/reduce-pdf-size` → here) | existing |
| 66–69: compress pdf to 100 / 200 / 500 KB, reduce pdf to 1 MB | `/compress-pdf-to-{100,200,500}kb`, `/compress-pdf-to-1mb` | **new** |
| 71–75: pdf editor online, edit pdf, free pdf editor, edit pdf free, add text to pdf | `/pdf-editor` (`/edit-pdf`, `/add-text-to-pdf` → here) | existing, retitled |
| 76: add image to pdf | `/pdf-editor` | existing |
| 77–80: add signature to pdf, sign pdf, fill pdf, fill and sign | `/fill-sign` (`/add-signature-to-pdf`, `/sign-pdf`, `/fill-pdf` → here) | existing, retitled |
| 81–84: merge / split pdf | `/merge-pdf`, `/split-pdf` | existing |
| 85–86: remove / delete pages | `/delete-pages` (`/remove-pdf-pages` → here) | existing, retitled |
| 87, 90: reorder pages, page organizer | `/organize-pdf` (`/reorder-pdf-pages` → here) | existing, retitled |
| 88: rotate pdf pages | `/rotate-pdf` | existing |
| 89: extract pages | `/extract-pages` | existing |
| 91–100: pdf↔word, pdf→jpg/png/image, jpg/png/image→pdf | existing converters; `/pdf-to-png`, `/png-to-pdf`, `/jpg-to-pdf` → canonical | existing |

Why not more pages: "resize image to 50kb" vs "compress image to 50kb" vs
"image compressor 50kb" is the same job on the same tool — three pages would
compete with each other and read as thin. Same for SSC photo vs SSC
signature resize on the photo+signature tool (the signature-only page exists
because it is a different tool). Other sizes (e.g. 37 KB) still work by URL but
are `noindex`.

## 5. URL structure

Root-level slugs, matching every existing tool (`/resize-image`), not
`/tools/...` — `/tools/<x>` and `/tool/<x>` 308 to `/<x>`.

- Sizes: `/compress-image-to-50kb`, `/compress-pdf-to-1mb`
- Exams: `/<exam>-photo-resizer`, `/ssc-signature-resizer`
- Tools: `/signature-resizer`, `/exam-photo-resizer`, …

## 6. Titles / H1 of the priority pages

| Page | `<title>` (+ " — FileQuick") | H1 |
| --- | --- | --- |
| /compress-image-to-20kb | Compress Image to 20KB Online – Resize Photo to 20 KB | Compress Image to 20 KB |
| /compress-image-to-50kb | Compress Image to 50KB Online – Resize Photo to 50 KB | Compress Image to 50 KB |
| /compress-image-to-100kb | Compress Image to 100KB Online – Resize Photo to 100 KB | Compress Image to 100 KB |
| /ssc-photo-resizer | SSC Photo Resizer – Photo 20–50 KB & Signature 10–20 KB (CGL, CHSL, MTS) | SSC Photo & Signature Resizer |
| /ssc-signature-resizer | SSC Signature Resizer – Resize Signature to 10–20 KB JPG (6 × 2 cm) | SSC Signature Resizer |
| /upsc-photo-resizer | UPSC Photo Resizer – Photo & Signature 20–300 KB, 350–1000 px (OTR) | UPSC Photo & Signature Resizer |
| /passport-photo | Passport Size Photo Maker & Resizer – India, US, UK, Visa | Passport Photo Maker |
| /signature-resizer | Signature Resizer – Resize Signature to 10KB, 20KB or 50KB Online | Signature Resizer |
| /compress-pdf-to-100kb | Compress PDF to 100 KB Online – Reduce PDF File Size to 100 KB | Compress PDF to 100 KB |
| /compress-pdf-to-200kb | Compress PDF to 200 KB Online – Reduce PDF File Size to 200 KB | Compress PDF to 200 KB |
| /compress-pdf-to-500kb | Compress PDF to 500 KB Online – Reduce PDF File Size to 500 KB | Compress PDF to 500 KB |
| /pdf-editor | PDF Editor Online Free – Edit Text, Add Text, Images & Signatures | PDF Editor |
| /delete-pages | Remove Pages from PDF – Delete PDF Pages Online Free | Remove Pages |
| /organize-pdf | Reorder PDF Pages – Organize & Rearrange PDF Online Free | Organize PDF |
| /fill-sign | Fill and Sign PDF Online Free – Add Signature to PDF | Fill & Sign |

## 7. Technical implementation

- `src/data/landingPages.js` — the registry: tool + preset + content per page.
  Read by the router, the pre-renderer and the internal-link strip.
- `src/data/formSpecs.js` — exam photo / signature / thumb specs, shared.
- `src/data/redirects.js` — every alias; `scripts/sync-vercel.mjs` writes them
  into `vercel.json` as real 308s; the build fails if they drift.
- `scripts/prerender.mjs` — static HTML for every indexable page (own title,
  description, canonical, OG, JSON-LD, visible how-to/FAQ), `sitemap.xml`
  built from exactly those pages, `robots.txt`, and `404.html`.
- 404s: unknown URLs return a real 404 (Vercel serves `404.html`) and the app
  shows "page not found" instead of silently sending people home.
- Tool above the fold on every landing page; SEO copy below it.
- New `lib/formPrep.js`: signature/thumb clean-up (paper-illumination
  normalisation, Otsu ink threshold, connected-component trim that ignores dust
  and the desk), contain-fit on white, KB *window* (max as 1000-byte KB, min as
  1024-byte KB, lossless JPEG padding up to the minimum).
- Server: PDF target size now searches image cap × JPEG quality for the
  sharpest result that fits, instead of stopping at fixed presets.

## Next (not done yet)

1. Google Search Console + Bing Webmaster: submit `/sitemap.xml`, request
   indexing for the priority pages above.
2. Passport photo: add an optional "max KB" to the download (digital copies for
   visa portals), then point "passport photo 50kb/100kb" there.
3. IBPS extra slots (left thumb impression, handwritten declaration) inside the
   exam tool; PAN card preset once NSDL/UTIITSL specs are confirmed.
4. Backlinks/mentions: exam-prep forums, Telegram/WhatsApp study groups,
   college notice boards — the form-prep angle is very shareable.

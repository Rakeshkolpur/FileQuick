/**
 * Photo / signature / thumb-impression specs for Indian exam and application
 * forms — one list shared by the Exam Photo & Signature Resizer, the Signature
 * Resizer and their landing pages, so a spec is only ever written once.
 *
 * { w, h } in px, { min, max } in KB. The KB limits are what portals enforce
 * hardest; pixel sizes are the commonly accepted ones (portals tweak both
 * between recruitment cycles, so the UI always says "check the notification").
 */
export const FORM_SPECS = [
  {
    key: 'ssc', name: 'SSC (CGL / CHSL / MTS / GD)', short: 'SSC',
    photo: { w: 350, h: 450, min: 20, max: 50 },
    sign: { w: 300, h: 100, min: 10, max: 20 },
    note: 'SSC asks for a 3.5 × 4.5 cm photo of 20–50 KB and a 6.0 × 2.0 cm signature of 10–20 KB, both JPG. On the new portal the photo is often captured live by webcam — you still upload the signature.',
  },
  {
    key: 'upsc', name: 'UPSC (Civil Services / NDA / CDS)', short: 'UPSC',
    photo: { w: 350, h: 450, min: 20, max: 300 },
    sign: { w: 500, h: 350, min: 20, max: 100 },
    note: 'UPSC accepts JPG photos and signatures of 20–300 KB, each between 350 × 350 and 1000 × 1000 px. We keep the signature under 100 KB, which every UPSC form accepts.',
  },
  {
    key: 'ibps', name: 'IBPS / SBI / Bank exams', short: 'IBPS / SBI',
    photo: { w: 200, h: 230, min: 20, max: 50 },
    sign: { w: 140, h: 60, min: 10, max: 20 },
    thumb: { w: 240, h: 240, min: 20, max: 50 },
    note: 'IBPS and SBI ask for a 200 × 230 px photo (20–50 KB), a 140 × 60 px signature (10–20 KB) and a 240 × 240 px left thumb impression (20–50 KB), all JPG.',
  },
  {
    key: 'rrb', name: 'RRB / Railway (NTPC / Group D / ALP)', short: 'RRB',
    photo: { w: 350, h: 450, min: 20, max: 50 },
    sign: { w: 140, h: 60, min: 10, max: 40 },
    note: 'Railway (RRB) forms usually want a 3.5 × 4.5 cm JPG photo of 20–50 KB and a signature of 10–40 KB; the exact numbers are in each CEN notification.',
  },
  {
    key: 'nta', name: 'NTA (NEET / JEE Main / CUET)', short: 'NEET / JEE',
    photo: { w: 350, h: 450, min: 10, max: 200 },
    sign: { w: 300, h: 130, min: 4, max: 30 },
    thumb: { w: 300, h: 300, min: 10, max: 200 },
    note: 'NTA exams (NEET, JEE Main, CUET) take a passport-size JPG photo of 10–200 KB and a signature of 4–30 KB in black ink on white paper.',
  },
  {
    key: 'passport', name: 'Passport size (3.5 × 4.5 cm, 300 DPI)', short: 'Passport size',
    photo: { w: 413, h: 531, min: 20, max: 240 },
    sign: { w: 413, h: 155, min: 10, max: 60 },
  },
  {
    key: 'custom', name: 'Custom size', short: 'Custom',
    photo: { w: 200, h: 230, min: 10, max: 50 },
    sign: { w: 140, h: 60, min: 5, max: 20 },
    thumb: { w: 240, h: 240, min: 10, max: 50 },
  },
];

export const getFormSpec = (key) => FORM_SPECS.find((s) => s.key === key) || null;

export const specLine = (s) => `${s.w}×${s.h}px · ${s.min}–${s.max} KB · JPG`;

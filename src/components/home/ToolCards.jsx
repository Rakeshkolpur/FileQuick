import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowRight, LuUploadCloud, LuX } from 'react-icons/lu';
import { screenFiles, rejectionMessage } from '../../lib/fileValidation';
import { handOffFile } from '../../lib/fileHandoff';
import { stashPdf } from '../../lib/pdfHandoff';

/**
 * The homepage's three start cards. Each one is a real upload area (drop or
 * browse) that screens the file and hands it, name intact, to the tool that
 * does the work:
 *  - Image Resizer → /resize-image (fileHandoff → its FileDropzone)
 *  - PDF Converter → a PDF picks its target (pdfHandoff); Office / text files
 *    go to their "… to PDF" converter (fileHandoff), same as the File Converter hub
 *  - PDF Editor    → /pdf-editor (pdfHandoff)
 */

/* ---------- illustrations (original, theme-aware) ---------- */

const ImageArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <rect x="8" y="16" width="70" height="54" rx="8" className="fill-teal-100 dark:fill-teal-400/15" />
    <rect x="24" y="8" width="78" height="60" rx="9" className="fill-white stroke-teal-500 dark:fill-gray-900 dark:stroke-teal-400" strokeWidth="2.5" />
    <circle cx="44" cy="26" r="6" className="fill-amber-400" />
    <path d="M30 60l18-20 12 13 9-9 27 16z" className="fill-teal-500 dark:fill-teal-400" />
    <path d="M84 50l22 22M106 72h-10M106 72V62" className="stroke-teal-600 dark:stroke-teal-300" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const Doc = ({ x, label, fill, text }) => (
  <g transform={`translate(${x} 8)`}>
    <path d="M0 6a6 6 0 016-6h24l14 14v48a6 6 0 01-6 6H6a6 6 0 01-6-6z" className="fill-white stroke-gray-300 dark:fill-gray-900 dark:stroke-gray-600" strokeWidth="2" />
    <path d="M30 0v10a4 4 0 004 4h10" className="fill-none stroke-gray-300 dark:stroke-gray-600" strokeWidth="2" />
    <rect x="-4" y="36" width="34" height="16" rx="4" className={fill} />
    <text x="13" y="48" textAnchor="middle" className={text} fontSize="10" fontWeight="800" fontFamily="system-ui, sans-serif">{label}</text>
  </g>
);

const ConvertArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <Doc x={6} label="PDF" fill="fill-rose-500" text="fill-white" />
    <Doc x={70} label="DOC" fill="fill-blue-600" text="fill-white" />
    <path d="M54 30h14m-5-5l5 5-5 5M66 52H52m5 5l-5-5 5-5" className="stroke-blue-500 dark:stroke-blue-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const EditArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <path d="M22 14a6 6 0 016-6h30l16 16v48a6 6 0 01-6 6H28a6 6 0 01-6-6z" className="fill-white stroke-violet-400 dark:fill-gray-900 dark:stroke-violet-400" strokeWidth="2.5" />
    <path d="M58 8v12a4 4 0 004 4h12" className="fill-none stroke-violet-400" strokeWidth="2.5" />
    <rect x="16" y="30" width="34" height="16" rx="4" className="fill-rose-500" />
    <text x="33" y="42" textAnchor="middle" className="fill-white" fontSize="10" fontWeight="800" fontFamily="system-ui, sans-serif">PDF</text>
    <path d="M32 56h30M32 64h20" className="stroke-violet-200 dark:stroke-violet-400/40" strokeWidth="3" strokeLinecap="round" />
    <g transform="rotate(45 90 46)">
      <rect x="83" y="14" width="14" height="50" rx="3" className="fill-violet-600 dark:fill-violet-500" />
      <rect x="83" y="14" width="14" height="9" rx="3" className="fill-violet-300" />
      <path d="M83 64h14l-7 13z" className="fill-amber-200" />
      <path d="M88 73.5h4L90 77z" className="fill-gray-700" />
    </g>
  </svg>
);

/* ---------- per-card colour (full class strings so Tailwind keeps them) ---------- */

const TONES = {
  teal: {
    card: 'border-teal-400/70 dark:border-teal-400/45 hover:shadow-teal-500/15',
    glow: 'from-teal-400/10 dark:from-teal-400/[0.08]',
    zone: 'border-teal-300 bg-teal-50/60 dark:border-teal-400/35 dark:bg-teal-400/[0.04]',
    zoneOn: 'border-teal-500 bg-teal-100/70 dark:border-teal-300 dark:bg-teal-400/15',
    icon: 'text-teal-500 dark:text-teal-300',
    link: 'text-teal-600 dark:text-teal-300',
    btn: 'bg-teal-600 hover:bg-teal-700 focus-visible:ring-teal-500 shadow-teal-600/25',
    chip: 'border-teal-200 hover:border-teal-400 hover:bg-teal-50 dark:border-teal-400/30 dark:hover:bg-teal-400/10',
  },
  blue: {
    card: 'border-blue-400/70 dark:border-blue-400/45 hover:shadow-blue-500/15',
    glow: 'from-blue-400/10 dark:from-blue-400/[0.08]',
    zone: 'border-blue-300 bg-blue-50/60 dark:border-blue-400/35 dark:bg-blue-400/[0.04]',
    zoneOn: 'border-blue-500 bg-blue-100/70 dark:border-blue-300 dark:bg-blue-400/15',
    icon: 'text-blue-500 dark:text-blue-300',
    link: 'text-blue-600 dark:text-blue-300',
    btn: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 shadow-blue-600/25',
    chip: 'border-blue-200 hover:border-blue-400 hover:bg-blue-50 dark:border-blue-400/30 dark:hover:bg-blue-400/10',
  },
  violet: {
    card: 'border-violet-400/70 dark:border-violet-400/45 hover:shadow-violet-500/15',
    glow: 'from-violet-400/10 dark:from-violet-400/[0.08]',
    zone: 'border-violet-300 bg-violet-50/60 dark:border-violet-400/35 dark:bg-violet-400/[0.04]',
    zoneOn: 'border-violet-500 bg-violet-100/70 dark:border-violet-300 dark:bg-violet-400/15',
    icon: 'text-violet-500 dark:text-violet-300',
    link: 'text-violet-600 dark:text-violet-300',
    btn: 'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-500 shadow-violet-600/25',
    chip: 'border-violet-200 hover:border-violet-400 hover:bg-violet-50 dark:border-violet-400/30 dark:hover:bg-violet-400/10',
  },
};

/* ---------- what each card takes and where it sends it ---------- */

const IMAGE_RE = /\.(jpe?g|png|webp|bmp)$/i;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/x-ms-bmp'];

// PDF Converter: non-PDF documents go to the matching "… to PDF" tool
const CONVERT_ROUTES = [
  { re: /\.(docx?|odt|rtf)$/i, to: 'word-to-pdf' },
  { re: /\.xlsx?$/i, to: 'excel-to-pdf' },
  { re: /\.pptx?$/i, to: 'powerpoint-to-pdf' },
  { re: /\.txt$/i, to: 'text-to-pdf' },
];

const PDF_TARGETS = [
  { id: 'pdf-to-word', label: 'Word' },
  { id: 'pdf-to-jpg', label: 'JPG' },
  { id: 'pdf-to-excel', label: 'Excel' },
  { id: 'pdf-to-powerpoint', label: 'PowerPoint' },
  { id: 'pdf-to-text', label: 'Text' },
];

const isPdf = (f) => /\.pdf$/i.test(f.name || '') || f.type === 'application/pdf';

const CARDS = [
  {
    key: 'image',
    tone: 'teal',
    title: 'Image Resizer',
    text: 'Resize images by dimensions or target file size.',
    formats: 'JPG, PNG, WEBP, BMP',
    accept: '.jpg,.jpeg,.png,.webp,.bmp,image/jpeg,image/png,image/webp,image/bmp',
    cta: 'Choose Image',
    Art: ImageArt,
    fits: (f) => IMAGE_RE.test(f.name || '') || IMAGE_TYPES.includes(f.type),
    wrongType: 'Please choose a JPG, PNG, WEBP or BMP image.',
  },
  {
    key: 'convert',
    tone: 'blue',
    title: 'PDF Converter',
    text: 'Convert PDF, Word, and other supported document formats.',
    formats: 'PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, RTF, ODT',
    accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf,.odt',
    cta: 'Choose PDF',
    Art: ConvertArt,
    fits: (f) => isPdf(f) || CONVERT_ROUTES.some((r) => r.re.test(f.name || '')),
    wrongType: 'Please choose a PDF, Word, Excel, PowerPoint, TXT, RTF or ODT file.',
  },
  {
    key: 'edit',
    tone: 'violet',
    title: 'PDF Editor',
    text: 'Open PDFs and use available editing tools.',
    formats: 'PDF',
    accept: '.pdf,application/pdf',
    cta: 'Open PDF Editor',
    Art: EditArt,
    fits: isPdf,
    wrongType: 'Please choose a PDF file.',
  },
];

/* ---------- one card ---------- */

const ToolCard = ({ card }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [pdf, setPdf] = useState(null); // PDF Converter: a PDF waiting for its target
  const t = TONES[card.tone];

  const browse = () => inputRef.current?.click();

  const take = async (list) => {
    setError('');
    const file = [...(list || [])][0];
    if (!file) return;
    if (!card.fits(file)) { setError(card.wrongType); return; }
    const { accepted, rejected } = screenFiles([file]);
    if (!accepted.length) { setError(rejectionMessage(rejected)); return; }

    if (card.key === 'image') {
      handOffFile(file);
      navigate('/resize-image');
    } else if (card.key === 'edit') {
      if (await stashPdf(file, file.name)) navigate('/pdf-editor');
      else setError('Could not read that PDF. Please try again.');
    } else if (isPdf(file)) {
      setPdf(file); // ask what to convert it to
    } else {
      handOffFile(file);
      navigate(`/${CONVERT_ROUTES.find((r) => r.re.test(file.name)).to}`);
    }
  };

  const convertPdf = async (toolId) => {
    if (await stashPdf(pdf, pdf.name)) navigate(`/${toolId}`);
    else setError('Could not read that PDF. Please try again.');
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!dragging) setDragging(true);
  };
  const onDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    take(e.dataTransfer.files);
  };

  return (
    <article
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`group relative flex flex-col overflow-hidden rounded-3xl border-2 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-6 dark:bg-gray-800/60 ${t.card}`}
    >
      {/* soft colour wash at the top of the card */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent ${t.glow}`} />

      <div className="relative flex items-center gap-4">
        <card.Art />
        <div className="min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">{card.title}</h3>
          <p className="mt-1 text-[13.5px] leading-snug text-gray-600 dark:text-gray-300">{card.text}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={card.accept}
        className="hidden"
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
      />

      {pdf ? (
        <div className={`relative mt-5 flex flex-1 flex-col rounded-2xl border-2 border-dashed p-4 ${t.zone}`}>
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold text-gray-900 dark:text-white" title={pdf.name}>{pdf.name}</p>
            <button
              type="button"
              onClick={() => { setPdf(null); setError(''); }}
              className="shrink-0 rounded-md p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="Choose a different file"
            >
              <LuX className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1 text-[13px] text-gray-600 dark:text-gray-300">Convert this PDF to:</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PDF_TARGETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => convertPdf(p.id)}
                className={`rounded-lg border bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-800 transition-colors dark:bg-gray-900 dark:text-gray-100 ${t.chip}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          role="presentation"
          onClick={browse}
          className={`relative mt-5 flex flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors ${dragging ? t.zoneOn : t.zone}`}
        >
          <LuUploadCloud className={`h-9 w-9 ${t.icon}`} strokeWidth={1.7} />
          <p className="mt-2 text-[15px] font-semibold text-gray-800 dark:text-gray-100">
            {dragging ? 'Drop to open' : <>Drop file here or <span className={`underline-offset-2 group-hover:underline ${t.link}`}>browse</span></>}
          </p>
          <p className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400">
            Supported formats: {card.formats}
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="relative mt-3 text-[13px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}

      <button
        type="button"
        onClick={browse}
        className={`relative mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${t.btn}`}
      >
        {pdf ? 'Choose another file' : card.cta} <LuArrowRight className="h-4 w-4" />
      </button>
    </article>
  );
};

const ToolCards = () => (
  <section aria-labelledby="start-heading">
    <div className="text-center">
      <h2 id="start-heading" className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl lg:text-5xl dark:text-white">
        What would you{' '}
        <span className="bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent dark:from-violet-400 dark:via-indigo-400 dark:to-blue-400">like to do?</span>
      </h2>
      <p className="mt-3 text-[15px] text-gray-600 sm:text-base dark:text-gray-400">Choose a tool to get started.</p>
    </div>
    <div className="mt-8 grid grid-cols-1 gap-5 lg:mt-10 lg:grid-cols-3 lg:gap-6">
      {CARDS.map((c) => <ToolCard key={c.key} card={c} />)}
    </div>
  </section>
);

export default ToolCards;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LuArrowRight, LuUploadCloud, LuX, LuChevronRight,
  LuFileText, LuImage, LuSheet, LuPresentation, LuType,
} from 'react-icons/lu';
import { SERVER_UPLOAD_MB, screenFiles, rejectionMessage } from '../../lib/fileValidation';
import { handOffFile } from '../../lib/fileHandoff';
import { stashPdf } from '../../lib/pdfHandoff';
import { formatBytes } from '../../lib/format';
import { preloadTool, preloadWhenIdle } from '../../lib/preloadTool';
import { warmPdfjs } from '../../lib/pdfjs';

/**
 * The homepage's three start cards. Each one is a real upload area (drop or
 * browse) that screens the file and hands it, name intact, to the tool that
 * does the work:
 *  - Image Resizer → /resize-image (fileHandoff → its FileDropzone)
 *  - PDF Converter → a PDF asks what to become in a popup (pdfHandoff); Office /
 *    text files go to their "… to PDF" converter (fileHandoff), as the File Converter hub does
 *  - PDF Editor    → /pdf-editor (pdfHandoff)
 * Phones also get Compress PDF, Merge PDF (several files) and Remove Pages.
 * Each tool's code is fetched ahead (idle / hover / touch), so it opens at once.
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

const CompressArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <path d="M38 12a6 6 0 016-6h22l14 14v52a6 6 0 01-6 6H44a6 6 0 01-6-6z" className="fill-white stroke-rose-400 dark:fill-gray-900" strokeWidth="2.5" />
    <path d="M66 6v10a4 4 0 004 4h10" className="fill-none stroke-rose-400" strokeWidth="2.5" />
    <rect x="42" y="36" width="34" height="16" rx="4" className="fill-rose-500" />
    <text x="59" y="48" textAnchor="middle" className="fill-white" fontSize="10" fontWeight="800" fontFamily="system-ui, sans-serif">PDF</text>
    <path d="M8 44h20m-7-7l7 7-7 7M112 44H92m7-7l-7 7 7 7" className="stroke-rose-500 dark:stroke-rose-400" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
  </svg>
);

const MergeArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <rect x="6" y="5" width="32" height="32" rx="5" className="fill-white stroke-orange-400 dark:fill-gray-900" strokeWidth="2.5" />
    <rect x="6" y="47" width="32" height="32" rx="5" className="fill-white stroke-orange-400 dark:fill-gray-900" strokeWidth="2.5" />
    <path d="M13 15h18M13 22h12M13 57h18M13 64h12" className="stroke-orange-300 dark:stroke-orange-400/50" strokeWidth="3" strokeLinecap="round" />
    <path d="M42 22c9 0 11 12 19 16m0 0l-8 1m8-1l-3-8M42 63c9 0 11-12 19-16m0 0l-8-1m8 1l-3 8" className="stroke-orange-500 dark:stroke-orange-400" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <path d="M68 15a6 6 0 016-6h20l14 14v46a6 6 0 01-6 6H74a6 6 0 01-6-6z" className="fill-white stroke-orange-500 dark:fill-gray-900 dark:stroke-orange-400" strokeWidth="2.5" />
    <rect x="72" y="37" width="32" height="16" rx="4" className="fill-rose-500" />
    <text x="88" y="49" textAnchor="middle" className="fill-white" fontSize="10" fontWeight="800" fontFamily="system-ui, sans-serif">PDF</text>
  </svg>
);

const RemoveArt = () => (
  <svg viewBox="0 0 120 84" className="h-20 w-28" aria-hidden>
    <rect x="34" y="4" width="48" height="64" rx="6" className="fill-sky-100 stroke-sky-300 dark:fill-sky-400/15 dark:stroke-sky-400/40" strokeWidth="2" />
    <rect x="22" y="12" width="52" height="68" rx="6" className="fill-white stroke-sky-500 dark:fill-gray-900 dark:stroke-sky-400" strokeWidth="2.5" />
    <path d="M31 28h34M31 39h34M31 50h20" className="stroke-sky-300 dark:stroke-sky-400/50" strokeWidth="3" strokeLinecap="round" />
    <circle cx="80" cy="60" r="17" className="fill-rose-500" />
    <path d="M73 53l14 14M87 53L73 67" className="stroke-white" strokeWidth="3.5" strokeLinecap="round" />
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
  },
  blue: {
    card: 'border-blue-400/70 dark:border-blue-400/45 hover:shadow-blue-500/15',
    glow: 'from-blue-400/10 dark:from-blue-400/[0.08]',
    zone: 'border-blue-300 bg-blue-50/60 dark:border-blue-400/35 dark:bg-blue-400/[0.04]',
    zoneOn: 'border-blue-500 bg-blue-100/70 dark:border-blue-300 dark:bg-blue-400/15',
    icon: 'text-blue-500 dark:text-blue-300',
    link: 'text-blue-600 dark:text-blue-300',
    btn: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500 shadow-blue-600/25',
  },
  violet: {
    card: 'border-violet-400/70 dark:border-violet-400/45 hover:shadow-violet-500/15',
    glow: 'from-violet-400/10 dark:from-violet-400/[0.08]',
    zone: 'border-violet-300 bg-violet-50/60 dark:border-violet-400/35 dark:bg-violet-400/[0.04]',
    zoneOn: 'border-violet-500 bg-violet-100/70 dark:border-violet-300 dark:bg-violet-400/15',
    icon: 'text-violet-500 dark:text-violet-300',
    link: 'text-violet-600 dark:text-violet-300',
    btn: 'bg-violet-600 hover:bg-violet-700 focus-visible:ring-violet-500 shadow-violet-600/25',
  },
  rose: {
    card: 'border-rose-400/70 dark:border-rose-400/45 hover:shadow-rose-500/15',
    glow: 'from-rose-400/10 dark:from-rose-400/[0.08]',
    zone: 'border-rose-300 bg-rose-50/60 dark:border-rose-400/35 dark:bg-rose-400/[0.04]',
    zoneOn: 'border-rose-500 bg-rose-100/70 dark:border-rose-300 dark:bg-rose-400/15',
    icon: 'text-rose-500 dark:text-rose-300',
    link: 'text-rose-600 dark:text-rose-300',
    btn: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500 shadow-rose-600/25',
  },
  orange: {
    card: 'border-orange-400/70 dark:border-orange-400/45 hover:shadow-orange-500/15',
    glow: 'from-orange-400/10 dark:from-orange-400/[0.08]',
    zone: 'border-orange-300 bg-orange-50/60 dark:border-orange-400/35 dark:bg-orange-400/[0.04]',
    zoneOn: 'border-orange-500 bg-orange-100/70 dark:border-orange-300 dark:bg-orange-400/15',
    icon: 'text-orange-500 dark:text-orange-300',
    link: 'text-orange-600 dark:text-orange-300',
    btn: 'bg-orange-600 hover:bg-orange-700 focus-visible:ring-orange-500 shadow-orange-600/25',
  },
  sky: {
    card: 'border-sky-400/70 dark:border-sky-400/45 hover:shadow-sky-500/15',
    glow: 'from-sky-400/10 dark:from-sky-400/[0.08]',
    zone: 'border-sky-300 bg-sky-50/60 dark:border-sky-400/35 dark:bg-sky-400/[0.04]',
    zoneOn: 'border-sky-500 bg-sky-100/70 dark:border-sky-300 dark:bg-sky-400/15',
    icon: 'text-sky-500 dark:text-sky-300',
    link: 'text-sky-600 dark:text-sky-300',
    btn: 'bg-sky-600 hover:bg-sky-700 focus-visible:ring-sky-500 shadow-sky-600/25',
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
  { id: 'pdf-to-word', label: 'PDF to Word', short: 'Word', note: 'Editable Word document (.docx)', Icon: LuFileText, tile: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300' },
  { id: 'pdf-to-jpg', label: 'PDF to JPG', short: 'JPG', note: 'Every page as an image', Icon: LuImage, tile: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300' },
  { id: 'pdf-to-excel', label: 'PDF to Excel', short: 'Excel', note: 'Tables into a spreadsheet (.xlsx)', Icon: LuSheet, tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { id: 'pdf-to-powerpoint', label: 'PDF to PowerPoint', short: 'PowerPoint', note: 'Pages as slides (.pptx)', Icon: LuPresentation, tile: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300' },
  { id: 'pdf-to-text', label: 'PDF to Text', short: 'Text', note: 'Plain text, reads scanned pages too', Icon: LuType, tile: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
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
    tools: ['resize-image'],
    to: 'resize-image',
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
    tools: ['pdf-to-word', 'word-to-pdf'],
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
    tools: ['pdf-editor'],
    to: 'pdf-editor',
    fits: isPdf,
    wrongType: 'Please choose a PDF file.',
  },
  // phones only (desktop has the full tools grid right below)
  {
    key: 'compress',
    mobileOnly: true,
    tone: 'rose',
    title: 'Compress PDF',
    text: 'Make a PDF file smaller, ready to send or upload.',
    formats: 'PDF',
    accept: '.pdf,application/pdf',
    cta: 'Compress PDF',
    Art: CompressArt,
    tools: ['pdf-compressor'],
    to: 'pdf-compressor',
    maxMB: SERVER_UPLOAD_MB.light,
    fits: isPdf,
    wrongType: 'Please choose a PDF file.',
  },
  {
    key: 'merge',
    mobileOnly: true,
    multiple: true,
    tone: 'orange',
    title: 'Merge PDF',
    text: 'Combine several PDFs and images into one PDF.',
    formats: 'PDF, JPG, PNG — pick two or more',
    accept: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
    cta: 'Choose Files',
    Art: MergeArt,
    tools: ['merge-pdf'],
    to: 'merge-pdf',
    fits: (f) => isPdf(f) || /\.(jpe?g|png)$/i.test(f.name || '') || ['image/jpeg', 'image/png'].includes(f.type),
    wrongType: 'isn’t a PDF, JPG or PNG.',
  },
  {
    key: 'remove',
    mobileOnly: true,
    tone: 'sky',
    title: 'Remove Pages',
    text: 'Delete the pages you don’t need and save a new copy.',
    formats: 'PDF, DOC, DOCX, ODT, RTF',
    accept: '.pdf,.doc,.docx,.odt,.rtf',
    cta: 'Choose File',
    Art: RemoveArt,
    tools: ['delete-pages'],
    to: 'delete-pages',
    fits: (f) => isPdf(f) || /\.(docx?|odt|rtf)$/i.test(f.name || ''),
    wrongType: 'Please choose a PDF or Word file.',
  },
];

/* ---------- "what do you want to do with this PDF?" popup ---------- */

const PdfChoice = ({ file, onPick, onClose }) => {
  const firstRef = useRef(null);

  useEffect(() => {
    warmPdfjs(); // every option opens the PDF with pdf.js — start it now
    preloadTool(...PDF_TARGETS.map((p) => p.id)); // whichever they pick opens at once
    firstRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // portalled: the card's hover lift (a transform) would otherwise trap a fixed overlay inside it
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-gray-900/50 px-3 pt-[max(env(safe-area-inset-top),4.5rem)] backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-choice-title"
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl sm:p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="pdf-choice-title" className="text-base font-bold text-gray-900 sm:text-lg dark:text-white">Convert this PDF to</h3>
            <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[12.5px] text-gray-500 dark:text-gray-400">
              <span className="shrink-0 rounded bg-rose-500 px-1 py-px text-[9px] font-bold leading-none text-white">PDF</span>
              <span className="truncate" title={file.name}>{file.name}</span>
              <span className="shrink-0">· {formatBytes(file.size)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        {/* phones: compact 2-column tiles (Word, the usual pick, full width);
            larger screens: a list with a line about each */}
        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:grid-cols-1">
          {PDF_TARGETS.map((p, i) => (
            <button
              key={p.id}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => onPick(p.id)}
              className={`group/opt flex w-full items-center gap-2.5 rounded-xl border border-gray-200 bg-white p-2.5 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:gap-3 sm:p-3 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/10 ${i === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg sm:h-10 sm:w-10 ${p.tile}`}><p.Icon className="h-5 w-5" strokeWidth={1.9} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold text-gray-900 sm:text-[14.5px] dark:text-white">
                  <span className="sm:hidden">{i === 0 ? p.label : p.short}</span>
                  <span className="hidden sm:inline">{p.label}</span>
                </span>
                <span className={`text-[12px] text-gray-500 sm:block sm:text-[12.5px] dark:text-gray-400 ${i === 0 ? 'block' : 'hidden'}`}>{p.note}</span>
              </span>
              <LuChevronRight className="hidden h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover/opt:translate-x-0.5 group-hover/opt:text-blue-500 sm:block" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 hidden w-full rounded-xl py-2.5 text-[13.5px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 sm:block dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
};

/* ---------- one card ---------- */

const ToolCard = ({ card }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [pdf, setPdf] = useState(null); // PDF Converter: a PDF waiting for its target
  const t = TONES[card.tone];

  const browse = () => inputRef.current?.click();
  const warm = () => {
    preloadTool(...card.tools);
    if (card.key !== 'image') warmPdfjs(); // the PDF cards will need pdf.js
  };

  const take = async (list) => {
    setError('');
    const picked = [...(list || [])];
    const [file] = picked;
    if (!file) return;

    if (card.multiple) {
      // Say which file is the problem rather than quietly merging without it
      const wrong = picked.find((f) => !card.fits(f));
      if (wrong) { setError(`"${wrong.name}" ${card.wrongType}`); return; }
      const { rejected } = screenFiles(picked, { maxMB: card.maxMB });
      if (rejected.length) { setError(rejectionMessage(rejected)); return; }
      handOffFile(picked);
      navigate(`/${card.to}`);
      return;
    }

    if (!card.fits(file)) { setError(card.wrongType); return; }
    const { accepted, rejected } = screenFiles([file], { maxMB: card.maxMB });
    if (!accepted.length) { setError(rejectionMessage(rejected)); return; }

    if (card.key === 'convert') {
      if (isPdf(file)) { setPdf(file); return; } // popup: what to convert it to
      const to = CONVERT_ROUTES.find((r) => r.re.test(file.name)).to;
      preloadTool(to);
      handOffFile(file);
      navigate(`/${to}`);
    } else if (isPdf(file)) {
      if (await stashPdf(file, file.name)) navigate(`/${card.to}`);
      else setError('Could not read that PDF. Please try again.');
    } else {
      handOffFile(file);
      navigate(`/${card.to}`);
    }
  };

  const convertPdf = async (toolId) => {
    const file = pdf;
    setPdf(null);
    if (await stashPdf(file, file.name)) navigate(`/${toolId}`);
    else setError('Could not read that PDF. Please try again.');
  };

  const closeChoice = useCallback(() => setPdf(null), []);

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
      onDragEnter={warm}
      onPointerEnter={warm}
      onTouchStart={warm}
      onFocus={warm}
      className={`group relative flex-col overflow-hidden rounded-3xl border-2 bg-white p-4 shadow-sm ${card.mobileOnly ? 'flex md:hidden' : 'flex'} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-6 dark:bg-gray-800/60 ${t.card}`}
    >
      {/* soft colour wash at the top of the card */}
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b to-transparent ${t.glow}`} />

      <div className="relative flex items-center gap-4">
        <span className="shrink-0 [&>svg]:h-14 [&>svg]:w-20 sm:[&>svg]:h-20 sm:[&>svg]:w-28"><card.Art /></span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold sm:text-xl text-gray-900 dark:text-white">{card.title}</h3>
          <p className="mt-1 text-[13.5px] leading-snug text-gray-600 dark:text-gray-300">{card.text}</p>
          {/* phones can't drag & drop, so they skip the drop area: formats go here */}
          <p className="mt-1 text-[11.5px] text-gray-500 sm:hidden dark:text-gray-400">{card.formats}</p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={card.accept}
        multiple={!!card.multiple}
        className="hidden"
        onChange={(e) => { take(e.target.files); e.target.value = ''; }}
      />

      <div
        role="presentation"
        onClick={browse}
        className={`relative mt-5 hidden flex-1 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors sm:flex ${dragging ? t.zoneOn : t.zone}`}
      >
        <LuUploadCloud className={`h-9 w-9 ${t.icon}`} strokeWidth={1.7} />
        <p className="mt-2 text-[15px] font-semibold text-gray-800 dark:text-gray-100">
          {dragging ? 'Drop to open' : <>Drop file here or <span className={`underline-offset-2 group-hover:underline ${t.link}`}>browse</span></>}
        </p>
        <p className="mt-1.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400">
          Supported formats: {card.formats}
        </p>
      </div>

      {error && (
        <p role="alert" className="relative mt-3 text-[13px] font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}

      <button
        type="button"
        onClick={browse}
        className={`relative mt-4 inline-flex w-full items-center sm:mt-5 justify-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold text-white shadow-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900 ${t.btn}`}
      >
        {card.cta} <LuArrowRight className="h-4 w-4" />
      </button>

      {pdf && <PdfChoice file={pdf} onPick={convertPdf} onClose={closeChoice} />}
    </article>
  );
};

const ToolCards = () => {
  // the most used tool: have it ready before anyone even touches a card
  useEffect(() => preloadWhenIdle('resize-image'), []);

  return (
    <section aria-labelledby="start-heading">
      <div className="text-center">
        <h2 id="start-heading" className="text-[28px] font-extrabold leading-tight tracking-tight text-gray-900 sm:text-4xl lg:text-5xl dark:text-white">
          What would you{' '}
          <span className="bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500 bg-clip-text text-transparent dark:from-violet-400 dark:via-indigo-400 dark:to-blue-400">like to do?</span>
        </h2>
        <p className="mt-3 text-[15px] text-gray-600 sm:text-base dark:text-gray-400">Choose a tool to get started.</p>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-5 lg:mt-10 lg:grid-cols-3 lg:gap-6">
        {CARDS.map((c) => <ToolCard key={c.key} card={c} />)}
      </div>
    </section>
  );
};

export default ToolCards;

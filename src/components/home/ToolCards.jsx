import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  LuArrowRight, LuUploadCloud, LuX, LuChevronRight,
  LuFileText, LuImage, LuSheet, LuPresentation, LuType,
} from 'react-icons/lu';
import { screenFiles, rejectionMessage } from '../../lib/fileValidation';
import { handOffFile } from '../../lib/fileHandoff';
import { stashPdf } from '../../lib/pdfHandoff';
import { formatBytes } from '../../lib/format';
import { preloadTool, preloadWhenIdle } from '../../lib/preloadTool';

/**
 * The homepage's three start cards. Each one is a real upload area (drop or
 * browse) that screens the file and hands it, name intact, to the tool that
 * does the work:
 *  - Image Resizer → /resize-image (fileHandoff → its FileDropzone)
 *  - PDF Converter → a PDF asks what to become in a popup (pdfHandoff); Office /
 *    text files go to their "… to PDF" converter (fileHandoff), as the File Converter hub does
 *  - PDF Editor    → /pdf-editor (pdfHandoff)
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
  { id: 'pdf-to-word', label: 'PDF to Word', note: 'Editable Word document (.docx)', Icon: LuFileText, tile: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300' },
  { id: 'pdf-to-jpg', label: 'PDF to JPG', note: 'Every page as an image', Icon: LuImage, tile: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300' },
  { id: 'pdf-to-excel', label: 'PDF to Excel', note: 'Tables into a spreadsheet (.xlsx)', Icon: LuSheet, tile: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { id: 'pdf-to-powerpoint', label: 'PDF to PowerPoint', note: 'Pages as slides (.pptx)', Icon: LuPresentation, tile: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300' },
  { id: 'pdf-to-text', label: 'PDF to Text', note: 'Plain text, reads scanned pages too', Icon: LuType, tile: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-300' },
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
    fits: isPdf,
    wrongType: 'Please choose a PDF file.',
  },
];

/* ---------- "what do you want to do with this PDF?" popup ---------- */

const PdfChoice = ({ file, onPick, onClose }) => {
  const firstRef = useRef(null);

  useEffect(() => {
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
      className="fixed inset-0 z-[100] flex items-end justify-center bg-gray-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdf-choice-title"
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-gray-200 bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-6 dark:border-gray-700 dark:bg-gray-800"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="pdf-choice-title" className="text-lg font-bold text-gray-900 dark:text-white">What do you want to do with this PDF?</h3>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400">
              <span className="shrink-0 rounded bg-rose-500 px-1 py-px text-[9px] font-bold leading-none text-white">PDF</span>
              <span className="truncate" title={file.name}>{file.name}</span>
              <span className="shrink-0">· {formatBytes(file.size)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          >
            <LuX className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {PDF_TARGETS.map((p, i) => (
            <button
              key={p.id}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              onClick={() => onPick(p.id)}
              className="group/opt flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-gray-700 dark:bg-gray-900/40 dark:hover:border-blue-400/60 dark:hover:bg-blue-500/10"
            >
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${p.tile}`}><p.Icon className="h-5 w-5" strokeWidth={1.9} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-gray-900 dark:text-white">{p.label}</span>
                <span className="block text-[12.5px] text-gray-500 dark:text-gray-400">{p.note}</span>
              </span>
              <LuChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover/opt:translate-x-0.5 group-hover/opt:text-blue-500" />
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-xl py-2.5 text-[13.5px] font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200"
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
  const warm = () => preloadTool(...card.tools);

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
      setPdf(file); // popup: what to convert it to
    } else {
      const to = CONVERT_ROUTES.find((r) => r.re.test(file.name)).to;
      preloadTool(to);
      handOffFile(file);
      navigate(`/${to}`);
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
      className={`group relative flex flex-col overflow-hidden rounded-3xl border-2 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl sm:p-6 dark:bg-gray-800/60 ${t.card}`}
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

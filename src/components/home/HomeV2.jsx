import React from 'react';
import { Link } from 'react-router-dom';
import {
  LuBadgeCheck, LuShieldCheck, LuUserX, LuSparkles, LuArrowRight,
  LuFileArchive, LuCombine, LuFileType, LuScaling, LuCrop, LuFileImage,
  LuFileText, LuImage, LuRepeat, LuLock, LuZap, LuMonitorSmartphone, LuHeart,
} from 'react-icons/lu';
import ToolsGrid from '../ToolsGrid';
import UploadZone from './UploadZone';
import HowItWorks from './HowItWorks';
import HomeDesignToggle from './HomeDesignToggle';
import { getHomeSections } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

/* colour → [icon tile classes, soft card bg, arrow colour] */
// per colour: [solid icon tile, tinted icon square, soft card bg, arrow colour]
const TINT = {
  rose: ['bg-rose-500 text-white shadow-sm shadow-rose-500/30', 'bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300', 'bg-rose-50 dark:bg-rose-500/10', 'text-rose-400'],
  emerald: ['bg-emerald-500 text-white shadow-sm shadow-emerald-500/30', 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300', 'bg-emerald-50 dark:bg-emerald-500/10', 'text-emerald-400'],
  sky: ['bg-sky-500 text-white shadow-sm shadow-sky-500/30', 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300', 'bg-sky-50 dark:bg-sky-500/10', 'text-sky-400'],
  blue: ['bg-blue-600 text-white shadow-sm shadow-blue-600/30', 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300', 'bg-blue-50 dark:bg-blue-500/10', 'text-blue-400'],
  violet: ['bg-violet-600 text-white shadow-sm shadow-violet-600/30', 'bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300', 'bg-violet-50 dark:bg-violet-500/10', 'text-violet-400'],
  indigo: ['bg-indigo-600 text-white shadow-sm shadow-indigo-600/30', 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300', 'bg-indigo-50 dark:bg-indigo-500/10', 'text-indigo-400'],
  amber: ['bg-amber-500 text-white shadow-sm shadow-amber-500/30', 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300', 'bg-amber-50 dark:bg-amber-500/10', 'text-amber-400'],
  teal: ['bg-teal-500 text-white shadow-sm shadow-teal-500/30', 'bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300', 'bg-teal-50 dark:bg-teal-500/10', 'text-teal-400'],
  pink: ['bg-pink-500 text-white shadow-sm shadow-pink-500/30', 'bg-pink-100 text-pink-500 dark:bg-pink-500/20 dark:text-pink-300', 'bg-pink-50 dark:bg-pink-500/10', 'text-pink-400'],
};

const BADGES = [
  { Icon: LuBadgeCheck, color: 'emerald', label: '100% Free' },
  { Icon: LuShieldCheck, color: 'indigo', label: 'Fast & Secure' },
  { Icon: LuUserX, color: 'violet', label: 'No Sign up' },
];

const POPULAR = [
  { id: 'pdf-compressor', label: 'Compress PDF', color: 'rose', Icon: LuFileArchive },
  { id: 'merge-pdf', label: 'Merge PDF', color: 'indigo', Icon: LuCombine },
  { id: 'pdf-to-word', label: 'PDF to Word', color: 'blue', Icon: LuFileType },
  { id: 'resize-image', label: 'Resize Image', color: 'emerald', Icon: LuScaling },
  { id: 'crop-image', label: 'Crop Image', color: 'amber', Icon: LuCrop },
  { id: 'convert-image', label: 'JPG to PNG', color: 'teal', Icon: LuFileImage },
];

const CATS = [
  { label: 'PDF Tools', to: '/pdf', count: '25+ tools', color: 'rose', Icon: LuFileText },
  { label: 'Image Tools', to: '/image', count: '15+ tools', color: 'emerald', Icon: LuImage },
  { label: 'Convert Tools', to: '/convert', count: '20+ formats', color: 'sky', Icon: LuRepeat },
  { label: 'AI Tools', to: '/ai', count: '10+ tools', badge: 'New', color: 'violet', Icon: LuSparkles },
  { label: 'Security Tools', to: '/pdf', count: '8+ tools', color: 'amber', Icon: LuLock },
  { label: 'Quick Tools', to: '#tools', count: '12+ tools', color: 'blue', Icon: LuZap },
];

const TRUST = [
  { title: 'Your Files Are Safe', lines: ['We never store your files.', '100% secure & private.'], color: 'indigo', Icon: LuShieldCheck },
  { title: 'Super Fast', lines: ['Our tools work instantly', 'in your browser.'], color: 'indigo', Icon: LuZap },
  { title: 'Works Everywhere', lines: ['Use FileQuick on any device', '— anytime, anywhere.'], color: 'indigo', Icon: LuMonitorSmartphone },
  { title: 'Made with ❤️', lines: ['Built to make your file', 'work effortless.'], color: 'pink', Icon: LuHeart },
];

/* floating office-file marks around the upload card */
const FileMark = ({ label, className, bg, fold }) => (
  <div className={`pointer-events-none absolute hidden lg:block ${className}`}>
    <div className={`relative h-12 w-11 rounded-lg ${bg} shadow-lg shadow-black/10 ring-1 ring-black/5`}>
      <span className={`absolute right-0 top-0 h-3 w-3 rounded-bl-md ${fold}`} />
      <span className="absolute inset-x-0 bottom-1.5 text-center text-[9px] font-extrabold tracking-tight text-white">{label}</span>
    </div>
  </div>
);

const HomeV2 = () => {
  usePageMeta(null);
  const sections = getHomeSections('all');

  return (
    <div className="relative space-y-14 pb-6">
      <div className="pointer-events-none absolute left-1/2 top-[-2rem] -z-10 h-[560px] w-screen -translate-x-1/2 bg-gradient-to-b from-indigo-50 via-violet-50/50 to-transparent dark:from-indigo-500/[0.06] dark:via-transparent" />

      {/* ---------- hero ---------- */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[13px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <LuSparkles className="h-3.5 w-3.5" /> All-in-One File Toolkit
          </span>
          <h1 className="mt-5 text-[42px] font-extrabold leading-[1.03] tracking-tight text-gray-900 sm:text-6xl dark:text-white">
            One place.<br />
            Every <span className="text-indigo-600 dark:text-indigo-400">file tool.</span>
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
            Resize images, edit PDFs, convert documents and do more — without jumping between different websites.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5">
            {BADGES.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                <span className={`grid h-6 w-6 place-items-center rounded-full ${TINT[b.color][1]}`}><b.Icon className="h-3.5 w-3.5" strokeWidth={2} /></span>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute -left-6 top-10 -z-10 h-56 w-56 rounded-full bg-indigo-200/40 blur-2xl dark:bg-indigo-500/10" />
          <FileMark label="PDF" className="-right-4 -top-5" bg="bg-red-500" fold="bg-red-300" />
          <FileMark label="W" className="-right-8 top-24" bg="bg-blue-600" fold="bg-blue-400" />
          <FileMark label="X" className="-right-3 bottom-6" bg="bg-emerald-600" fold="bg-emerald-400" />
          <FileMark label="JPG" className="-left-6 bottom-2" bg="bg-violet-500" fold="bg-violet-300" />
          <span className="pointer-events-none absolute -right-10 top-1/2 hidden h-3 w-3 rounded-full border-2 border-teal-400 lg:block" />
          <span className="pointer-events-none absolute right-2 -bottom-4 hidden h-2 w-2 rounded-full bg-indigo-400 lg:block" />

          <div className="rounded-3xl border border-indigo-100 bg-indigo-50/60 p-2.5 shadow-xl shadow-indigo-500/5 dark:border-gray-700 dark:bg-gray-800/50">
            <UploadZone v2 />
          </div>
          <p className="mt-3 text-center text-[13px] text-gray-500 dark:text-gray-400">
            <LuSparkles className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
            We&apos;ll detect your file and show you <span className="font-medium text-indigo-600 dark:text-indigo-400">smart actions</span>
          </p>
        </div>
      </section>

      {/* ---------- popular ---------- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <span aria-hidden>🔥</span> Popular Tools
          </h2>
          <a href="#tools" className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-[13px] font-medium text-gray-600 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-300">
            View all <LuArrowRight className="h-3.5 w-3.5" />
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {POPULAR.map((t) => (
            <Link
              key={t.id}
              to={`/${t.id}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-[13px] font-semibold text-gray-800 transition-colors hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-700"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TINT[t.color][0]}`}><t.Icon className="h-[18px] w-[18px]" strokeWidth={1.9} /></span>
              <span className="truncate">{t.label}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- categories ---------- */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Explore Tools by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CATS.map((c) => {
            const [, tile, soft, arrow] = TINT[c.color];
            const body = (
              <>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${tile}`}><c.Icon className="h-5 w-5" strokeWidth={1.9} /></span>
                <span className="mt-3 flex items-center gap-1.5 text-[14px] font-bold text-gray-900 dark:text-white">
                  {c.label}
                  {c.badge && <span className="rounded bg-violet-600 px-1 py-px text-[9px] font-bold uppercase leading-none text-white">{c.badge}</span>}
                </span>
                <span className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{c.count}</span>
                <LuArrowRight className={`mt-3 h-4 w-4 ${arrow}`} />
              </>
            );
            const cls = `flex flex-col rounded-2xl border border-transparent p-4 transition-all hover:-translate-y-0.5 hover:border-gray-200 hover:shadow-sm dark:hover:border-gray-700 ${soft}`;
            return c.to.startsWith('#')
              ? <a key={c.label} href={c.to} className={cls}>{body}</a>
              : <Link key={c.label} to={c.to} className={cls}>{body}</Link>;
          })}
        </div>
      </section>

      {/* ---------- trust bar ---------- */}
      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:lg:divide-gray-700">
        {TRUST.map((it) => (
          <div key={it.title} className="flex items-start gap-3 lg:px-5 lg:first:pl-0">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${TINT[it.color][1]}`}><it.Icon className="h-5 w-5" strokeWidth={1.9} /></span>
            <div>
              <p className="text-[13.5px] font-bold text-gray-900 dark:text-white">{it.title}</p>
              <p className="mt-0.5 text-[12px] leading-snug text-gray-500 dark:text-gray-400">{it.lines[0]}<br />{it.lines[1]}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ---------- every tool, grouped (scroll target) ---------- */}
      <div id="tools" className="scroll-mt-24 space-y-14 pt-2">
        {sections.map((s) => (
          <ToolsGrid key={s.id} id={s.id} title={s.title} tools={s.tools} />
        ))}
      </div>

      <HowItWorks />
      <HomeDesignToggle />
    </div>
  );
};

export default HomeV2;

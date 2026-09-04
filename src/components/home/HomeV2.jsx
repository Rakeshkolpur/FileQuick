import React from 'react';
import { Link } from 'react-router-dom';
import ToolsGrid from '../ToolsGrid';
import UploadZone from './UploadZone';
import HowItWorks from './HowItWorks';
import HomeDesignToggle from './HomeDesignToggle';
import { getHomeSections } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

/* ---------- shared bits ---------- */

const P = ({ d }) => <path strokeLinecap="round" strokeLinejoin="round" d={d} />;
const Ico = ({ d, className = 'h-5 w-5', sw = 1.9 }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw}>{Array.isArray(d) ? d.map((x, i) => <P key={i} d={x} />) : <P d={d} />}</svg>
);

// tinted icon-tile classes  →  [tileBg+text, softCardBg, arrow text]
const TINT = {
  rose: ['bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300', 'bg-rose-50 dark:bg-rose-500/10', 'text-rose-400'],
  emerald: ['bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300', 'bg-emerald-50 dark:bg-emerald-500/10', 'text-emerald-400'],
  sky: ['bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300', 'bg-sky-50 dark:bg-sky-500/10', 'text-sky-400'],
  blue: ['bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300', 'bg-blue-50 dark:bg-blue-500/10', 'text-blue-400'],
  violet: ['bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-300', 'bg-violet-50 dark:bg-violet-500/10', 'text-violet-400'],
  indigo: ['bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300', 'bg-indigo-50 dark:bg-indigo-500/10', 'text-indigo-400'],
  amber: ['bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300', 'bg-amber-50 dark:bg-amber-500/10', 'text-amber-400'],
  teal: ['bg-teal-100 text-teal-600 dark:bg-teal-500/20 dark:text-teal-300', 'bg-teal-50 dark:bg-teal-500/10', 'text-teal-400'],
  pink: ['bg-pink-100 text-pink-500 dark:bg-pink-500/20 dark:text-pink-300', 'bg-pink-50 dark:bg-pink-500/10', 'text-pink-400'],
};

const CLOUD = 'M7 18a4 4 0 01-.9-7.9 5 5 0 019.7-1.6A4.5 4.5 0 0117 18H7z';
const BOLT = 'M13 3v7h6l-8 11v-7H5l8-11z';
const SHIELD = 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z';
const HEART = 'M12 20C8.5 16.7 4.5 13.8 4.5 9.6 4.5 7 6.5 5 9 5c1.7 0 3.1.9 3 2 0-1.1 1.3-2 3-2 2.5 0 4.5 2 4.5 4.6 0 4.2-4 7.1-7.5 10.4z';
const PHONE = 'M9 17H6a2 2 0 01-2-2V6a2 2 0 012-2h11a2 2 0 012 2v3M14 12h5a1 1 0 011 1v6a1 1 0 01-1 1h-5a1 1 0 01-1-1v-6a1 1 0 011-1z';

const BADGES = [
  { color: 'emerald', label: '100% Free', d: 'M9 12.5l2 2 4-4M12 3a9 9 0 100 18 9 9 0 000-18z' },
  { color: 'indigo', label: 'Fast & Secure', d: SHIELD },
  { color: 'violet', label: 'No Sign up', d: 'M15.5 8.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.5 20a7.5 7.5 0 0115 0' },
];

const POPULAR = [
  { id: 'pdf-compressor', label: 'Compress PDF', color: 'rose', d: 'M12 4v9m0 0l-3-3m3 3l3-3M6 20h12' },
  { id: 'merge-pdf', label: 'Merge PDF', color: 'indigo', d: ['M4 5h16v14H4z', 'M9 9h6M9 12h6M9 15h4'] },
  { id: 'pdf-to-word', label: 'PDF to Word', color: 'blue', d: ['M5 4h14v16H5z', 'M8 9l1.5 6L11 10l1.5 5L14 9'] },
  { id: 'resize-image', label: 'Resize Image', color: 'emerald', d: 'M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6' },
  { id: 'crop-image', label: 'Crop Image', color: 'amber', d: ['M6 2v14a2 2 0 002 2h14', 'M18 22V8a2 2 0 00-2-2H2'] },
  { id: 'convert-image', label: 'JPG to PNG', color: 'teal', d: ['M4 5h16v14H4z', 'M4 15l4-4 3 3 4-5 5 6'] },
];

const CATS = [
  { label: 'PDF Tools', to: '/pdf', count: '25+ tools', color: 'rose', d: ['M8 3h6l4 4v13H7V4a1 1 0 011-1z', 'M14 3v4h4', 'M10 13h4M10 16h4'] },
  { label: 'Image Tools', to: '/image', count: '15+ tools', color: 'emerald', d: ['M4 5h16v14H4z', 'M4 15l4-4 3 3 4-5 5 6', 'M8.5 9.5a1 1 0 100-2 1 1 0 000 2z'] },
  { label: 'Convert Tools', to: '/convert', count: '20+ formats', color: 'sky', d: ['M4 8h11l-3-3', 'M20 16H9l3 3'] },
  { label: 'AI Tools', to: '/ai', count: '10+ tools', badge: 'New', color: 'violet', d: ['M5 3l1.4 3.6L10 8 6.4 9.4 5 13 3.6 9.4 0 8l3.6-1.4z', 'M17 4l1 2.4L20.4 8 18 9l-1 2.4L16 9l-2.4-1L16 6.4z'] },
  { label: 'Security Tools', to: '/pdf', count: '8+ tools', color: 'amber', d: ['M6 10V8a6 6 0 1112 0v2', 'M5 10h14v10H5z', 'M12 14v3'] },
  { label: 'Quick Tools', to: '#tools', count: '12+ tools', color: 'blue', d: BOLT },
];

const TRUST = [
  { title: 'Your Files Are Safe', lines: ['We never store your files.', '100% secure & private.'], color: 'indigo', d: SHIELD },
  { title: 'Super Fast', lines: ['Our tools work instantly', 'in your browser.'], color: 'indigo', d: BOLT },
  { title: 'Works Everywhere', lines: ['Use FileQuick on any device', '— anytime, anywhere.'], color: 'indigo', d: PHONE },
  { title: 'Made with ❤️', lines: ['Built to make your file', 'work effortless.'], color: 'pink', d: HEART },
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

/* ---------- page ---------- */

const HomeV2 = () => {
  usePageMeta(null);
  const sections = getHomeSections('all');
  const popular = POPULAR;

  return (
    <div className="relative space-y-14 pb-6">
      {/* soft page wash behind the hero */}
      <div className="pointer-events-none absolute left-1/2 top-[-2rem] -z-10 h-[560px] w-screen -translate-x-1/2 bg-gradient-to-b from-indigo-50 via-violet-50/50 to-transparent dark:from-indigo-500/[0.06] dark:via-transparent" />

      {/* ---------- hero ---------- */}
      <section className="grid items-center gap-10 pt-4 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-[13px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
            <span aria-hidden>✨</span> All-in-One File Toolkit
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
                <span className={`grid h-6 w-6 place-items-center rounded-full ${TINT[b.color][0]}`}><Ico d={b.d} className="h-3.5 w-3.5" sw={2.2} /></span>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div className="relative">
          {/* backdrop blob + floating file marks */}
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
            <span aria-hidden>✨</span> We&apos;ll detect your file and show you <span className="font-medium text-indigo-600 dark:text-indigo-400">smart actions</span>
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
            View all <span aria-hidden>→</span>
          </a>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {popular.map((t) => (
            <Link
              key={t.id}
              to={`/${t.id}`}
              className="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-[13px] font-semibold text-gray-800 transition-colors hover:border-indigo-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-indigo-700"
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${TINT[t.color][0]}`}><Ico d={t.d} className="h-4 w-4" /></span>
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
            const [tile, soft, arrow] = TINT[c.color];
            const body = (
              <>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${tile}`}><Ico d={c.d} /></span>
                <span className="mt-3 flex items-center gap-1.5 text-[14px] font-bold text-gray-900 dark:text-white">
                  {c.label}
                  {c.badge && <span className="rounded bg-violet-600 px-1 py-px text-[9px] font-bold uppercase leading-none text-white">{c.badge}</span>}
                </span>
                <span className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{c.count}</span>
                <Ico d="M13 7l5 5-5 5M18 12H6" className={`mt-3 h-4 w-4 ${arrow}`} />
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
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${TINT[it.color][0]}`}><Ico d={it.d} className="h-5 w-5" sw={1.7} /></span>
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

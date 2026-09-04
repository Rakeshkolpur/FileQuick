import React from 'react';
import { Link } from 'react-router-dom';
import ToolsGrid from '../ToolsGrid';
import UploadZone from './UploadZone';
import HowItWorks from './HowItWorks';
import HomeDesignToggle from './HomeDesignToggle';
import { getHomeSections, getToolsByCategory, getPopularTools } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

const Icon = ({ d, className = 'h-5 w-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const BADGES = [
  { d: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: '100% Free' },
  { d: 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z', label: 'Fast & Secure' },
  { d: 'M15.5 8.5a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0zM4.5 20a7.5 7.5 0 0115 0', label: 'No Sign up' },
];

const CARD_TINTS = {
  red: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300',
  green: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
  blue: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300',
  purple: 'bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300',
};

const TRUST = [
  { d: 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4z', title: 'Your files are safe', text: 'We never store your files. 100% private.' },
  { d: 'M13 3v7h6l-8 11v-7H5l8-11z', title: 'Super fast', text: 'Tools run instantly, right in your browser.' },
  { d: 'M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h12a2 2 0 012 2v3M15 12h5a1 1 0 011 1v6a1 1 0 01-1 1h-5a1 1 0 01-1-1v-6a1 1 0 011-1z', title: 'Works everywhere', text: 'Any device — desktop, tablet or phone.' },
  { d: 'M12 21C8 17 4 14 4 9.5A4.5 4.5 0 0112 7a4.5 4.5 0 018 2.5C20 14 16 17 12 21z', title: 'Made with care', text: 'Built to make file work effortless.' },
];

const HomeV2 = () => {
  usePageMeta(null);
  const sections = getHomeSections('all');
  const popular = getPopularTools().slice(0, 8);
  const cards = [
    { label: 'PDF Tools', to: '/pdf', tint: 'red', unit: 'tools', d: 'M8 3h6l4 4v13a1 1 0 01-1 1H8a1 1 0 01-1-1V4a1 1 0 011-1zM14 3v4h4', count: getToolsByCategory('pdf').length },
    { label: 'Image Tools', to: '/image', tint: 'green', unit: 'tools', d: 'M4 5h16v14H4zM4 15l4-4 3 3 4-5 5 6', count: getToolsByCategory('image').length },
    { label: 'Convert Tools', to: '/convert', tint: 'blue', unit: 'formats', d: 'M4 7h11l-3-3M20 17H9l3 3', count: getToolsByCategory('convert').length },
    { label: 'AI Tools', to: '/ai', tint: 'purple', unit: 'tools', badge: 'New', d: 'M5 3l1.4 3.6L10 8 6.4 9.4 5 13 3.6 9.4 0 8l3.6-1.4zM17 4l1 2.5L20.5 8 18 9l-1 2.5L16 9l-2.5-1L16 6.5z', count: getToolsByCategory('ai').length },
    { label: 'Security Tools', to: '/pdf', tint: 'amber', unit: 'tools', d: 'M12 3l7 4v5c0 5-3.5 8-7 9-3.5-1-7-4-7-9V7l7-4zM9 12l2 2 4-4', count: 2 },
    { label: 'Popular Tools', to: '#tools', tint: 'slate', unit: 'tools', d: 'M12 3l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 18l-5.9 3 1.2-6.5L2.5 9.9 9.1 9z', count: getPopularTools().length },
  ];

  return (
    <div className="space-y-16 pb-6">
      {/* ---------- hero ---------- */}
      <section className="relative grid gap-10 pt-2 lg:grid-cols-2 lg:items-center">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[120%] -translate-x-1/2 bg-gradient-to-r from-purple-500/15 via-pink-500/15 to-indigo-500/15 blur-3xl -z-10" />
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-semibold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
            <span aria-hidden>✨</span> All-in-One File Toolkit
          </span>
          <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight text-gray-900 sm:text-5xl dark:text-white">
            One place.<br />
            Every <span className="text-purple-600 dark:text-purple-400">file tool.</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] text-gray-600 dark:text-gray-300">
            Resize images, edit PDFs, convert documents and do more — without jumping between different websites.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {BADGES.map((b) => (
              <span key={b.label} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gray-600 dark:text-gray-300">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <Icon d={b.d} className="h-3 w-3" />
                </span>
                {b.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-gray-200 bg-white/70 p-1.5 shadow-xl shadow-purple-500/5 backdrop-blur dark:border-gray-700 dark:bg-gray-800/60">
            <UploadZone />
          </div>
          <p className="mt-3 text-center text-[13px] text-gray-500 dark:text-gray-400">
            <span aria-hidden>✨</span> We&apos;ll detect your file and show you smart actions
          </p>
        </div>
      </section>

      {/* ---------- popular ---------- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900 dark:text-white">
            <span aria-hidden>🔥</span> Popular Tools
          </h2>
          <a href="#tools" className="text-sm font-medium text-purple-600 hover:underline dark:text-purple-400">View all →</a>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {popular.map((t) => (
            <Link
              key={t.id}
              to={`/${t.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-semibold text-gray-800 transition-colors hover:border-purple-300 hover:text-purple-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:border-purple-700 dark:hover:text-purple-300"
            >
              <span className="grid h-6 w-6 place-items-center rounded-md bg-purple-100 p-1 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300">{t.icon}</span>
              {t.title}
            </Link>
          ))}
        </div>
      </section>

      {/* ---------- categories ---------- */}
      <section>
        <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Explore Tools by Category</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => {
            const inner = (
              <>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${CARD_TINTS[c.tint]}`}>
                  <Icon d={c.d} />
                </span>
                <span className="mt-3 flex items-center gap-1.5 text-[13px] font-bold text-gray-900 dark:text-white">
                  {c.label}
                  {c.badge && <span className="rounded bg-purple-600 px-1 py-px text-[9px] font-bold uppercase text-white">{c.badge}</span>}
                </span>
                <span className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{c.count} {c.unit}</span>
                <Icon d="M9 5l7 7-7 7" className="mt-3 h-4 w-4 text-gray-400" />
              </>
            );
            return c.to.startsWith('#') ? (
              <a key={c.label} href={c.to} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-700">{inner}</a>
            ) : (
              <Link key={c.label} to={c.to} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-purple-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-purple-700">{inner}</Link>
            );
          })}
        </div>
      </section>

      {/* ---------- trust ---------- */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST.map((it) => (
            <div key={it.title} className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-300">
                <Icon d={it.d} />
              </span>
              <div>
                <p className="text-[13px] font-bold text-gray-900 dark:text-white">{it.title}</p>
                <p className="mt-0.5 text-[12px] text-gray-500 dark:text-gray-400">{it.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- every tool, grouped (scroll target) ---------- */}
      <div id="tools" className="scroll-mt-24 space-y-14">
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

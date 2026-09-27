import React, { useEffect } from 'react';
import {
  LuFileScan, LuEraser, LuType, LuCheck, LuArrowRight,
} from 'react-icons/lu';

const Step = ({
  n, icon: Icon, title, text, tint,
}) => (
  <div className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/50">
    <span className={`relative grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tint}`}>
      {Icon && <Icon className="h-5 w-5" />}
      <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-900 text-[10px] font-bold text-white ring-2 ring-white dark:bg-white dark:text-gray-900 dark:ring-gray-800">{n}</span>
    </span>
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</span>
      <span className="block text-[13px] leading-snug text-gray-500 dark:text-gray-400">{text}</span>
    </span>
  </div>
);

/**
 * Shown once when the uploaded PDF is a scan (pages are pictures, there is
 * no real text to edit): explains the cover-and-retype way of editing it.
 */
const ScanNotice = ({ pages, onClose }) => {
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape' || e.key === 'Enter') onClose(); };
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <div data-fq-keep="" className="fixed inset-0 z-[100] grid place-items-center bg-gray-900/40 p-4 backdrop-blur-sm animate-[fqfade_.18s_ease-out]" onMouseDown={onClose}>
      <style>{'@keyframes fqfade{from{opacity:0}to{opacity:1}}@keyframes fqrise{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}'}</style>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="fq-scan-title"
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 animate-[fqrise_.25s_cubic-bezier(.2,.9,.3,1.2)] dark:bg-gray-800"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-600 px-6 pb-6 pt-7 text-white">
          <div className="absolute -right-6 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 right-16 h-24 w-24 rounded-full bg-white/10" />
          <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/30 backdrop-blur">
            <LuFileScan className="h-6 w-6" />
          </span>
          <h2 id="fq-scan-title" className="relative mt-4 text-xl font-bold">This is a scanned PDF</h2>
          <p className="relative mt-1 text-sm text-white/85">
            {pages > 1 ? `Its ${pages} pages are pictures` : 'This page is a picture'} of text, so the words can&rsquo;t be clicked and changed directly.
            You can still edit it — cover the old text and type on top:
          </p>
        </div>

        <div className="space-y-2.5 p-5">
          <Step n={1} icon={LuEraser} tint="bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" title="Whiteout the old text" text="Drag a box over the words you want to change. Pick a fill colour that matches the paper." />
          <Step n={2} icon={LuType} tint="bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" title="Type the new text" text="Choose Text and click on the white box. Match the font and size from the bar above it." />
          <Step n={3} icon={LuCheck} tint="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" title="Apply changes" text="Download your edited PDF — nothing is uploaded anywhere." />
        </div>

        <div className="px-5 pb-5">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:brightness-110"
          >
            Got it — show me
            <LuArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScanNotice;

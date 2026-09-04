import React from 'react';
import { Link } from 'react-router-dom';
import { LuShieldCheck, LuZap, LuGift, LuMonitorSmartphone } from 'react-icons/lu';
import { usePageMeta } from '../lib/seo';
import { getAllTools } from '../data/tools';

const POINTS = [
  {
    Icon: LuShieldCheck,
    title: 'Private by design',
    text: 'Almost every tool runs entirely in your browser. Your images and PDFs are never uploaded, stored or seen by anyone.',
  },
  {
    Icon: LuGift,
    title: 'Free, with no catch',
    text: 'No account, no watermarks, no per-file charges and no daily limits. Every tool is free to use as often as you like.',
  },
  {
    Icon: LuZap,
    title: 'Fast',
    text: 'Because the work happens on your device, there is nothing to upload and nothing to wait for — results are instant.',
  },
  {
    Icon: LuMonitorSmartphone,
    title: 'Works everywhere',
    text: 'One responsive site that works the same on a phone, a tablet or a desktop, in any modern browser.',
  },
];

const About = () => {
  usePageMeta({
    title: 'About',
    description: 'FileQuick is a free collection of privacy-first, in-browser tools for images and PDFs — resize, compress, convert, merge, sign and edit, with nothing uploaded.',
  });

  const toolCount = getAllTools().length;

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">About FileQuick</h1>

      <p className="mt-4 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
        FileQuick brings {toolCount}+ everyday file tools together in one place — resize and compress
        images, convert between formats, merge and split PDFs, sign documents, remove backgrounds,
        build passport photos and more. The idea is simple: stop hopping between a dozen sketchy
        websites for small jobs.
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300">
        What makes it different is where the work happens. Nearly every tool processes your file
        directly in your browser, so nothing is uploaded to a server and nothing is kept. It is fast,
        it is free, and it works without an account.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {POINTS.map((p) => (
          <div
            key={p.title}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300">
              <p.Icon className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <h2 className="mt-3 text-[15px] font-bold text-gray-900 dark:text-white">{p.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-400">{p.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/"
          className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Browse all tools
        </Link>
        <Link
          to="/faq"
          className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 dark:border-gray-600 dark:text-gray-200"
        >
          Read the FAQ
        </Link>
        <Link
          to="/contact"
          className="inline-flex items-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 dark:border-gray-600 dark:text-gray-200"
        >
          Contact us
        </Link>
      </div>
    </div>
  );
};

export default About;

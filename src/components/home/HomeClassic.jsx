import React from 'react';
import ToolsGrid from '../ToolsGrid';
import UploadZone from './UploadZone';
import TrustStrip from './TrustStrip';
import HowItWorks from './HowItWorks';
import { getHomeSections } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

const META = {
  all: null,
  image: { title: 'Image Tools', description: 'Resize, crop, compress, convert and remove backgrounds from images — free and in your browser.' },
  pdf: { title: 'PDF Tools', description: 'Merge, split, compress, convert, protect, sign and edit PDF files — free and in your browser.' },
  convert: { title: 'Convert Tools', description: 'Convert between images, PDF, Word, Excel, PowerPoint and plain text — free and in your browser.' },
  ai: { title: 'AI Tools', description: 'Upscale, remove backgrounds, scan documents and more — AI that runs on your device.' },
};

const HERO = {
  all: {
    eyebrow: 'Images & PDFs · all in one place',
    title: 'Every tool you need for images and PDFs',
    subtitle: 'Resize, compress, convert, merge, sign and edit — free, fast, and right in your browser.',
  },
  image: { eyebrow: 'Image tools', title: 'Edit images in seconds', subtitle: 'Resize, crop, compress and clean up photos without installing anything.' },
  pdf: { eyebrow: 'PDF tools', title: 'Work with PDFs the easy way', subtitle: 'Merge, split, compress, protect, sign, convert and edit PDF documents.' },
  convert: { eyebrow: 'Convert', title: 'Convert files to the format you need', subtitle: 'Images, PDF, Word, Excel, PowerPoint and text — pick a target and go.' },
  ai: { eyebrow: 'AI tools', title: 'AI that runs on your device', subtitle: 'Upscale photos, remove backgrounds, scan documents — nothing is uploaded.' },
};

const HomeClassic = ({ category = 'all' }) => {
  usePageMeta(META[category] || META.all);
  const hero = HERO[category] || HERO.all;
  const sections = getHomeSections(category);
  const showZone = category === 'all' || category === 'image';

  return (
    <div className="space-y-16 md:space-y-24 pb-4">
      <section className="relative pt-2">
        <div className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-gradient-to-r from-purple-500/20 via-pink-500/20 to-indigo-500/20 blur-3xl -z-10" />
        <div className="max-w-3xl mx-auto text-center">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-4">
            {hero.eyebrow}
          </span>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white mb-4">{hero.title}</h1>
          <p className="text-lg text-gray-600 dark:text-gray-300">{hero.subtitle}</p>
        </div>
        {showZone && (
          <div className="max-w-2xl mx-auto mt-10">
            <UploadZone />
          </div>
        )}
      </section>

      <TrustStrip />

      <div className="space-y-14">
        {sections.map((s) => (
          <ToolsGrid key={s.id} id={s.id} title={s.title} tools={s.tools} />
        ))}
      </div>

      <HowItWorks />
    </div>
  );
};

export default HomeClassic;

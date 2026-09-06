import React from 'react';
import ToolsGrid from '../ToolsGrid';
import { getMenuColumns } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

// Clean tool listing for a category — no website hero / feature strip.
const META = {
  pdf: { title: 'PDF Tools', sub: 'Merge, split, compress, protect, sign, convert and edit PDF documents.' },
  image: { title: 'Image Tools', sub: 'Resize, crop, compress, upscale and clean up photos.' },
  convert: { title: 'Converter Tools', sub: 'Convert files between formats — images, PDFs and documents.' },
  ai: { title: 'AI Tools', sub: 'Smart tools powered by models that run on your device.' },
};

const DesktopCategory = ({ category }) => {
  const meta = META[category] || { title: 'Tools' };
  usePageMeta({ title: meta.title });
  const columns = getMenuColumns(category);

  return (
    <div className="mx-auto max-w-6xl space-y-12">
      <header>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">{meta.title}</h1>
        {meta.sub && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.sub}</p>}
      </header>

      {columns.map((c) => (
        <ToolsGrid key={c.title} id={c.title} title={columns.length > 1 ? c.title : null} tools={c.tools} />
      ))}
    </div>
  );
};

export default DesktopCategory;

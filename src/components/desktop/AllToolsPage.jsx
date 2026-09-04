import React from 'react';
import ToolsGrid from '../ToolsGrid';
import { getHomeSections } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

const AllToolsPage = () => {
  usePageMeta({ title: 'All Tools' });
  const sections = getHomeSections('all');

  return (
    <div className="mx-auto max-w-6xl space-y-14">
      <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white">All Tools</h1>
      {sections.map((s) => (
        <ToolsGrid key={s.id} id={s.id} title={s.title} tools={s.tools} />
      ))}
    </div>
  );
};

export default AllToolsPage;

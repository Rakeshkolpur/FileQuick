import React from 'react';
import ToolsGrid from '../ToolsGrid';
import { getAllTools } from '../../data/tools';
import { usePageMeta } from '../../lib/seo';

// A curated "working with a document" slice of the PDF tools — editing and
// organizing pages, distinct from PDF Tools' full merge/split/convert list.
const DOCUMENT_TOOL_IDS = ['fill-sign', 'extract-text', 'watermark-pdf', 'page-numbers', 'organize-pdf', 'rotate-pdf', 'crop-pdf'];

const DocumentToolsPage = () => {
  usePageMeta({ title: 'Document Tools' });
  const tools = DOCUMENT_TOOL_IDS.map((id) => getAllTools().find((t) => t.id === id)).filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-6 text-2xl font-extrabold text-gray-900 dark:text-white">Document Tools</h1>
      <ToolsGrid id="document" title="Edit & organize" tools={tools} />
    </div>
  );
};

export default DocumentToolsPage;

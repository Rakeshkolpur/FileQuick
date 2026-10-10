import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import FileDropzone from '../../tool/FileDropzone';
import { getToolById, getToolTint } from '../../../data/tools';
import { handOffFile } from '../../../lib/fileHandoff';
import { formatBytes } from '../../../lib/format';

/**
 * File Converter hub: drop any supported file, see the conversions that fit
 * it, and continue in that converter with the file already loaded (handed
 * over in memory — see lib/fileHandoff.js). Below, every converter is listed.
 */

const KINDS = [
  { kind: 'image', label: 'Image', re: /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i, to: ['image-to-pdf', 'convert-image'] },
  { kind: 'pdf', label: 'PDF', re: /\.pdf$/i, to: ['pdf-to-word', 'pdf-to-jpg', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-text'] },
  { kind: 'word', label: 'Word document', re: /\.(docx?|odt|rtf)$/i, to: ['word-to-pdf'] },
  { kind: 'ppt', label: 'PowerPoint', re: /\.(pptx?|ppsx?|odp)$/i, to: ['powerpoint-to-pdf'] },
  { kind: 'excel', label: 'Spreadsheet', re: /\.(xlsx?|xlsm|ods|csv)$/i, to: ['excel-to-pdf'] },
  { kind: 'text', label: 'Text file', re: /\.(txt|md|markdown|log|json|xml)$/i, to: ['text-to-pdf'] },
];

const ACCEPT = [
  'image/*', '.pdf', '.doc', '.docx', '.odt', '.rtf', '.ppt', '.pptx', '.pps', '.ppsx', '.odp',
  '.xls', '.xlsx', '.xlsm', '.ods', '.csv', '.txt', '.md', '.markdown', '.log', '.json', '.xml',
].join(',');

const GROUPS = [
  { title: 'Convert to PDF', ids: ['word-to-pdf', 'image-to-pdf', 'powerpoint-to-pdf', 'excel-to-pdf', 'text-to-pdf'] },
  { title: 'Convert from PDF', ids: ['pdf-to-word', 'pdf-to-jpg', 'pdf-to-excel', 'pdf-to-powerpoint', 'pdf-to-text'] },
  { title: 'Images', ids: ['convert-image', 'image-to-pdf'] },
];

const kindOf = (file) => KINDS.find((k) => k.re.test(file?.name || '')) || null;

const ToolCard = ({ tool, onClick, to }) => {
  const inner = (
    <>
      <span className={`h-9 w-9 shrink-0 rounded-xl p-2 ${getToolTint(tool)}`}>{tool.icon}</span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-gray-900 dark:text-white">{tool.title}</span>
        <span className="block text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{tool.description}</span>
      </span>
    </>
  );
  const cls = 'flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left transition-colors hover:border-purple-300 dark:hover:border-purple-600';
  return onClick
    ? <button type="button" onClick={onClick} className={cls}>{inner}</button>
    : <Link to={to} className={cls}>{inner}</Link>;
};

const FileConverter = () => {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const kind = file ? kindOf(file) : null;

  const open = (toolId) => {
    handOffFile(file);
    navigate(`/${toolId}`);
  };

  return (
    <div className="space-y-8">
      {!file ? (
        <FileDropzone
          accept={ACCEPT}
          onFiles={(fs) => setFile(fs[0])}
          title="Drop any file to convert"
          hint="or click to browse"
          formats="PDF · Word · PowerPoint · Excel · JPG / PNG / WebP · TXT — we show what it can become"
        />
      ) : (
        <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{file.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{kind?.label || 'File'} · {formatBytes(file.size)}</p>
            </div>
            <button type="button" onClick={() => setFile(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              Choose another file
            </button>
          </div>
          {kind ? (
            <>
              <h2 className="mt-4 mb-2 text-sm font-semibold text-gray-900 dark:text-white">Convert it to…</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                {kind.to.map((id) => getToolById(id)).filter((t) => t && t.status !== 'soon').map((t) => (
                  <ToolCard key={t.id} tool={t} onClick={() => open(t.id)} />
                ))}
              </div>
              <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">The file opens in that converter, ready to go — nothing to upload twice.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">
              FileQuick can&apos;t convert this type of file yet. It works with PDF, Word, PowerPoint, Excel, images and text files.
            </p>
          )}
        </section>
      )}

      {GROUPS.map((g) => (
        <section key={g.title}>
          <h2 className="mb-3 text-base font-bold text-gray-900 dark:text-white">{g.title}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.ids.map((id) => getToolById(id)).filter((t) => t && t.status !== 'soon').map((t) => (
              <ToolCard key={t.id} tool={t} to={`/${t.id}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default FileConverter;

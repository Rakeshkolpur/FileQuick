import React, { createContext, useContext } from 'react';
import FileDropzone from './FileDropzone';
import Panel from './Panel';
import { formatBytes } from '../../lib/format';

const Ctx = createContext(null);
export const useToolFiles = () => useContext(Ctx);

/**
 * Standard shell for a single-file (or multi-file) tool.
 *
 * <ToolLayout file={file} accept="image/*" onFiles={fs => setFile(fs[0])} onReset={...}>
 *   <ToolLayout.Settings> ...controls... </ToolLayout.Settings>
 *   <ToolLayout.Result>   ...preview + download... </ToolLayout.Result>
 * </ToolLayout>
 *
 * With no file it renders the dropzone and ignores children.
 */
function ToolLayout({
  file,
  files,
  multiple = false,
  accept = 'image/*',
  formats,
  dropTitle = 'Drop your file here',
  dropHint = 'or click to browse',
  paste = true,
  onFiles,
  onReset,
  busy = false,
  children,
}) {
  const list = multiple ? files || [] : file ? [file] : [];
  const hasFile = list.length > 0;

  if (!hasFile) {
    return (
      <div className="max-w-2xl mx-auto">
        <FileDropzone
          accept={accept}
          multiple={multiple}
          formats={formats}
          title={dropTitle}
          hint={dropHint}
          paste={paste}
          onFiles={onFiles}
        />
      </div>
    );
  }

  const label = multiple
    ? `${list.length} file${list.length > 1 ? 's' : ''} selected`
    : list[0].name;
  const totalBytes = list.reduce((n, f) => n + (f.size || 0), 0);

  return (
    <Ctx.Provider value={{ file: list[0], files: list }}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/70 dark:border-gray-700/60 bg-gray-50 dark:bg-gray-800/60 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{label}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">{formatBytes(totalBytes)}</p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={busy}
            className="text-sm px-3 py-1.5 rounded-lg bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {multiple ? 'Start over' : 'Choose another'}
          </button>
        </div>
        <div className="grid lg:grid-cols-2 gap-6 items-start">{children}</div>
      </div>
    </Ctx.Provider>
  );
}

ToolLayout.Settings = function Settings({ children }) {
  return <div className="space-y-6">{children}</div>;
};

ToolLayout.Result = function Result({ children }) {
  return <div className="space-y-6 lg:sticky lg:top-24">{children}</div>;
};

ToolLayout.Placeholder = function Placeholder({ children }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-10 text-center min-h-[16rem]">
      <p className="text-gray-400 dark:text-gray-500">{children}</p>
    </div>
  );
};

ToolLayout.Panel = Panel;

export default ToolLayout;

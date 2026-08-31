import React, { useContext, useEffect } from 'react';
import FileDropzone from './FileDropzone';
import { ToolBackContext } from '../ToolWrapper';

/**
 * Compact editor layout: settings sidebar + main canvas.
 * No file -> centered dropzone. File -> sticky sidebar (scrolls internally,
 * pinned footer) beside the canvas.
 */
const ToolWorkspace = ({
  file,
  accept = 'image/*',
  multiple = false,
  formats,
  dropTitle = 'Drop your file here',
  dropHint = 'or click to browse',
  paste = true,
  onFiles,
  onBack,
  sidebar,
  footer,
  result,
  children,
}) => {
  const registerBack = useContext(ToolBackContext);
  useEffect(() => {
    if (!registerBack) return undefined;
    // While a file is loaded, the page's Back button returns to the upload
    // screen (via onBack) instead of leaving the tool.
    registerBack(file && onBack ? onBack : null);
    return () => registerBack(null);
  }, [file, onBack, registerBack]);

  if (!file) {
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

  if (result) {
    return (
      <>
        <div className="max-w-xl mx-auto rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 px-4 py-3">
          {result}
        </div>
        {/* Keep the workspace mounted (hidden) so refs / previews inside it survive. */}
        <div className="hidden" aria-hidden>{children}</div>
      </>
    );
  }

  return (
    <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] gap-6 items-start">
      <aside className="lg:sticky lg:top-24 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col overflow-hidden lg:max-h-[calc(100vh-7rem)]">
        <div className="flex-1 lg:overflow-y-auto p-5 space-y-5">{sidebar}</div>
        {footer && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">{footer}</div>
        )}
      </aside>
      <div className="min-w-0 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 bg-white dark:bg-gray-800 p-4 md:p-6">
        {children}
      </div>
    </div>
  );
};

export default ToolWorkspace;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { screenFiles, rejectionMessage } from '../../lib/fileValidation';

const UploadGlyph = () => (
  <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
  </svg>
);

/**
 * Reusable upload area for every tool.
 * onFiles is always called with an array (length 1 unless `multiple`).
 */
const FileDropzone = ({
  accept = 'image/*',
  multiple = false,
  maxMB,
  onFiles,
  title = 'Drop your file here',
  hint = 'or click to browse',
  formats,
  paste = true,
  compact = false,
}) => {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');

  const emit = useCallback(
    (list) => {
      const { accepted, rejected } = screenFiles(list, { accept, maxMB });
      setError(rejectionMessage(rejected));
      // pass `rejected` too — a multi-file tool can keep warning about the
      // dropped files after this upload area unmounts
      if (accepted.length) onFiles(multiple ? accepted : [accepted[0]], rejected);
    },
    [accept, maxMB, multiple, onFiles],
  );

  useEffect(() => {
    if (!paste) return undefined;
    const onPaste = (e) => {
      const picked = [...(e.clipboardData?.items || [])]
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter(Boolean);
      if (picked.length) emit(picked);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [paste, emit]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
      className={`relative rounded-2xl border-2 border-dashed text-center cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
        compact ? 'p-6' : 'p-10 md:p-14'
      } ${
        dragging
          ? 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10 scale-[1.01] shadow-xl shadow-purple-500/10'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        className={`mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-600/25 p-3.5 ${
          compact ? 'w-12 h-12' : 'w-16 h-16'
        }`}
      >
        <UploadGlyph />
      </div>
      <h3 className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl'}`}>{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mt-1">
        {hint}
        {paste ? ' · or paste from clipboard' : ''}
      </p>
      {formats && <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">{formats}</p>}
      {error && (
        <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
    </div>
  );
};

export default FileDropzone;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { screenFiles, rejectionMessage, DESKTOP_LIMIT_MB } from '../../lib/fileValidation';
import { isDesktop } from '../../lib/desktop';

// Same cloud shape as the homepage's UploadZone CloudMark, just a deeper
// blue fill instead of that one's light indigo gradient.
const UploadGlyph = ({ className }) => (
  <svg viewBox="0 0 72 56" className={className}>
    <defs>
      <linearGradient id="fq-dropzone-cloud" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2563eb" />
        <stop offset="1" stopColor="#1d4ed8" />
      </linearGradient>
    </defs>
    <path
      fill="url(#fq-dropzone-cloud)"
      d="M20 52a14 14 0 01-2.6-27.75 18 18 0 0134.6-4.2A13 13 0 0150 52H20z"
    />
    <path fill="#fff" d="M36 15l10 11h-6.2v13h-7.6V26H26l10-11z" />
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
  const rootRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [rejects, setRejects] = useState([]);

  const emit = useCallback(
    (list) => {
      const { accepted, rejected } = screenFiles(list, { accept, maxMB });
      setRejects(rejected);
      // pass `rejected` too — a multi-file tool can keep warning about the
      // dropped files after this upload area unmounts
      if (accepted.length) onFiles(multiple ? accepted : [accepted[0]], rejected);
    },
    [accept, maxMB, multiple, onFiles],
  );

  const error = rejectionMessage(rejects);
  const overLimit = !isDesktop() && rejects.some((r) => r.kind === 'size');

  useEffect(() => {
    if (!paste) return undefined;
    const onPaste = (e) => {
      // A tool kept alive behind another one (display: none) must not also
      // take the paste — only the dropzone the user can actually see.
      if (rootRef.current && rootRef.current.getClientRects().length === 0) return;
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
      ref={rootRef}
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
      <UploadGlyph className={`mx-auto mb-4 drop-shadow-lg ${compact ? 'w-14 h-11' : 'w-20 h-16'}`} />
      <h3 className={`font-bold text-gray-900 dark:text-white ${compact ? 'text-lg' : 'text-2xl'}`}>{title}</h3>
      <p className="text-gray-500 dark:text-gray-400 mt-1">
        {hint}
        {paste ? ' · or paste from clipboard' : ''}
      </p>
      {formats && <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">{formats}</p>}
      {error && (
        <p className="mt-3 text-xs font-medium text-red-600 dark:text-red-400" role="alert">{error}</p>
      )}
      {overLimit && (
        <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
          Need bigger files? The{' '}
          <Link
            to="/download"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-purple-600 hover:underline dark:text-purple-400"
          >
            desktop app
          </Link>{' '}
          handles up to {DESKTOP_LIMIT_MB} MB.
        </p>
      )}
    </div>
  );
};

export default FileDropzone;

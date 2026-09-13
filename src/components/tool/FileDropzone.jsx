import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { screenFiles, rejectionMessage, DESKTOP_LIMIT_MB } from '../../lib/fileValidation';
import { isDesktop } from '../../lib/desktop';

// A cloud silhouette — one dominant dome plus two low, gentle bumps that
// only widen the base (their tops sit well below the dome's edge, so they
// don't poke up into a second peak) — with a bold white up-arrow on top.
const UploadGlyph = ({ className }) => (
  <svg viewBox="0 0 64 48" className={className}>
    <g className="fill-blue-600">
      <rect x="10" y="24" width="44" height="16" rx="8" />
      <circle cx="17" cy="27" r="10" />
      <circle cx="47" cy="27" r="10" />
      <circle cx="32" cy="18" r="17" />
    </g>
    <path d="M32 19l8 8h-5v10h-6V27h-5l8-8z" fill="white" />
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
      <UploadGlyph className={`mx-auto mb-4 drop-shadow-lg ${compact ? 'w-16 h-12' : 'w-24 h-[4.5rem]'}`} />
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

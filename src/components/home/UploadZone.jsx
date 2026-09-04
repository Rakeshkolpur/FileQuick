import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuUploadCloud, LuFolderOpen } from 'react-icons/lu';

const PDF_ACTIONS = [
  { id: 'pdf-compressor', label: 'Compress' },
  { id: 'merge-pdf', label: 'Merge' },
  { id: 'split-pdf', label: 'Split' },
  { id: 'pdf-editor', label: 'Edit' },
  { id: 'pdf-to-word', label: 'To Word' },
];

const UploadZone = ({ v2 = false }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [pdfName, setPdfName] = useState(null);

  const handleImage = useCallback(
    (file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try { sessionStorage.setItem('pendingImageUpload', e.target.result); } catch (_) { /* quota */ }
        navigate('/resize-image');
      };
      reader.readAsDataURL(file);
    },
    [navigate],
  );

  const handleFile = useCallback(
    (file) => {
      if (!file) return;
      if (file.type.startsWith('image/')) return handleImage(file);
      if (file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf')) {
        setPdfName(file.name || 'document.pdf');
        return;
      }
      alert('Please choose an image or a PDF file.');
    },
    [handleImage],
  );

  useEffect(() => {
    const onPaste = (e) => {
      const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
      if (item) handleFile(item.getAsFile());
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFile]);

  const dragClass = dragging
    ? (v2 ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-500/10'
          : 'border-purple-500 bg-purple-50/70 dark:bg-purple-500/10 scale-[1.01] shadow-xl shadow-purple-500/10')
    : (v2 ? 'border-indigo-200 bg-white/40 hover:border-indigo-400 dark:border-indigo-800/60 dark:bg-white/[0.03]'
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-purple-400 dark:hover:border-purple-500');

  return (
    <div
      className={`relative rounded-2xl border-2 border-dashed text-center transition-all duration-200 ${v2 ? 'p-8 sm:p-12' : 'p-10'} ${dragClass}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]); }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />

      {!pdfName && v2 ? (
        <>
          <LuUploadCloud className="mx-auto mb-3 h-12 w-12 text-indigo-500 dark:text-indigo-400" strokeWidth={1.6} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Drop any file here</h2>
          <p className="my-2 text-sm text-gray-400 dark:text-gray-500">or</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/25 hover:bg-indigo-700"
          >
            <LuFolderOpen className="h-4 w-4" />
            Choose File
          </button>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">PDF, JPG, PNG, WEBP, DOCX and more</p>
        </>
      ) : !pdfName ? (
        <>
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-600/25">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 20h16" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Drop an image or PDF to start</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            or paste from your clipboard — we&apos;ll open the right tool for you
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="px-7 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:opacity-95 shadow-lg shadow-purple-600/20 transition-opacity"
          >
            Select File
          </button>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">JPG · PNG · WebP · GIF · PDF</p>
        </>
      ) : (
        <div>
          <div className="mx-auto mb-3 w-14 h-14 rounded-xl bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center p-3.5">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} className="w-full h-full">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 dark:text-white mb-1 truncate max-w-md mx-auto">{pdfName}</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">What do you want to do with this PDF?</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PDF_ACTIONS.map((a) => (
              <button
                key={a.id}
                onClick={() => navigate(`/${a.id}`)}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:bg-purple-100 hover:text-purple-700 dark:hover:bg-purple-900/40 dark:hover:text-purple-200 transition-colors"
              >
                {a.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => setPdfName(null)}
            className="mt-4 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            Choose a different file
          </button>
        </div>
      )}
    </div>
  );
};

export default UploadZone;

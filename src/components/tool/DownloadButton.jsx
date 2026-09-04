import React from 'react';

export const downloadBlob = (blob, filename) => {
  // In the desktop app, "download" opens a real native Save dialog — same
  // call site, no per-tool changes — so the user picks where it goes, same
  // as any other desktop app. A <DesktopBridge> toast confirms it afterwards.
  if (typeof window !== 'undefined' && window.fq && window.fq.isDesktop) {
    blob.arrayBuffer()
      .then((buf) => window.fq.saveFileAs(filename || 'download', new Uint8Array(buf)))
      .then((res) => { if (res && !res.canceled) window.dispatchEvent(new CustomEvent('fq:saved', { detail: res })); })
      .catch((err) => window.dispatchEvent(new CustomEvent('fq:saved', { detail: { error: String(err) } })));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'download';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const DownloadIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-4-4m4 4l4-4" />
  </svg>
);

const DownloadButton = ({ blob, filename, onClick, disabled, children = 'Download', className = '' }) => (
  <button
    type="button"
    disabled={disabled || (!blob && !onClick)}
    onClick={() => {
      if (onClick) onClick();
      else if (blob) downloadBlob(blob, filename);
    }}
    className={`w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className}`}
  >
    <DownloadIcon />
    {children}
  </button>
);

export default DownloadButton;

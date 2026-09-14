import React, { useState } from 'react';

/**
 * A "Support this project" link that opens a small modal with a PhonePe UPI
 * QR code. Purely optional for the visitor — no payment flow runs on this
 * site, it just shows the same QR image you'd scan from any UPI app.
 */
export const SupportModal = ({ onClose }) => (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    onClick={onClose}
  >
    <div
      className="w-full max-w-xs overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-2xl ring-1 ring-black/5 dark:ring-white/10"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-5 pt-5 text-center">
        <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-600 to-pink-600 text-lg">☕</div>
        <h3 className="text-base font-bold text-gray-900 dark:text-white">Enjoying FileQuick?</h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          It&rsquo;s free and runs mostly in your browser — but hosting and the AI models still cost money.
          A small UPI tip helps keep it that way.
        </p>
      </div>
      <img
        src={`${import.meta.env.BASE_URL}support-qr.png`}
        alt="Scan with any UPI app to support FileQuick"
        className="mt-3 w-full"
      />
      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2 rounded-lg text-sm font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
        >
          Close
        </button>
      </div>
    </div>
  </div>
);

const SupportLink = ({ className = '', children, ...rest }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className || 'inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:underline dark:text-purple-400'}
        {...rest}
      >
        {children || <>☕ Support this project</>}
      </button>
      {open && <SupportModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default SupportLink;

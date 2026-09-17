import React, { useState } from 'react';
import { desktopInfo, isDesktop } from '../lib/desktop';

const SUPPORT_EMAIL = 'mju646139@gmail.com';

/**
 * A small "send feedback" modal. No backend, no account — it builds a
 * mailto: link (message + an optional reply email, plus which app/version
 * sent it) and hands it to the system's mail client, matching the site's
 * no-telemetry stance. Works the same on the web and inside the desktop
 * app (the main process opens mailto: links via the OS's default handler).
 */
export const FeedbackModal = ({ onClose }) => {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    let context = 'Web';
    if (isDesktop()) {
      const info = await desktopInfo();
      context = `Desktop v${info?.version || '?'} · ${info?.platform || ''}`;
    }
    const body = `${message.trim()}\n\n—\nFrom: ${email.trim() || 'not provided'}\nApp: ${context}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('FileQuick feedback')}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
    setSent(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-black/5 dark:bg-gray-800 dark:ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="text-center">
            <span className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Your mail app should be open</h3>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              Didn&apos;t pop up? Email us directly at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-purple-600 hover:underline dark:text-purple-400">
                {SUPPORT_EMAIL}
              </a>.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={send}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white">Send feedback</h3>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              Bug, idea, or just a thought — we read every one. Opens your email app, nothing is sent from here.
            </p>
            <textarea
              autoFocus
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              className="mt-3 w-full resize-none rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email (optional, if you want a reply)"
              className="mt-2 w-full rounded-lg border border-gray-300 bg-white p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 dark:border-gray-600 dark:bg-gray-900 dark:text-white"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:border-gray-300 dark:border-gray-600 dark:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!message.trim()}
                className="flex-1 rounded-lg bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Send
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/** Drop-in trigger — pass children/className to style the button itself. */
const FeedbackButton = ({ className = '', children }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children || 'Send feedback'}
      </button>
      {open && <FeedbackModal onClose={() => setOpen(false)} />}
    </>
  );
};

export default FeedbackButton;

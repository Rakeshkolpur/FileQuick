import React, { useState } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { FAQS } from '../data/faq';
import { useJsonLd, faqJsonLd } from '../lib/seo';

/**
 * Accordion FAQ list. Used on the homepage and on /faq. Emits FAQPage
 * JSON-LD once (pass emitJsonLd={false} on a second instance on the same page).
 */
const FaqAccordion = ({ items = FAQS, emitJsonLd = true }) => {
  const [open, setOpen] = useState(0);
  useJsonLd('faq', emitJsonLd ? faqJsonLd(items) : null);

  return (
    <ul className="divide-y divide-gray-200 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-gray-700/60 dark:border-gray-700 dark:bg-gray-800">
      {items.map((it, i) => {
        const isOpen = open === i;
        return (
          <li key={it.q}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <span className="text-[15px] font-semibold text-gray-900 dark:text-white">{it.q}</span>
              <LuChevronDown
                className={`h-5 w-5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-5 -mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                {it.a}
              </p>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default FaqAccordion;

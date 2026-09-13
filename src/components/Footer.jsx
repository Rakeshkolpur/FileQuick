import React from 'react';
import { Link } from 'react-router-dom';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { getToolsByCategory } from '../data/tools';
import Logo from './Logo';
import SupportLink from './tool/SupportQR';

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/Rakeshkolpur', Icon: FaGithub },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/krakeshfullstack/', Icon: FaLinkedin },
];

const pdfTools = getToolsByCategory('pdf');
const COLUMNS = [
  { title: 'Image Tools', slug: 'image', tools: getToolsByCategory('image') },
  { title: 'PDF Tools', slug: 'pdf', tools: pdfTools.slice(0, Math.ceil(pdfTools.length / 2)) },
  { title: 'More PDF Tools', slug: 'pdf', tools: pdfTools.slice(Math.ceil(pdfTools.length / 2)) },
];

const Footer = () => (
  <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
    <div className="container mx-auto px-4 py-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        <div className="col-span-2 md:col-span-1">
          <Logo className="mb-3" markClassName="h-8 w-8" wordClassName="text-lg" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            FileQuick (also written File Quick) is all your file tools in one place — resize, compress, convert, merge, sign and edit images and PDFs, free and in your browser at filequik.in.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <Link
              to={`/${col.slug}`}
              className="text-sm font-semibold text-gray-900 dark:text-white hover:text-purple-600 dark:hover:text-purple-400"
            >
              {col.title}
            </Link>
            <ul className="mt-3 space-y-2">
              {col.tools.map((t) => (
                <li key={t.id}>
                  <Link
                    to={`/${t.id}`}
                    className="text-sm text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400"
                  >
                    {t.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-10 pt-6 border-t border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-400">© {new Date().getFullYear()} FileQuick</p>
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-2">
          <Link to="/about" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            About
          </Link>
          <Link to="/download" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            Download
          </Link>
          <Link to="/faq" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            FAQ
          </Link>
          <Link to="/contact" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            Contact
          </Link>
          <Link to="/privacy-policy" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            Privacy
          </Link>
          <Link to="/terms-of-service" className="text-sm text-gray-500 hover:text-purple-600 dark:text-gray-400 dark:hover:text-purple-400">
            Terms
          </Link>
          <SupportLink className="text-sm font-medium text-purple-600 hover:underline dark:text-purple-400">
            ☕ Support this project
          </SupportLink>
        </div>
        <div className="flex items-center gap-3">
          {SOCIAL_LINKS.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.label}
              title={s.label}
              className="grid h-8 w-8 place-items-center rounded-full text-gray-400 hover:bg-purple-50 hover:text-purple-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-purple-400"
            >
              <s.Icon className="h-4 w-4" />
            </a>
          ))}
        </div>
      </div>
    </div>
  </footer>
);

export default Footer;

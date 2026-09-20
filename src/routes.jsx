import React, { useRef } from 'react';
import { Routes, Route, Navigate, useParams, useLocation, useNavigationType } from 'react-router-dom';
import HomePage from './components/HomePage';
import ToolWrapper from './components/ToolWrapper';
import Contact from './components/Contact';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import About from './components/About';
import FaqPage from './components/FaqPage';
import DownloadApp from './components/DownloadApp';
import AccountsSoon from './components/AccountsSoon';
import DocumentToolsPage from './components/desktop/DocumentToolsPage';
import AllToolsPage from './components/desktop/AllToolsPage';
import RecentFilesPage from './components/desktop/RecentFilesPage';
import FavoritesPage from './components/desktop/FavoritesPage';
import SettingsPage from './components/desktop/SettingsPage';
import { getToolById } from './data/tools';
import NotFound from './components/NotFound';
import {
  parseTargetSlug,
  looksLikeTargetSlug,
  targetMeta,
  targetSeoContent,
} from './lib/targetSizeUrl';

// Old / alternate tool slugs people may have bookmarked or that show up in
// search results. Anything not listed falls through to the tool lookup.
const TOOL_ALIASES = {
  'compress-pdf': 'pdf-compressor',
  'pdf-compress': 'pdf-compressor',
  'jpg-to-pdf': 'image-to-pdf',
  'jpeg-to-pdf': 'image-to-pdf',
  'png-to-pdf': 'image-to-pdf',
  'images-to-pdf': 'image-to-pdf',
  'pdf-to-jpeg': 'pdf-to-jpg',
  'pdf-to-image': 'pdf-to-jpg',
  'sign-pdf': 'fill-sign',
  'esign-pdf': 'fill-sign',
  'e-sign-pdf': 'fill-sign',
  'rotate-pdf-pages': 'rotate-pdf',
  'delete-pdf-pages': 'delete-pages',
  'remove-pdf-pages': 'delete-pages',
  'add-watermark': 'watermark-pdf',
  'ppt-to-pdf': 'powerpoint-to-pdf',
  'pptx-to-pdf': 'powerpoint-to-pdf',
  'xls-to-pdf': 'excel-to-pdf',
  'xlsx-to-pdf': 'excel-to-pdf',
  'txt-to-pdf': 'text-to-pdf',
  'background-remover': 'remove-background',
  'remove-bg': 'remove-background',
  'photo-signature-resizer': 'exam-photo-resizer',
  'signature-resizer': 'exam-photo-resizer',
  'exam-photo': 'exam-photo-resizer',
  'ssc-photo-resizer': 'exam-photo-resizer',
  'photo-resizer-in-kb': 'exam-photo-resizer',
  'resize-image-in-kb': 'exam-photo-resizer',
  'upsc-photo-resizer': 'exam-photo-resizer',
  'exam-photo-signature': 'exam-photo-resizer',
  'photo-background-changer': 'exam-photo-resizer',
  'increase-image-size-in-kb': 'increase-image-size',
  'increase-photo-size': 'increase-image-size',
  'increase-jpg-size': 'increase-image-size',
  'make-image-bigger-kb': 'increase-image-size',
};

// Canonical tool URL is now the short form: /resize-image  (not /tool/resize-image)
const toolPath = (id) => `/${id}`;

// Tools kept mounted (hidden) after you leave them, so pressing Back returns to
// the work you'd done instead of an empty upload screen. Only tools with no
// window-level keyboard handlers (the PDF editor / sign / JPG→PDF ones have
// them) and no heavy engine (document scanner, OCR) qualify.
const KEEP_ALIVE = new Set([
  'resize-image', 'crop-image', 'compress-image', 'increase-image-size', 'remove-background',
  'convert-image', 'upscale-image', 'profile-picture', 'passport-photo', 'exam-photo-resizer',
  'merge-pdf', 'split-pdf', 'pdf-compressor', 'organize-pdf', 'rotate-pdf', 'crop-pdf',
  'delete-pages', 'extract-pages', 'page-numbers', 'watermark-pdf', 'remove-watermark',
]);
const MAX_ALIVE = 4; // least-recently-used tools beyond this are dropped

// What a URL segment resolves to: a tool page (with the props to render it),
// a redirect, or a 404.
const resolveToolSlug = (slug) => {
  if (getToolById(slug)) return { kind: 'tool', toolId: slug, props: { toolId: slug } };
  const alias = TOOL_ALIASES[(slug || '').toLowerCase()];
  if (alias) return { kind: 'redirect', to: toolPath(alias) };

  // Dynamic "compress <format> to <size>" URLs — /jpg-to-20kb, /png-to-50kb …
  // These reuse the existing Compress Image tool with the target prefilled.
  const preset = parseTargetSlug(slug);
  if (preset) {
    return {
      kind: 'tool',
      toolId: 'compress-image',
      props: {
        toolId: 'compress-image',
        pageMeta: { ...targetMeta(preset), seoContent: targetSeoContent(preset) },
        toolProps: { presetFormat: preset.outFormat, presetKB: preset.targetKB },
      },
    };
  }
  // Looked like a target-size URL but the size/format was invalid — real 404.
  if (looksLikeTargetSlug(slug)) return { kind: 'notfound' };
  return { kind: 'redirect', to: '/' };
};

// Resolves the canonical /:toolId route.
//
// Tools are separate pages, so leaving one normally throws its state away.
// For the KEEP_ALIVE tools, the ones you used last stay mounted behind the
// visible one. Arriving by Back/Forward brings the kept instance back as it
// was; arriving any other way (nav link, tool card, "send to…") mounts a
// fresh one, exactly as before, so a new visit never shows stale work.
const ToolRoute = () => {
  const { toolId: slug } = useParams();
  const location = useLocation();
  const navType = useNavigationType();
  const cacheRef = useRef(new Map()); // slug -> { gen, props }, oldest first
  const handledRef = useRef(null); // location.key we last made a keep/fresh decision for

  const resolved = resolveToolSlug(slug);
  const keepable = resolved.kind === 'tool' && KEEP_ALIVE.has(resolved.toolId);
  const cache = cacheRef.current;

  if (keepable) {
    const existing = cache.get(slug);
    if (handledRef.current !== location.key) {
      handledRef.current = location.key;
      const reuse = existing && navType === 'POP';
      cache.delete(slug); // re-insert as most recently used
      cache.set(slug, { gen: existing ? existing.gen + (reuse ? 0 : 1) : 0, props: resolved.props });
      while (cache.size > MAX_ALIVE) cache.delete(cache.keys().next().value);
    } else if (existing) {
      existing.props = resolved.props;
    } else {
      cache.set(slug, { gen: 0, props: resolved.props });
    }
  }

  if (resolved.kind === 'redirect') return <Navigate to={resolved.to} replace />;
  if (resolved.kind === 'notfound') return <NotFound />;

  return (
    <>
      {[...cache.entries()].map(([k, entry]) => (
        <div key={`${k}#${entry.gen}`} hidden={!keepable || k !== slug}>
          <ToolWrapper {...entry.props} active={keepable && k === slug} />
        </div>
      ))}
      {!keepable && <ToolWrapper {...resolved.props} />}
    </>
  );
};

// /tool/:toolId is the old URL shape — send it to the short canonical one so
// existing links, bookmarks and search results keep working.
const LegacyToolRoute = () => {
  const { toolId } = useParams();
  const id = getToolById(toolId) ? toolId : TOOL_ALIASES[(toolId || '').toLowerCase()];
  return <Navigate to={id ? toolPath(id) : '/'} replace />;
};

// /category/:categoryId — image / pdf / convert / ai are real; else -> home.
const CATEGORY_SLUGS = ['image', 'pdf', 'convert', 'ai'];
const CategoryRoute = () => {
  const { categoryId } = useParams();
  if (CATEGORY_SLUGS.includes(categoryId)) return <HomePage />;
  return <Navigate to="/" replace />;
};

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />

    {/* Category landing pages */}
    <Route path="/image" element={<HomePage />} />
    <Route path="/pdf" element={<HomePage />} />
    <Route path="/convert" element={<HomePage />} />
    <Route path="/ai" element={<HomePage />} />
    <Route path="/category/:categoryId" element={<CategoryRoute />} />

    {/* Desktop app sidebar destinations (harmless to reach on the web too) */}
    <Route path="/document-tools" element={<DocumentToolsPage />} />
    <Route path="/all-tools" element={<AllToolsPage />} />
    <Route path="/recent-files" element={<RecentFilesPage />} />
    <Route path="/favorites" element={<FavoritesPage />} />
    <Route path="/settings" element={<SettingsPage />} />

    {/* Static pages */}
    <Route path="/about" element={<About />} />
    <Route path="/faq" element={<FaqPage />} />
    <Route path="/download" element={<DownloadApp />} />
    <Route path="/contact" element={<Contact />} />
    <Route path="/terms-of-service" element={<TermsOfService />} />
    <Route path="/privacy-policy" element={<PrivacyPolicy />} />
    <Route path="/login" element={<AccountsSoon mode="login" />} />
    <Route path="/signup" element={<AccountsSoon mode="signup" />} />

    {/* Old tool URLs -> new short URLs */}
    <Route path="/tool" element={<Navigate to="/" replace />} />
    <Route path="/tools" element={<Navigate to="/" replace />} />
    <Route path="/tool/:toolId" element={<LegacyToolRoute />} />

    {/* Canonical tool URL: /resize-image, /merge-pdf, ... */}
    <Route path="/:toolId" element={<ToolRoute />} />

    {/* Unknown URL — send the visitor to the home page instead of a dead end. */}
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
);

export default AppRoutes;

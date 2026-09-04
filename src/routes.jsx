import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
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
};

// Canonical tool URL is now the short form: /resize-image  (not /tool/resize-image)
const toolPath = (id) => `/${id}`;

// Resolves the canonical /:toolId route.
const ToolRoute = () => {
  const { toolId } = useParams();
  if (getToolById(toolId)) return <ToolWrapper />;
  const alias = TOOL_ALIASES[(toolId || '').toLowerCase()];
  if (alias) return <Navigate to={toolPath(alias)} replace />;
  return <Navigate to="/" replace />;
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

import React, { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getToolById } from '../data/tools';
import RelatedTools from './tool/RelatedTools';
import TrustStrip from './home/TrustStrip';
import ToolSeoContent from './tool/ToolSeoContent';
import LandingLinks from './tool/LandingLinks';
import { useToolSeo } from '../lib/toolSeoLoader';
import { usePageMeta } from '../lib/seo';
import { isChunkLoadError, withChunkRetry } from '../lib/chunkReload';

const CATEGORY_LABEL = { image: 'Image Tools', pdf: 'PDF Tools' };

/**
 * A tool can register a function here (via ToolWorkspace's `onBack`). While one
 * is registered, the page's Back button runs it — e.g. "clear the loaded file
 * and return to the upload screen" — instead of leaving the page. When nothing
 * is registered, Back does normal history navigation.
 */
export const ToolBackContext = React.createContext(() => {});

class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('Tool crashed:', error, info);
  }
  render() {
    if (this.state.error && isChunkLoadError(this.state.error)) {
      // An old copy of the page asked for files from a previous version of
      // the site (or the network dropped). A fresh load fixes it.
      return (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            FileQuick was just updated
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            Reload the page to get the latest version of this tool. If it keeps happening, check your internet connection.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Reload page
          </button>
        </div>
      );
    }
    if (this.state.error) {
      return (
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Something went wrong in this tool
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
            {String(this.state.error?.message || this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Loading = () => (
  <div className="flex items-center justify-center py-24">
    <div className="w-12 h-12 border-4 border-t-indigo-600 border-gray-200 dark:border-gray-700 rounded-full animate-spin" />
  </div>
);

const ComingSoon = ({ tool }) => (
  <div className="max-w-md mx-auto text-center py-16 px-6 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10">
    <div className="mx-auto mb-4 h-12 w-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </div>
    <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">{tool.title} — coming soon</h2>
    <p className="text-gray-600 dark:text-gray-300 text-sm">
      {tool.comingSoonNote || 'This one runs on our conversion engine, which we’re bringing online shortly. Check back in a few days.'}
    </p>
    <Link
      to="/pdf"
      className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
    >
      Browse the tools that work now
    </Link>
  </div>
);

const TopBar = ({ tool, onBack, minimal }) => {
  return (
    <div className={`flex items-center justify-between gap-3 ${minimal ? 'mb-2' : 'mb-4'}`}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 -ml-1 px-1 py-1 rounded-lg"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
        </svg>
        Back
      </button>
      {minimal ? (
        // Slim / editor layouts drop the big header, so this compact label is
        // the page's <h1> — every tool page needs exactly one (unless the tool
        // renders its own, `ownH1`).
        tool.ownH1
          ? <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{tool.title}</span>
          : <h1 className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">{tool.title}</h1>
      ) : (
        <nav className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500 min-w-0">
          <Link to="/" className="hover:text-purple-600 dark:hover:text-purple-400 hidden sm:inline">Home</Link>
          <span aria-hidden className="hidden sm:inline">/</span>
          <Link to={`/${tool.category}`} className="hover:text-purple-600 dark:hover:text-purple-400 whitespace-nowrap">
            {CATEGORY_LABEL[tool.category] || 'Tools'}
          </Link>
          <span aria-hidden>/</span>
          <span className="text-gray-600 dark:text-gray-300 truncate">{tool.title}</span>
        </nav>
      )}
    </div>
  );
};

/**
 * @param {object}  [props]
 * @param {string}  [props.toolId]    override the :toolId route param (dynamic pages)
 * @param {object}  [props.pageMeta]  { title, description, h1, robots, seoContent } override
 * @param {object}  [props.toolProps] spread onto the lazy tool component
 * @param {boolean} [props.active]    false while kept mounted but hidden (owns no page meta then)
 */
const ToolWrapper = ({ toolId: toolIdProp, pageMeta, toolProps, active = true } = {}) => {
  const params = useParams();
  const toolId = toolIdProp || params.toolId;
  const navigate = useNavigate();
  const location = useLocation();
  // Opened from another tool's "send to …" buttons (OpenInTool / OpenInPdfTool)
  const cameFromTool = !!location.state?.fromTool;
  const tool = getToolById(toolId);
  const toolSeo = useToolSeo(tool?.id);
  const [moreOpen, setMoreOpen] = useState(false); // phones: how-to/FAQ folded away

  usePageMeta(
    pageMeta
      || (tool
        ? {
          title: toolSeo?.seoTitle || tool.title,
          description: toolSeo?.seoDescription || tool.description,
        }
        : null),
    active,
  );

  const LazyTool = useMemo(() => (tool?.load ? React.lazy(withChunkRetry(tool.load)) : null), [tool]);

  // A mounted tool may register an in-page "back" action (see ToolBackContext).
  const innerBackRef = useRef(null);
  const registerBack = useCallback((fn) => {
    innerBackRef.current = typeof fn === 'function' ? fn : null;
  }, []);

  const handleBack = useCallback(() => {
    if (innerBackRef.current) {
      // Run the tool's own step back (result → editing → upload screen). The
      // update is flushed right away so we can see where the tool landed.
      const step = innerBackRef.current;
      flushSync(() => step());
      // Reached this tool from another tool's "send to …"? Then stepping back
      // past the handed-over file means "take me back to where I was" — return
      // to that tool (still showing its result) instead of an empty upload box.
      if (!(cameFromTool && !innerBackRef.current)) return;
      navigate(-1);
      return;
    }
    if (window.history.length > 1) navigate(-1);
    else if (tool) navigate(`/${tool.category}`);
    else navigate('/');
  }, [navigate, tool, cameFromTool]);

  // Unknown tool slug — the router normally catches this, but stay safe.
  if (!tool) return <Navigate to="/" replace />;

  const isReady = tool.status !== 'soon' && LazyTool;
  // `minimal` — editor tools: no title block, no breadcrumb, no footer, widest.
  // `slim` — every PDF tool: drop the title block + breadcrumb (small title by
  // the Back button instead) and go wider, but keep the related-tools footer.
  const minimal = tool.chrome === 'min';
  const slim = minimal || tool.category === 'pdf';
  // The huge PDF editors need every pixel; a minimal image tool just wants the
  // chrome gone, not a 1760px canvas.
  const width = minimal
    ? (tool.category === 'image' ? 'max-w-6xl' : 'max-w-[110rem]')
    : slim ? 'max-w-[100rem]' : 'max-w-7xl';

  const heading = pageMeta?.h1 || tool.title;

  return (
    <div className={`${width} mx-auto`}>
      <TopBar tool={{ ...tool, title: heading }} onBack={handleBack} minimal={slim} />

      {!slim && (
        <header className="mb-3.5">
          <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {heading}
          </h1>
          {/* A tool can opt out of the subtitle line (compactHeader) to save
              vertical space once a file is loaded — the description still
              exists for tool-grid cards and the meta description tag,
              it just isn't repeated here. Every other tool is unaffected. */}
          {!tool.compactHeader && (
            <p className="mt-1 text-[13px] md:text-sm text-gray-500 dark:text-gray-400 max-w-2xl">
              {pageMeta?.description || tool.description}
            </p>
          )}
        </header>
      )}

      <ErrorBoundary>
        {isReady ? (
          <Suspense fallback={<Loading />}>
            <ToolBackContext.Provider value={registerBack}>
              <LazyTool toolId={tool.id} {...(toolProps || {})} />
            </ToolBackContext.Provider>
          </Suspense>
        ) : (
          <ComingSoon tool={tool} />
        )}
      </ErrorBoundary>

      {isReady && (minimal ? (pageMeta?.seoContent || toolSeo) : true) && (
        <div className="mt-10 md:mt-16">
          {/* Phones keep the tool itself up front; the reading material sits
              behind one button (still in the page, so search engines see it). */}
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            aria-expanded={moreOpen}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-700 md:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          >
            How to use &amp; FAQ
            <svg className={`h-4 w-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div className={`${moreOpen ? 'mt-8 block' : 'hidden'} space-y-14 md:mt-0 md:block`}>
            <ToolSeoContent tool={tool} seo={pageMeta?.seoContent || toolSeo} />
            <LandingLinks toolId={tool.id} currentSlug={params.toolId} />
            {!minimal && !(toolSeo?.related?.length) && (
              <RelatedTools category={tool.category} currentId={tool.id} />
            )}
            {!minimal && <TrustStrip />}
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolWrapper;

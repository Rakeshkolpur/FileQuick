import React, { Suspense } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import HomeV2 from './home/HomeV2';
import { isDesktop } from '../lib/desktop';
import { withChunkRetry } from '../lib/chunkReload';

// only the web home page (HomeV2) is in the main bundle; the rest load when used
const HomeClassic = React.lazy(withChunkRetry(() => import('./home/HomeClassic')));
const DesktopHome = React.lazy(withChunkRetry(() => import('./desktop/DesktopHome')));
const DesktopCategory = React.lazy(withChunkRetry(() => import('./desktop/DesktopCategory')));

const VIRTUAL = ['image', 'pdf', 'convert', 'ai'];

const HomePage = () => {
  const { categoryId } = useParams();
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/+/, '').split('/')[0];
  const category = categoryId || (VIRTUAL.includes(seg) ? seg : 'all');

  if (category === 'all' && !isDesktop()) return <HomeV2 />;
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      {category === 'all' ? <DesktopHome />
        : isDesktop() ? <DesktopCategory category={category} />
          : <HomeClassic category={category} />}
    </Suspense>
  );
};

export default HomePage;

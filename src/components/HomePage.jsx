import React from 'react';
import { useLocation, useParams } from 'react-router-dom';
import HomeV2 from './home/HomeV2';
import HomeClassic from './home/HomeClassic';
import { getHomeDesign } from '../lib/uiFlags';

const VIRTUAL = ['image', 'pdf', 'convert', 'ai'];

const HomePage = () => {
  const { categoryId } = useParams();
  const { pathname } = useLocation();
  const seg = pathname.replace(/^\/+/, '').split('/')[0];
  const category = categoryId || (VIRTUAL.includes(seg) ? seg : 'all');

  if (category === 'all' && getHomeDesign() === 'v2') return <HomeV2 />;
  return <HomeClassic category={category} />;
};

export default HomePage;

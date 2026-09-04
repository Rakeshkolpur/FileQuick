// Homepage design switch. `v2` is the new landing page; `classic` is the
// original. Overridable per-browser during development — remove this whole file
// (and the classic homepage) once v2 is locked in.

const KEY = 'fq.homeDesign';
const DEFAULT = 'v2';

export const getHomeDesign = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'classic' || v === 'v2' ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
};

export const setHomeDesign = (v) => {
  try {
    if (v === DEFAULT) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
};

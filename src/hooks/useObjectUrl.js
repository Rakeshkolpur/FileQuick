import { useEffect, useState } from 'react';

/** Returns a stable object URL for a File/Blob and revokes it on change/unmount. */
export function useObjectUrl(source) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (!source) {
      setUrl(null);
      return undefined;
    }
    const next = URL.createObjectURL(source);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [source]);

  return url;
}

export default useObjectUrl;

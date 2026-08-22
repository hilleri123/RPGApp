import { useEffect, useState } from 'react';

export function useImageNaturalSize(src: string | null) {
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    if (!src) {
      setSize(null);
      return;
    }
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setSize(null);
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);
  return size;
}

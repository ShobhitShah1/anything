import { useState, useEffect } from 'react';

export function useColumnCount(): number {
  const [columnCount, setColumnCount] = useState<number>(() => {
    if (typeof window === 'undefined') return 3;
    const w = window.innerWidth;
    if (w < 640) return 1;
    if (w < 1024) return 2;
    return 3;
  });

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      let nextCount = 3;
      if (w < 640) nextCount = 1;
      else if (w < 1024) nextCount = 2;
      else nextCount = 3;

      setColumnCount((prev) => (prev !== nextCount ? nextCount : prev));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return columnCount;
}

import { useEffect, useState } from 'react';

function readDirection() {
  if (typeof document === 'undefined') return 'ltr';
  return document.documentElement.dir || document.body?.dir || getComputedStyle(document.documentElement).direction || 'ltr';
}

export function useDirection() {
  const [direction, setDirection] = useState(readDirection);

  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setDirection(readDirection()));
    observer.observe(root, { attributes: true, attributeFilter: ['dir'] });
    return () => observer.disconnect();
  }, []);

  return {
    direction,
    isRtl: direction === 'rtl',
    isLtr: direction !== 'rtl',
  };
}

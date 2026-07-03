import { useEffect } from 'react';
import { initSmoothScroll } from '@/lib/lenis';
import { ensureGsap } from '@/lib/gsap';

/**
 * Renders nothing — just wires up Lenis + GSAP ticker once on mount.
 * Mount this with client:load near the top of your layout.
 */
export default function SmoothScrollProvider() {
  useEffect(() => {
    ensureGsap();
    const lenis = initSmoothScroll();
    return () => {
      lenis?.destroy();
    };
  }, []);

  return null;
}

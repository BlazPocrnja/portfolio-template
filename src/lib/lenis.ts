import Lenis from 'lenis';
import { gsap, ScrollTrigger } from './gsap';

let lenis: Lenis | null = null;

/**
 * Creates (once) a Lenis instance and drives it from the GSAP ticker instead
 * of its own rAF loop, so Lenis and every GSAP/ScrollTrigger animation stay
 * perfectly in sync. Safe to call from multiple components; only the first
 * call does anything.
 */
export function initSmoothScroll() {
  if (typeof window === 'undefined' || lenis) return lenis;

  lenis = new Lenis({ lerp: 0.08, smoothWheel: true });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));

  return lenis;
}

export function getLenis() {
  return lenis;
}

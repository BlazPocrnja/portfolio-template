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

  // Keep scroll locked for as long as Preloader.tsx's intro curtain is
  // covering the screen. Checking its `data-intro` attribute here (instead
  // of having Preloader call `.stop()` itself once mounted) sidesteps a
  // hydration race: Preloader and this provider are separate client:load
  // islands with no guaranteed mount order, but `data-intro` is set
  // synchronously by Layout.astro's head script before either hydrates.
  if (document.documentElement.getAttribute('data-intro') === 'pending') {
    lenis.stop();
  }

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis?.raf(time * 1000));

  return lenis;
}

export function getLenis() {
  return lenis;
}

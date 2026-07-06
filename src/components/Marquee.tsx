import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import { getLenis } from '@/lib/lenis';

interface Props {
  text: string;
  speed?: number; // px per second
}

/**
 * Infinite ticker, doubling as a "scroll to top" button (the marquee copy
 * itself says as much). Two things that look simple about a marquee but
 * aren't:
 *
 * 1. The seamless-loop trick (slide by one copy's width, snap back, repeat)
 *    only stays seamless if enough copies are laid end-to-end to cover the
 *    bar's full width at every point in the slide — with just two short
 *    copies in a wide bar, there's a stretch of the animation where neither
 *    copy reaches edge-to-edge, which reads as the text "spawning" out of
 *    nowhere mid-bar instead of sliding continuously off it. Copy count is
 *    computed from the actual bar width instead of hardcoded.
 * 2. The distance/duration are calibrated against a *measured* copy width —
 *    if that measurement happens before the webfont finishes loading, it's
 *    measured against fallback-font metrics, and the loop desyncs the
 *    moment the real font swaps in and reflows the text. Waiting on
 *    `document.fonts.ready` first avoids that.
 */
export default function Marquee({ text, speed = 60 }: Props) {
  const wrapRef = useRef<HTMLButtonElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track) return;
    let cancelled = false;
    let tween: gsap.core.Tween | null = null;

    async function run() {
      // Reduced-motion fallback: the ticker text renders statically (first
      // copy visible, overflow clipped) and the scroll-to-top button still
      // works. Only reaches visitors with the OS-level "reduce motion"
      // setting — everyone else gets the full ticker.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

      if (document.fonts?.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // Font loading can reject in some environments — fall back to measuring whatever's rendered now.
        }
      }
      if (cancelled || !wrap || !track) return;

      const firstSpan = track.firstElementChild as HTMLElement | null;
      if (!firstSpan) return;
      const singleWidth = firstSpan.getBoundingClientRect().width;
      if (!singleWidth) return;

      const barWidth = wrap.getBoundingClientRect().width;
      const needed = Math.max(2, Math.ceil((barWidth * 2) / singleWidth) + 1);

      if (needed !== copies) {
        setCopies(needed);
        return; // re-render with the right copy count; this effect re-runs via the `copies` dependency
      }

      gsap.set(track, { x: 0 });
      tween = gsap.to(track, {
        x: -singleWidth,
        duration: singleWidth / speed,
        ease: 'none',
        repeat: -1,
      });
    }

    run();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(run, 150);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelled = true;
      tween?.kill();
      window.removeEventListener('resize', onResize);
      window.clearTimeout(resizeTimer);
    };
  }, [copies, speed]);

  const scrollToTop = () => {
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { duration: 1.4 });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button ref={wrapRef} type="button" className="marquee" onClick={scrollToTop} aria-label="Scroll to top">
      <div ref={trackRef} className="marquee-track">
        {Array.from({ length: copies }).map((_, i) => (
          <span key={i} aria-hidden={i > 0 || undefined}>
            {text}&nbsp;
          </span>
        ))}
      </div>
      <style>{`
        .marquee {
          display: block;
          width: 100%;
          overflow: hidden;
          white-space: nowrap;
          text-align: left;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 0.85rem 0;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .marquee:hover {
          background: var(--fg);
        }
        .marquee-track {
          display: inline-flex;
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: var(--fg-dim);
          transition: color 0.3s ease;
        }
        .marquee:hover .marquee-track {
          color: var(--bg);
        }
      `}</style>
    </button>
  );
}

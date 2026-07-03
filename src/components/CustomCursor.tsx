import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

const INTERACTIVE_SELECTOR = 'a, button, [role="button"], input, textarea, select, label, summary, .chr-hover';

/**
 * Small dot cursor that lags slightly behind the pointer via gsap.quickTo
 * (the same primitive the source site uses for its magnetic project-cursor),
 * growing into a ring over links/buttons so interactivity stays legible with
 * no native pointer/arrow ever showing. Automatically disabled on touch
 * devices.
 *
 * The dot is a fixed white with mix-blend-mode: difference — that combo is
 * what makes it "invert" whatever's underneath in both themes. Difference
 * blending is diff(cursor, background) channel-wise; using a theme-aware
 * color (e.g. var(--fg), which is near-black in light mode) would diff
 * near-black against the light theme's near-white page and land back near
 * white — i.e. the cursor would nearly vanish into a light background. A
 * constant white reference reliably inverts either theme.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    const setX = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3.out' });
    const setY = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3.out' });

    let pressed = false;
    let hovering = false;
    const applyScale = () => {
      gsap.to(dot, { scale: hovering ? 2.4 : pressed ? 0.7 : 1, duration: 0.25, ease: 'power3.out' });
    };

    const onMove = (e: MouseEvent) => {
      setX(e.clientX);
      setY(e.clientY);
    };

    const onDown = () => {
      pressed = true;
      applyScale();
    };
    const onUp = () => {
      pressed = false;
      applyScale();
    };

    const onOver = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest(INTERACTIVE_SELECTOR)) {
        hovering = true;
        applyScale();
      }
    };
    const onOut = (e: MouseEvent) => {
      if (!(e.target instanceof Element)) return;
      if (e.target.closest(INTERACTIVE_SELECTOR)) {
        hovering = false;
        applyScale();
      }
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('mouseover', onOver);
    window.addEventListener('mouseout', onOut);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('mouseover', onOver);
      window.removeEventListener('mouseout', onOut);
    };
  }, []);

  return (
    <div ref={dotRef} className="custom-cursor" aria-hidden="true">
      <style>{`
        .custom-cursor {
          position: fixed;
          top: 0;
          left: 0;
          width: 10px;
          height: 10px;
          margin: -5px 0 0 -5px;
          border-radius: 50%;
          background: #fff;
          pointer-events: none;
          z-index: 999;
          mix-blend-mode: difference;
        }
        @media (hover: none) {
          .custom-cursor { display: none; }
        }
      `}</style>
    </div>
  );
}

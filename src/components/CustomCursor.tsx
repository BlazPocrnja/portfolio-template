import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

/**
 * Small dot cursor that lags slightly behind the pointer via gsap.quickTo
 * (the same primitive the source site uses for its magnetic project-cursor).
 * Automatically disabled on touch devices.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(hover: none)').matches) return;

    const dot = dotRef.current;
    if (!dot) return;

    const setX = gsap.quickTo(dot, 'x', { duration: 0.35, ease: 'power3.out' });
    const setY = gsap.quickTo(dot, 'y', { duration: 0.35, ease: 'power3.out' });

    const onMove = (e: MouseEvent) => {
      setX(e.clientX);
      setY(e.clientY);
    };

    const onDown = () => gsap.to(dot, { scale: 0.7, duration: 0.2 });
    const onUp = () => gsap.to(dot, { scale: 1, duration: 0.2 });

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mousedown', onDown);
    window.addEventListener('mouseup', onUp);

    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('mouseup', onUp);
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
          background: var(--fg);
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

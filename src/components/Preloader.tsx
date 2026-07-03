import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';

/**
 * Full-screen intro that reveals the site name letter-by-letter, holds
 * briefly, then wipes away with a two-panel transition to expose the hero.
 * Skips itself entirely on repeat visits within the session and for users
 * who prefer reduced motion.
 */
export default function Preloader() {
  const rootRef = useRef<HTMLDivElement>(null);
  const panelDarkRef = useRef<HTMLDivElement>(null);
  const panelAccentRef = useRef<HTMLDivElement>(null);
  // Layout.astro's inline head script sets this synchronously, before first
  // paint, so a repeat visit never mounts (or paints) the curtain at all —
  // reading it here (instead of only deciding in an effect, which runs
  // after paint) skips the pointless extra render/GSAP setup to match.
  const [skip] = useState(
    () => typeof document !== 'undefined' && document.documentElement.getAttribute('data-intro') === 'skip'
  );

  useEffect(() => {
    if (skip) return;

    document.documentElement.style.overflow = 'hidden';

    const letters = rootRef.current?.querySelectorAll('.pre-letter');
    const tl = gsap.timeline({
      delay: 0.2,
      onComplete: () => {
        document.documentElement.style.overflow = '';
        sessionStorage.setItem('has-seen-intro', '1');
      },
    });

    tl.set(letters ?? [], { yPercent: 110 })
      .to(letters ?? [], {
        yPercent: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.035,
      })
      .to({}, { duration: 0.5 }) // hold
      .to(
        panelDarkRef.current,
        { yPercent: -100, duration: 0.8, ease: 'power3.inOut' },
        '+=0'
      )
      .to(
        panelAccentRef.current,
        { yPercent: -100, duration: 0.8, ease: 'power3.inOut' },
        '<0.08'
      )
      .to(
        rootRef.current,
        { autoAlpha: 0, duration: 0.2 },
        '<0.4'
      );

    return () => {
      tl.kill();
    };
  }, []);

  if (skip) return null;

  const name = 'Your Name.';

  return (
    <div ref={rootRef} className="preloader" aria-hidden="true">
      <div className="preloader-name">
        {name.split('').map((ch, i) => (
          <span className="pre-letter-wrap" key={i}>
            <span className="pre-letter">{ch === ' ' ? '\u00A0' : ch}</span>
          </span>
        ))}
      </div>
      <div ref={panelDarkRef} className="preloader-panel panel-dark" />
      <div ref={panelAccentRef} className="preloader-panel panel-accent" />

      <style>{`
        .preloader {
          position: fixed;
          inset: 0;
          z-index: 200;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg);
        }
        .preloader-name {
          position: relative;
          z-index: 3;
          display: flex;
          font-family: var(--font-display);
          font-size: clamp(2rem, 6vw, 4.5rem);
          font-weight: 700;
          letter-spacing: -0.005em;
          color: var(--fg);
        }
        .pre-letter-wrap {
          overflow: hidden;
          display: inline-block;
        }
        .pre-letter {
          display: inline-block;
          will-change: transform;
        }
        .preloader-panel {
          position: fixed;
          inset: 0;
          will-change: transform;
        }
        .panel-dark {
          background: var(--bg);
          z-index: 1;
        }
        .panel-accent {
          background: var(--accent);
          z-index: 2;
          mix-blend-mode: normal;
          opacity: 0.9;
        }
      `}</style>
    </div>
  );
}

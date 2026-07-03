import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';
import HoverLink from './HoverLink';

const SOCIALS = [
  { label: 'GitHub', href: 'https://github.com/your-handle' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/your-handle' },
  { label: 'Behance', href: 'https://behance.net/your-handle' },
];

const NAV = [
  { label: 'Work', href: '/work' },
  { label: 'Info', href: '/info' },
  { label: 'Contact', href: '/contact' },
];

export default function Hero() {
  const taglineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!taglineRef.current) return;
    gsap.fromTo(
      taglineRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 1, delay: 0.6, ease: 'power3.out' }
    );
  }, []);

  return (
    <section className="hero">
      {/*
        Placeholder for a hero canvas: the source site renders an
        interactive WebGL image-sequence / shader scene here. Drop your
        own Three.js / OGL / shader canvas into this div — it's already
        positioned to fill the hero behind the content.
      */}
      <div className="hero-canvas" aria-hidden="true">
        <div className="hero-canvas-placeholder">Hero canvas / WebGL slot</div>
      </div>

      <div className="hero-content">
        <div ref={taglineRef} className="hero-tagline">
          Quiet creator, <span className="other-accent">bringing ideas to life</span>,
          <br />
          through motion, detail and softness.
        </div>

        <div className="hero-line" />

        <div className="hero-bar">
          <div className="hero-bar-left">
            <HoverLink label="v1.0" />
          </div>
          <nav className="hero-bar-center" aria-label="Social links">
            {SOCIALS.map((s, i) => (
              <span key={s.label} style={{ display: 'flex', gap: '0.5em' }}>
                <a href={s.href} target="_blank" rel="noopener noreferrer">
                  <HoverLink label={s.label} />
                </a>
                {i < SOCIALS.length - 1 && <span className="sep">/</span>}
              </span>
            ))}
          </nav>
          <nav className="hero-bar-right" aria-label="Main navigation">
            {NAV.map((n) => (
              <a key={n.label} href={n.href}>
                <HoverLink label={n.label} />
              </a>
            ))}
          </nav>
        </div>
      </div>

      <style>{`
        .hero {
          position: relative;
          height: 100vh;
          min-height: 560px;
          display: flex;
          align-items: flex-end;
          overflow: hidden;
        }
        .hero-canvas {
          position: absolute;
          inset: 0;
          z-index: 0;
        }
        .hero-canvas-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: radial-gradient(circle at 50% 35%, var(--bg-elevated), var(--bg) 70%);
          color: var(--fg-dim);
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .hero-content {
          position: relative;
          z-index: 1;
          width: 100%;
          padding: var(--container-pad);
          padding-bottom: clamp(1.5rem, 4vw, 3rem);
        }
        .hero-tagline {
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3.4vw, 2.6rem);
          font-weight: 600;
          letter-spacing: -0.01em;
          max-width: 22ch;
          margin-bottom: 1.5rem;
        }
        .hero-line {
          height: 1px;
          background: var(--line);
          margin-bottom: 1rem;
        }
        .hero-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          flex-wrap: wrap;
          gap: 0.75rem;
        }
        .hero-bar-center {
          display: flex;
          gap: 0.5em;
        }
        .hero-bar-right {
          display: flex;
          gap: 1.5em;
        }
        .sep {
          color: var(--fg-dim);
        }
      `}</style>
    </section>
  );
}

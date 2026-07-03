import { useEffect, useRef, useState } from 'react';
import { gsap, ScrollTrigger, ensureGsap } from '@/lib/gsap';
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

const RING_COUNT = 10;
const RING_SPACING = 300; // px of depth between each ring's starting position
const FAR_START = -3200; // depth (px) the furthest-back ring starts at
const NEAR_END = 700; // depth a ring has reached (past the "camera") once fully flown by

/** Each ring starts staggered in depth so they arrive at the camera one after another across the scroll, not all at once. */
const RINGS = Array.from({ length: RING_COUNT }, (_, i) => ({
  startZ: FAR_START - i * RING_SPACING,
  size: 200 + i * 46,
  shape: i % 2 === 0 ? 'is-square' : 'is-circle',
}));

const TRAVEL = NEAR_END - (FAR_START - (RING_COUNT - 1) * RING_SPACING);
const CONTENT_FADE_END = 0.12; // hero tagline/name/nav are gone by this fraction of the flythrough

export default function Hero() {
  const taglineRef = useRef<HTMLDivElement>(null);
  const scrollWrapRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const ringRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [tallHero, setTallHero] = useState(true);

  useEffect(() => {
    if (!taglineRef.current) return;
    gsap.fromTo(
      taglineRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 1, delay: 0.6, ease: 'power3.out' }
    );
  }, []);

  useEffect(() => {
    setTallHero(!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);

  useEffect(() => {
    if (!tallHero) return;
    ensureGsap();
    const wrap = scrollWrapRef.current;
    const content = contentRef.current;
    if (!wrap || !content) return;

    const rings = ringRefs.current.filter((el): el is HTMLDivElement => el !== null);

    const trigger = ScrollTrigger.create({
      trigger: wrap,
      start: 'top top',
      end: 'bottom bottom',
      scrub: true,
      onUpdate: (self) => {
        const p = self.progress;

        rings.forEach((el, i) => {
          const startZ = RINGS[i].startZ;
          const z = startZ + p * TRAVEL;
          let op = Math.min(1, Math.max(0, (z - startZ) / 300)); // fade in as it approaches
          if (z > -150) op *= Math.max(0, 1 - (z + 150) / 500); // fade out once it passes the "camera"
          const spin = (i % 2 ? 1 : -1) * p * 30;
          el.style.transform = `translate3d(-50%, -50%, ${z.toFixed(1)}px) rotateZ(${spin.toFixed(2)}deg)`;
          el.style.opacity = op.toFixed(3);
        });

        const fadeP = Math.min(1, p / CONTENT_FADE_END);
        content.style.opacity = (1 - fadeP).toFixed(3);
        content.style.filter = fadeP > 0 ? `blur(${(fadeP * 6).toFixed(1)}px)` : 'none';
      },
    });

    return () => {
      trigger.kill();
    };
  }, [tallHero]);

  return (
    <div ref={scrollWrapRef} className={`hero-scroll-wrap${tallHero ? '' : ' is-compact'}`}>
      <section className="hero">
        {/*
          Placeholder "camera flythrough": a ring of CSS-3D shapes drift from
          far away toward the viewer as you scroll, then the section
          releases (it's just `position: sticky`) and the page continues
          normally. Swap `.hero-scene`'s contents for a real Three.js/OGL/
          WebGL canvas when you're ready — the scroll-progress wiring above
          stays the same, just drive your own camera/uniforms from `p`.
        */}
        <div className="hero-canvas" aria-hidden="true">
          <div className="hero-scene">
            <div className="hero-scene-glow" />
            {RINGS.map((ring, i) => (
              <div
                key={i}
                ref={(el) => {
                  ringRefs.current[i] = el;
                }}
                className={`hero-ring ${ring.shape}`}
                style={{ width: `${ring.size}px`, height: `${ring.size}px` }}
              />
            ))}
          </div>
        </div>

        <div ref={contentRef} className="hero-content">
          <div ref={taglineRef} className="hero-tagline">
            Quiet creator, <span className="other-accent">bringing ideas to life</span>,
            <br />
            through motion, detail and softness.
          </div>

          <div className="hero-bottom">
            <div className="hero-name">Your Name.</div>
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
        </div>
      </section>

      {/* dangerouslySetInnerHTML avoids a React SSR/hydration text-escaping mismatch for raw-text elements like <style> (this one trips it via the `>` in `.hero-content > *`) */}
      <style dangerouslySetInnerHTML={{ __html: `
        .hero-scroll-wrap {
          position: relative;
          height: 400vh;
        }
        .hero-scroll-wrap.is-compact {
          height: 100vh;
        }
        .hero {
          position: sticky;
          top: 0;
          height: 100vh;
          min-height: 560px;
          overflow: hidden;
        }
        .hero-scroll-wrap.is-compact .hero {
          position: relative;
        }
        .hero-canvas {
          position: absolute;
          inset: 0;
          z-index: 0;
          background: radial-gradient(circle at 50% 35%, var(--bg-elevated), var(--bg) 70%);
        }
        .hero-scene {
          position: absolute;
          inset: 0;
          perspective: 900px;
          overflow: hidden;
        }
        .hero-scene-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent) 30%, transparent), transparent 62%);
        }
        .hero-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          border: 1px solid var(--accent);
          opacity: 0;
          will-change: transform, opacity;
        }
        .hero-ring.is-circle {
          border-radius: 50%;
          border-color: var(--fg);
        }
        .hero-ring.is-square {
          border-radius: 10px;
        }
        .hero-content {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          will-change: opacity, filter;
        }
        .hero-content > * {
          pointer-events: auto;
        }
        .hero-tagline {
          position: absolute;
          top: var(--container-pad);
          left: var(--container-pad);
          font-family: var(--font-serif);
          font-style: italic;
          font-size: clamp(0.8rem, 1vw, 1rem);
          font-weight: 400;
          line-height: 1.6;
          letter-spacing: -0.005em;
          max-width: 26ch;
        }
        .hero-bottom {
          position: absolute;
          left: var(--container-pad);
          right: var(--container-pad);
          bottom: var(--container-pad);
        }
        .hero-name {
          font-family: var(--font-display);
          font-size: clamp(2.5rem, 9vw, 6.5rem);
          font-weight: 400;
          letter-spacing: -0.01em;
          line-height: 0.9;
          margin-bottom: clamp(1.5rem, 4vw, 3rem);
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
          font-family: var(--font-mono);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.03em;
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
        @media (max-width: 640px) {
          .hero-tagline {
            max-width: calc(100% - 2 * var(--container-pad));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-ring {
            display: none;
          }
        }
      ` }} />
    </div>
  );
}

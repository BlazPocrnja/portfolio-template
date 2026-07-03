import { useEffect, useRef } from 'react';
import { ScrollTrigger, ensureGsap } from '@/lib/gsap';
import { getLenis } from '@/lib/lenis';

interface SectionDef {
  id: string;
  label: string;
}

interface Props {
  sections: SectionDef[];
}

interface SegEntry {
  ratio: number;
  fill: HTMLDivElement;
  label: string;
}

/**
 * Fixed right-hand section indicator + left-hand scroll percentage readout.
 * Segments are sized proportionally to each section's height and fill in as
 * you scroll through it; clicking a segment jumps there via Lenis.
 */
export default function ScrollProgress({ sections }: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const pctRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureGsap();
    const bar = barRef.current;
    const label = labelRef.current;
    const pctEl = pctRef.current;
    const wrap = wrapRef.current;
    if (!bar || !label || !pctEl || !wrap || !sections.length) return;

    const found = sections
      .map((s) => ({ ...s, el: document.getElementById(s.id) }))
      .filter((s): s is SectionDef & { el: HTMLElement } => s.el !== null);
    if (!found.length) return;

    bar.innerHTML = '';

    const scrollY0 = window.scrollY || window.pageYOffset;
    const zoneTop = found[0].el.getBoundingClientRect().top + scrollY0;
    const lastEl = found[found.length - 1].el;
    const zoneBottom = lastEl.getBoundingClientRect().top + lastEl.offsetHeight + scrollY0;
    const zoneH = Math.max(1, zoneBottom - zoneTop);

    const segs: SegEntry[] = found.map((s) => {
      const ratio = s.el.offsetHeight / zoneH;
      const seg = document.createElement('div');
      seg.className = 'sp-seg';
      seg.style.flex = ratio.toFixed(4);
      seg.title = s.label;

      const fill = document.createElement('div');
      fill.className = 'sp-seg-fill';
      seg.appendChild(fill);
      bar.appendChild(seg);

      seg.addEventListener('click', () => {
        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(s.el, { offset: 0, duration: 1.2 });
        } else {
          s.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });

      return { ratio, fill, label: s.label };
    });

    const trigger = ScrollTrigger.create({
      trigger: found[0].el,
      start: 'top bottom',
      endTrigger: lastEl,
      end: 'bottom bottom',
      onUpdate: (self) => {
        const progress = self.progress;
        // Deliberately the same `progress` the segmented bar below fills
        // with — if this read from total document scroll instead, a long
        // intro (see Hero.tsx's scroll-jacked flythrough) would make the
        // two numbers disagree the moment this indicator appears: the
        // percentage would already be well past 0 (intro ate a big chunk
        // of the page) while the About segment reads as just-started.
        pctEl.textContent = `(${Math.round(progress * 100)})`;

        if (progress <= 0 || progress >= 0.95) {
          wrap.classList.remove('visible');
          pctEl.classList.remove('visible');
          return;
        }
        wrap.classList.add('visible');
        pctEl.classList.add('visible');

        let cumul = 0;
        let activeIdx = 0;
        for (let i = 0; i < segs.length; i++) {
          const seg = segs[i];
          const segStart = cumul;
          const segEnd = cumul + seg.ratio;
          if (progress < segEnd) {
            const inner = (progress - segStart) / seg.ratio;
            seg.fill.style.height = `${Math.min(1, Math.max(0, inner)) * 100}%`;
            activeIdx = i;
            for (let j = i + 1; j < segs.length; j++) segs[j].fill.style.height = '0%';
            break;
          }
          seg.fill.style.height = '100%';
          activeIdx = i;
          cumul = segEnd;
        }

        label.textContent = segs[activeIdx]?.label ?? '';
      },
    });

    return () => {
      trigger.kill();
      bar.innerHTML = '';
    };
  }, [sections]);

  return (
    <>
      <div ref={pctRef} className="scroll-pct" aria-hidden="true">(0)</div>
      <div ref={wrapRef} className="scroll-progress" aria-hidden="true">
        <span ref={labelRef} className="sp-label" />
        <div ref={barRef} className="sp-bar" />
      </div>
      {/* dangerouslySetInnerHTML avoids a React SSR/hydration text-escaping mismatch for raw-text elements like <style> */}
      <style dangerouslySetInnerHTML={{ __html: `
        .scroll-progress {
          position: fixed;
          right: 2rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 500;
          display: flex;
          flex-direction: column;
          align-items: center;
          height: 42vh;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.4s;
        }
        .scroll-progress.visible {
          opacity: 1;
        }
        .sp-label {
          position: absolute;
          right: 0;
          bottom: calc(100% + 10px);
          font-family: var(--font-mono);
          font-size: clamp(0.6rem, 0.85vw, 0.75rem);
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--fg);
          white-space: nowrap;
          text-align: right;
        }
        .sp-bar {
          position: relative;
          width: 2px;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sp-seg {
          flex: 1;
          position: relative;
          background: var(--line);
          cursor: pointer;
          pointer-events: auto;
          transform-origin: center;
          transition: transform 0.35s var(--ease-out);
        }
        .scroll-progress:not(.visible) .sp-seg {
          pointer-events: none;
        }
        .sp-seg:hover {
          transform: scaleX(3);
        }
        .sp-seg::before {
          content: '';
          position: absolute;
          inset: 0 -10px;
        }
        .sp-seg-fill {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 0%;
          background: var(--fg);
        }
        .scroll-pct {
          position: fixed;
          left: 2rem;
          top: 50%;
          transform: translateY(-50%);
          z-index: 500;
          font-family: var(--font-mono);
          font-size: clamp(0.65rem, 0.95vw, 0.8rem);
          letter-spacing: 0.03em;
          color: var(--fg);
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.4s;
        }
        .scroll-pct.visible {
          opacity: 1;
        }
        @media (max-width: 768px) {
          .scroll-progress,
          .scroll-pct {
            display: none;
          }
        }
      ` }} />
    </>
  );
}
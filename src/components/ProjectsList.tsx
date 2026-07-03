import { useEffect, useRef, useState } from 'react';
import { gsap } from '@/lib/gsap';
import type { Project } from '@/data/projects';
import HoverLink from './HoverLink';

interface Props {
  projects: Project[];
}

export default function ProjectsList({ projects }: Props) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<Project | null>(null);
  const quickX = useRef<((v: number) => void) | null>(null);
  const quickY = useRef<((v: number) => void) | null>(null);

  useEffect(() => {
    if (!previewRef.current) return;
    quickX.current = gsap.quickTo(previewRef.current, 'x', {
      duration: 0.5,
      ease: 'power3.out',
    });
    quickY.current = gsap.quickTo(previewRef.current, 'y', {
      duration: 0.5,
      ease: 'power3.out',
    });
  }, []);

  useEffect(() => {
    if (!previewRef.current) return;
    gsap.to(previewRef.current, {
      opacity: active ? 1 : 0,
      duration: active ? 0.4 : 0.25,
      ease: active ? 'power2.out' : 'power2.in',
    });
  }, [active]);

  const handleMove = (e: React.MouseEvent) => {
    quickX.current?.(e.clientX);
    quickY.current?.(e.clientY);
  };

  return (
    <div className="projects-list" onMouseMove={handleMove}>
      {projects.map((p) => (
        <a
          key={p.slug}
          href={`/work/${p.slug}`}
          className="proj-item"
          onMouseEnter={() => setActive(p)}
          onMouseLeave={() => setActive(null)}
        >
          <span className="proj-item-title">
            <HoverLink label={p.title} />
          </span>
          <span className="proj-item-date">{p.date}</span>
        </a>
      ))}

      <div ref={previewRef} className="proj-preview" aria-hidden="true">
        {active && (
          <div className="proj-card">
            <div className="proj-meta">
              <span>{active.date}</span>
              <span>Preview</span>
            </div>
            <img src={active.cover} alt="" width={480} height={360} loading="lazy" />
          </div>
        )}
      </div>

      <style>{`
        .projects-list {
          position: relative;
          border-top: 1px solid var(--line);
        }
        .proj-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1.1rem 0.25rem;
          border-bottom: 1px solid var(--line);
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 3.2vw, 2.1rem);
          font-weight: 400;
          transition: opacity 0.3s;
        }
        .projects-list:hover .proj-item {
          opacity: 0.35;
        }
        .proj-item:hover {
          opacity: 1 !important;
        }
        .proj-item-date {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--fg-dim);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .proj-preview {
          position: fixed;
          top: 0;
          left: 0;
          width: 220px;
          pointer-events: none;
          opacity: 0;
          z-index: 50;
          transform: translate(-50%, -50%);
        }
        .proj-card {
          background: var(--bg-elevated);
          border: 1px solid var(--line);
          overflow: hidden;
          border-radius: 4px;
        }
        .proj-meta {
          display: flex;
          justify-content: space-between;
          padding: 0.4rem 0.6rem;
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--fg-dim);
        }
        .proj-card img {
          width: 100%;
          aspect-ratio: 4 / 3;
          object-fit: cover;
        }
        @media (hover: none) {
          .proj-preview { display: none; }
        }
      `}</style>
    </div>
  );
}

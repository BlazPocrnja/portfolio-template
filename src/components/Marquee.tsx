import { useEffect, useRef } from 'react';
import { gsap } from '@/lib/gsap';

interface Props {
  text: string;
  speed?: number; // px per second
}

export default function Marquee({ text, speed = 60 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const width = track.scrollWidth / 2;
    const tween = gsap.to(track, {
      x: -width,
      duration: width / speed,
      ease: 'none',
      repeat: -1,
    });

    return () => {
      tween.kill();
    };
  }, [speed]);

  return (
    <div className="marquee">
      <div ref={trackRef} className="marquee-track">
        <span>{text}&nbsp;</span>
        <span aria-hidden="true">{text}&nbsp;</span>
      </div>
      <style>{`
        .marquee {
          overflow: hidden;
          white-space: nowrap;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 0.6rem 0;
        }
        .marquee-track {
          display: inline-flex;
          font-size: 0.8rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--fg-dim);
        }
      `}</style>
    </div>
  );
}

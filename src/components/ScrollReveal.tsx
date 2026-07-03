import { useEffect, useRef, type ReactNode, type JSX } from 'react';
import { gsap, ScrollTrigger, ensureGsap } from '@/lib/gsap';

interface Props {
  children: ReactNode;
  className?: string;
  as?: keyof JSX.IntrinsicElements;
  y?: number;
  delay?: number;
}

/**
 * Fades + un-blurs an element in as it enters the viewport. This is the
 * same "opacity 0 + filter: blur() -> 1 / blur(0)" idiom the source site
 * uses repeatedly (about text, photo, project cards, etc.), generalized
 * into one drop-in wrapper.
 */
export default function ScrollReveal({
  children,
  className,
  as = 'div',
  y = 24,
  delay = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureGsap();
    const el = ref.current;
    if (!el) return;

    const reducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    if (reducedMotion) {
      gsap.set(el, { opacity: 1, y: 0, filter: 'blur(0px)' });
      return;
    }

    gsap.set(el, { opacity: 0, y, filter: 'blur(12px)' });

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      once: true,
      onEnter: () => {
        gsap.to(el, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 1,
          delay,
          ease: 'power3.out',
        });
      },
    });

    return () => trigger.kill();
  }, [y, delay]);

  const Tag = as as any;
  return (
    <Tag ref={ref} className={className}>
      {children}
    </Tag>
  );
}

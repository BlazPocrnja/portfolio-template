import { useEffect, useState } from 'react';
import HoverLink from './HoverLink';

type Theme = 'dark' | 'light';

function readTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

/**
 * Toggles [data-theme] on <html> between 'dark' (this template's native
 * look) and 'light', persisting the choice to localStorage. The actual
 * color values live entirely in the CSS custom properties in global.css
 * (:root vs :root[data-theme="light"]) — this component just flips the
 * attribute. See the inline anti-flash script in Layout.astro, which sets
 * the attribute before first paint so there's no flash of the wrong theme.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    setTheme(readTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'light' ? '#f7f6f3' : '#0a0a0a');
    document.getElementById('favicon')?.setAttribute('href', next === 'light' ? '/favicon-light.svg' : '/favicon.svg');
    try {
      localStorage.setItem('theme', next);
    } catch {
      // localStorage can throw in private-browsing/sandboxed contexts — theme just won't persist.
    }
  };

  return (
    <button
      type="button"
      className="theme-toggle chr-hover"
      onClick={toggle}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <HoverLink label={theme === 'dark' ? 'Light' : 'Dark'} />
      <style>{`
        .theme-toggle {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          z-index: var(--z-chrome);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 0.5em 0.9em;
          border: 1px solid var(--line);
          border-radius: 50px;
          background: var(--bg);
        }
        /* Overrides the shared .chr-hover::before hit-area (global.css) with a
           more generous one: this button sits alone in the corner with no
           neighboring control, so unlike Footer's stacked nav there's no
           adjacent tap zone it could collide with. Brings it up to the
           WCAG 2.2 44px touch-target guideline without growing the visible
           pill DESIGN.md documents at 0.5em/0.9em padding. */
        .theme-toggle::before {
          content: '';
          position: absolute;
          inset: -8px -4px;
        }
      `}</style>
    </button>
  );
}

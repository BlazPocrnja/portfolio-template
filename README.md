# Creative Developer Portfolio — Astro + React + GSAP starter

## What's in here

| Technique in the reference site | Where it lives here |
|---|---|
| Preloader name-reveal + panel wipe | `src/components/Preloader.tsx` |
| Lenis synced to the GSAP ticker | `src/lib/lenis.ts` |
| `gsap.quickTo` magnetic cursor | `src/components/CustomCursor.tsx` |
| `gsap.quickTo` project hover-preview card | `src/components/ProjectsList.tsx` |
| Scroll-scrubbed blur/opacity reveals | `src/components/ScrollReveal.tsx` |
| Custom WebGL hero canvas | `src/components/Hero.tsx` — left as a plain
  placeholder `<div>`. Drop your own Three.js/OGL/raw-WebGL scene in there. |
| Footer ticker / ASCII strip | `src/components/Marquee.tsx` (plain text
  ticker — swap in ASCII art or anything else) |
| Project detail pages | `src/pages/work/[slug].astro` + `src/data/projects.ts` |

## Getting started

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
npm run preview
```

## Customizing

- **Content & branding**: everything under "Your Name" / `you@example.com`
  is a placeholder — search the `src/` folder for `Your Name` and swap it.
- **Projects**: edit `src/data/projects.ts`. Each entry auto-generates a
  `/work/[slug]` detail page via `getStaticPaths`.
- **Images**: currently pulled from `picsum.photos` as placeholders. Put
  real assets in `public/images/...` and update the paths in
  `src/data/projects.ts` and the `<img>` tags in `AboutSection.astro` /
  `ContactSection.astro`.
- **Fonts**: `--font-display` in `src/styles/global.css` currently falls
  back to Inter. Drop a display/serif webfont into `public/fonts/` and
  `@font-face` it there for a more distinctive heading typeface.
- **Colors**: theme tokens (`--bg`, `--fg`, `--accent`, etc.) live at the
  top of `src/styles/global.css`.
- **Hero canvas**: `Hero.tsx` has a clearly marked placeholder `div` where
  you can mount your own WebGL/Three.js scene as a client-side effect.

## Notes on the animation system

- `src/lib/gsap.ts` registers `ScrollTrigger` once, guarded so multiple
  islands can import it safely.
- `src/lib/lenis.ts` creates a single Lenis instance and drives it from
  `gsap.ticker` (instead of Lenis's own rAF loop) so scroll and GSAP
  animations never drift out of sync — this mirrors the pattern used by
  most GSAP+Lenis creative sites.
- `ScrollReveal.tsx` is a generic wrapper for the "fade up + un-blur on
  scroll" effect used throughout the reference site — reuse it anywhere
  instead of writing bespoke ScrollTrigger code per section.
- All animations respect `prefers-reduced-motion`.

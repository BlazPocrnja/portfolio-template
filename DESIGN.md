---
name: Creative Developer Portfolio
description: A studio-flythrough portfolio for an engineer-artist, dark and flat by default, driven by aggressive display type and scroll-scrubbed motion.
colors:
  bg: "#0a0a0a"
  bg-elevated: "#141414"
  fg: "#f2f0ec"
  fg-dim: "#8a8a86"
  studio-red: "#ff3b14"
  line: "rgba(242, 240, 236, 0.14)"
  bg-light: "#f7f6f3"
  bg-elevated-light: "#e9e7e2"
  fg-light: "#10131a"
  fg-dim-light: "#5b5f6b"
  studio-blue: "#155dfc"
  line-light: "rgba(16, 19, 26, 0.12)"
typography:
  display:
    fontFamily: "'Druk Wide', 'Archivo Black', sans-serif"
    fontSize: "clamp(2.5rem, 9vw, 6.5rem)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "0"
  serif:
    fontFamily: "'Austin', Georgia, serif"
    fontSize: "clamp(1.6rem, 3.2vw, 2.6rem)"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "'Graphik', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "'IBM Plex Mono', 'Consolas', monospace"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.03em"
rounded:
  none: "0px"
  sm: "4px"
  pill: "50px"
spacing:
  container: "clamp(1.25rem, 4vw, 3rem)"
  container-desktop: "clamp(4.5rem, 6vw, 6.5rem)"
components:
  theme-toggle:
    backgroundColor: "{colors.bg}"
    textColor: "{colors.fg}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "0.5em 0.9em"
  proj-item:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    typography: "{typography.display}"
    padding: "1.1rem 0.25rem"
  proj-card:
    backgroundColor: "{colors.bg-elevated}"
    textColor: "{colors.fg-dim}"
    rounded: "{rounded.sm}"
---

# Design System: Creative Developer Portfolio

## 1. Overview

**Creative North Star: "The Studio Flythrough"**

The site opens with a literal camera flythrough — a shadow-play lightbox diorama the camera dollies into as they scroll — and that move sets the terms for everything after it: this is a studio you move *through*, not a brochure you skim. The base is near-black, flat, and unapologetic; type does the shouting (Druk Wide at 900 weight, filling the viewport) while the interface chrome stays deliberately minimal — hairline borders, mono labels, no shadows, no cards-as-default. Depth is real (3D transforms, scroll-scrubbed blur) rather than faked with drop-shadows.

This system explicitly rejects the sterile corporate/agency look and the generic dev-portfolio template (uniform card grids, gradient text, bento layouts, tracked-uppercase eyebrows used as decoration). It also refuses to treat any part of the practice — engineering or fine art — as a decorative aside; both get the same full-bleed, large-type treatment.

**Key Characteristics:**
- Near-black flat base, no shadows — depth from hairline borders and real 3D transforms only
- Four-role type system, each role locked to a register (display = names/wordmarks, serif = editorial voice, sans = body copy, mono = technical/nav/label)
- One accent color used sparingly (rings, italics, selection, hover glow) — never as a fill
- Motion is choreographed and scroll-scrubbed (GSAP + Lenis), not just hover-state feedback
- Rough-cut, borderless controls (list rows, underline links, one pill toggle) instead of card/button chrome

## 2. Colors

Two full theme sets (dark native, light alternate), each with one neutral ramp and a single accent — restrained color strategy, all expression carried by type and motion instead.

### Primary
- **Studio Red** (`#ff3b14`, dark theme) / **Studio Blue** (`#155dfc`, light theme): the one accent. Used only for the hero's ring glow, italicized emphasis words (`.other-accent`), and text selection — never as a background fill or a button color. Its rarity is the point.

### Neutral
- **Void** (`#0a0a0a`, dark) / **Paper** (`#f7f6f3`, light) — page background.
- **Elevated Void** (`#141414`, dark) / **Elevated Paper** (`#e9e7e2`, light) — the one step up in the tonal stack, used for the project-preview card and any surface that needs to read as "above" the page.
- **Bone** (`#f2f0ec`, dark-theme foreground) / **Ink** (`#10131a`, light-theme foreground) — primary text.
- **Dim Bone** (`#8a8a86`, dark) / **Dim Ink** (`#5b5f6b`, light) — secondary text: sub-copy, dates, meta labels.
- **Hairline** (`rgba(242,240,236,0.14)` dark / `rgba(16,19,26,0.12)` light) — the only border/divider color in the system.

### Named Rules
**The One Voice Rule.** Studio Red/Blue never fills a surface and never colors a button. It marks a single word, a hover state, or a scroll-driven glow — nothing structural.

## 3. Typography

**Display Font:** Druk Wide (with Archivo Black, sans-serif fallback)
**Serif Font:** Austin (with Georgia fallback)
**Body Font:** Graphik (with system-ui, sans-serif fallback)
**Label/Mono Font:** IBM Plex Mono (with Consolas fallback)

**Character:** An ultra-wide condensed display face collides with an editorial serif and a technical mono — the pairing is the brand. Nothing in between (no "safe" mid-weight sans headline); the contrast between shout (display), voice (serif), and readout (mono) is deliberate.

### Hierarchy
- **Display** (900 or 700 only — Druk Wide ships no 400 weight, so nothing on this role may render at regular weight — `clamp(2.5rem, 9vw, 6.5rem)`, line-height 0.9): hero name, footer name, section titles, contact title. Reserved for one or two words at a time.
- **Serif/Editorial** (400, `clamp(1.6rem, 3.2vw, 2.6rem)`, line-height 1.3): hero tagline, About section lede — the "voice" register, always paired with `.other-accent` italic emphasis.
- **Body** (400, 16px, line-height 1.4, max ~46ch): About/Contact sub-copy and any long-form prose.
- **Label/Mono** (500, 0.7–0.85rem, uppercase, letter-spacing 0.03–0.06em): nav links, social links, project dates, theme toggle, footer columns — the technical/meta register. Always uppercase, always tracked.

### Named Rules
**The No-Regular-Display Rule.** `--font-display` is set to 700 or 900 only, never 400 — Druk Wide has no regular weight, and a lighter synthetic-bold render is worse than picking one of the two real weights.

## 4. Elevation

**The Flat-by-Default Rule.** There are no `box-shadow`s anywhere in this system. Depth is conveyed two ways only: a one-step tonal shift (`--bg` → `--bg-elevated`) for anything that needs to read as "above" the page (the project-preview card), and real 3D transforms (`perspective`, `translate3d`, `rotateZ`) in the hero scene. A hairline border (`--line`) marks a boundary; nothing is ever lifted with a shadow.

### Shadow Vocabulary
None. If a future component seems to need one, prefer a tonal-background shift or a hairline border first.

## 5. Components

Character in one phrase: **rough-cut and confident** — controls look utilitarian and slightly unfinished on purpose (borderless list rows, hairline dividers, one pill-shaped toggle), never polished into generic SaaS chrome.

### Buttons
- **Shape:** effectively borderless; the only true "button" chrome in the system is the pill-shaped theme toggle (`border-radius: 50px`).
- **Theme toggle (primary control):** `background: var(--bg)`, 1px `var(--line)` border, mono label, `0.5em 0.9em` padding, fixed top-right, uses the `.chr-hover` character-roll interaction on its label instead of a color/background hover change.
- **Text links (About "more about me", Contact email):** no button chrome at all — an underline (`border-bottom: 1px solid var(--fg)`) is the entire affordance.

### Character-Hover Links (signature component)
Every nav/social/meta label (`HoverLink.tsx`, `.chr-hover`) is built from stacked top/bottom copies of each character that roll upward on hover, staggered per-character via a `--i` custom property so the whole label cascades rather than flipping as one block (`0.6s cubic-bezier(0.87,0,0.13,1)`, `28ms` stagger). This is the primary interactive-text pattern across nav, socials, footer, and the project list — prefer it over a plain color-change hover for any short label.

### Cards / Containers
- **Corner style:** `4px` radius (`--rounded.sm`) — the only rounded surfaces in the system (project-preview card, about-photo crop). Everything else is square.
- **Background:** `var(--bg-elevated)` only; never the page background at a second tier.
- **Shadow strategy:** none (see Elevation). Boundary is a 1px `var(--line)` border only.
- **Note:** cards are the exception, not the default. The project list itself is borderless rows (see below), not a card grid — reach for a card only when previewing an image, never for plain text content.

### Lists / Rows (primary content pattern)
- **Project list (`proj-item`):** full-width rows separated by hairline top/bottom borders, display-font title + mono-font date, no background, no radius. On hover, the whole list dims to 35% opacity except the hovered row (`opacity: 1`) — a group-hover pattern, not per-item elevation.
- **Project preview:** a small fixed-position `bg-elevated` card (220px, 4px radius, hairline border) that follows the cursor via `gsap.quickTo` while a row is hovered.

### Navigation
- Mono-font, uppercase, tracked labels throughout (hero bar, footer columns). No visible active/current-page state beyond the character-hover interaction. Mobile: `flex-wrap` rather than a hamburger/drawer pattern — nav items simply wrap.

### Hero Scene — "The Shadow Box" (signature component)
A screen translation of a physical laser-cut lightbox: a hairline proscenium frame (with triangle-notched side rails echoing the real box's cut border) holds stacked engraving layers at real CSS depths — lit interior panel, punched-star sky, brain, cloud frieze, checkerboard floor, devil and cockatrice, two reaching hands. Scrolling dollies the camera through the frame and past each layer via `perspective` + `translate3d`, driven by GSAP ScrollTrigger scrub; each layer fades as it passes the camera, ending in the brain/glow. The artwork ships as black-on-transparent PNGs in `public/hero/` applied as CSS alpha masks colored with theme tokens, so both themes (night shadow-play in dark, paper-theatre matinee in light) come free — swap any PNG to change the cast. Idle life (candle-flicker on the glow, slow breathing on the figures) animates inner elements only, never the dolly transforms. Content (name, tagline, nav) fades and blurs out over the first 12% of scroll progress. Respects `prefers-reduced-motion` by collapsing to a static 100vh section showing the composed scene with idle animations off.

## 6. Do's and Don'ts

### Do:
- **Do** keep Studio Red/Blue to single words, hover glows, and selection — never a fill or a button background (**The One Voice Rule**).
- **Do** use the character-hover roll (`.chr-hover`) for short interactive labels (nav, socials, meta) instead of a plain color-change hover.
- **Do** convey depth with a tonal background shift (`--bg` → `--bg-elevated`) or a hairline `--line` border — never a `box-shadow` (**The Flat-by-Default Rule**).
- **Do** set `--font-display` to 700 or 900 only; Druk Wide has no 400 weight (**The No-Regular-Display Rule**).
- **Do** honor `prefers-reduced-motion` on every scroll-scrubbed or choreographed animation, matching the existing hero/ScrollReveal pattern. The default experience keeps full motion — the fallback only reaches visitors who opted in at the OS level.

### Don't:
- **Don't** default to card grids for content that isn't previewing an image — the project list is borderless rows on purpose, not a card grid (avoids the "generic dev-portfolio template" anti-reference from PRODUCT.md).
- **Don't** add drop-shadows, glassmorphism, or any lifted/glowing surface treatment — this system is flat by doctrine, not by omission.
- **Don't** use gradient text, tiny tracked uppercase "eyebrows" above every section, or numbered section markers (01/02/03) as decoration — named directly in PRODUCT.md's anti-references.
- **Don't** let the fine-art side of the portfolio read as a smaller or secondary section — same display-type scale and full-bleed treatment as the engineering work.
- **Don't** soften the palette toward a "safe" corporate look (muted pastels, rounded-everything, generic SaaS blue) — PRODUCT.md calls explicitly for bold/experimental intensity over polish-as-safety.

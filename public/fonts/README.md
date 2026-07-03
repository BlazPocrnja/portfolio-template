# Drop-in fonts

Put your own font files here (`.woff2` preferred, `.woff`/`.otf`/`.ttf` also
work) and wire them up in `src/styles/fonts.css` — that file already has
commented-out `@font-face` blocks ready to uncomment and point at your
filenames. Then update the `--font-display` / `--font-sans` values in
`src/styles/global.css` to use your font's `font-family` name.

Example:

1. Drop `Breton.woff2` in this folder.
2. In `src/styles/fonts.css`, uncomment the `@font-face` block for
   `--font-display` and set `src: url('/fonts/Breton.woff2') format('woff2');`.
3. In `src/styles/global.css`, set `--font-display: 'Breton', 'Space Grotesk', system-ui, sans-serif;`.

No build step or import wiring needed beyond that — `fonts.css` is already
imported from `global.css`.

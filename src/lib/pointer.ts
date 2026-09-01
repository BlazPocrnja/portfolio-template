/**
 * Pointer routing for the hero's stacked canvas layers.
 *
 * Every layer's art is a silhouette on a transparent field, but a <canvas>
 * hit-tests as its BOX — so with `pointer-events: auto` the nearest rectangle
 * takes the cursor outright, whatever is or isn't drawn in it. Measured on
 * the shipped scene at 1440x900: the clouds panel (z -770, 96% wide) owned
 * the entire top half of the brain's box (z -890) and the cockatrice owned
 * its bottom-right corner, so the brain's hover response simply did not
 * exist up there — the cursor was never reaching it.
 *
 * So the hero canvases stop hit-testing at all (`pointer-events: none`, set
 * in HeroAsciiArt) and each layer watches the window instead, deciding for
 * itself whether the cursor is over it — over its ART, not merely its box;
 * see the `inked` gate each renderer passes in. A stack of transparent
 * sheets is exactly the case the browser's one-winner hit test can't
 * express, and this is the smallest thing that can.
 *
 * The coordinates handed back are the element's OWN layout px, which is the
 * space every renderer's buffer, cell metrics and grain are expressed in,
 * and what `offsetX`/`offsetY` used to supply. They can't come from the
 * client rect directly: each layer is laid out oversized and scaled back
 * down by the stage's perspective, so its on-screen box is a projection of
 * its layout box (the brain: 331px on screen, 731px in layout). Normalising
 * through the rect's own size and scaling by clientWidth/Height crosses that
 * gap without anyone having to unpick the transform.
 *
 * Known limit: for a ROTATED layer (the hands) the client rect is the
 * axis-aligned bounds of the turned box, so the mapping skews by the few
 * degrees of rotation and the corners of the rect read as inside when they
 * are just outside. offsetX was exact about this. At 4-6deg on a patch a few
 * cells across it is not visible, and it is the price of being reachable.
 */

export interface PointerWatchHandlers {
  /** Cursor is over this element: x, y in its own layout px. */
  move(x: number, y: number): void;
  /** Cursor left this element (or the document). */
  leave(): void;
}

export function watchPointer(el: HTMLElement, handlers: PointerWatchHandlers) {
  let inside = false;
  let raf = 0;
  let lastX = 0;
  let lastY = 0;

  function exit() {
    if (!inside) return;
    inside = false;
    handlers.leave();
  }

  /* The rect read is deferred to a frame rather than done per event, and
     that is a real cost, not tidiness. getBoundingClientRect forces layout,
     the rect genuinely moves (the dolly is rewriting every layer's transform
     while you scroll) so it cannot be cached, and EIGHT canvases watch the
     window independently. A high-polling-rate mouse delivers well over a
     dozen pointermove events per frame, so a circular sweep across the scene
     was asking for a hundred-plus forced layouts per frame — interleaved
     with the hero's own per-frame perspective-origin write, which dirties
     the very layout being measured. That read/write ping-pong is what turns
     an already-tight compositor budget into dropped tiles.
     Coalescing pins it at one read per canvas per frame. The cost is that a
     move is acted on up to one frame late, which is where every renderer
     was going to draw it anyway. */
  function sample() {
    raf = 0;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      exit();
      return;
    }
    const nx = (lastX - rect.left) / rect.width;
    const ny = (lastY - rect.top) / rect.height;
    if (nx < 0 || nx > 1 || ny < 0 || ny > 1) {
      exit();
      return;
    }
    inside = true;
    handlers.move(nx * el.clientWidth, ny * el.clientHeight);
  }

  function onMove(e: PointerEvent) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (!raf) raf = requestAnimationFrame(sample);
  }

  /** relatedTarget null means the pointer left the document itself — moving
   * between elements inside it is already covered by the rect test above. */
  function onOut(e: PointerEvent) {
    if (!e.relatedTarget) exit();
  }

  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerout', onOut, { passive: true });

  return () => {
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerout', onOut);
    if (raf) cancelAnimationFrame(raf);
  };
}

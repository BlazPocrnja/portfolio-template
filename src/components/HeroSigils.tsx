import { useEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The engraved cartouches — the plate's ornament, and the vocabulary its
 * margins are written in.
 *
 * A cartouche is one framed cell holding one figure: a ring, a hexagram, a
 * circuit junction, a read-out. They come from the head-band of an esoteric
 * plate, where a sequence of sigils runs across the top of the drawing, and
 * they are here for the same reason: to give the composition something to
 * say in the places a picture would be wasted.
 *
 * ONE implementation, three shapes. `axis` lays the cells down a column or
 * across a band; a single-unit plate is one big cartouche on its own. That
 * matters to the composition more than it does to the code — the reference
 * sheets never run one cell size anywhere, and having the column, the band
 * and the solitary cell all come off the same alphabet is what stops that
 * variety reading as three different decorations.
 *
 * Two rules hold across all three:
 *
 * NOT A REPEATING TILE. Cells are drawn once at the size the panel actually
 * is, from a seeded bag-draw that exhausts the pool before repeating
 * anything — so no figure recurs inside a panel, and no two neighbours
 * match. A border that visibly loops is trim.
 *
 * NOT ONE CADENCE. Some slots break into a pair of half-length BANDS — a
 * read-out, a braid, a rule of ticks — against the full figures. Splitting a
 * slot keeps the arithmetic exact, so a panel still ends flush with its own
 * edge at any size.
 *
 * Everything is hairline stroke in the panel's own currentColor, with
 * vector-effect: non-scaling-stroke so a mark stays a true hairline whatever
 * the panel's size. Flat, per the house rule: no fill but the odd dot, no
 * shadow, no gradient.
 */

/** User units across a panel. Everything else is derived from it, including
 * the cell's extent along the axis — which is NOT this, see `run`. */
const CELL = 40;

/** One shuffled order of the alphabet, shared by every panel on the sheet.
 * Panels take disjoint runs out of it via `skip`, so a figure that appears in
 * the band cannot also turn up in the column — cartouches repeating between
 * panels is the fastest way to make a set of them look generated. */
const PAGE_SEED = 1607;

/** How much bigger than the panel's cross-axis a cell wants to be. 1 makes a
 * cell square-ish, which is the cadence the sheet is set at; raising it
 * trades cartouches for size. */
const DENSITY = 1;
/** Margin inside a cell before its figure starts. */
const PAD = 5.5;
/** Cross-axis centre, the one constant every figure shares. */
const C = CELL / 2;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- the figures ------------------------------------------------------
 *
 * Each draws inside one cell's own space: 0..CELL across, 0..h down, origin
 * at the cell's top-left (the caller translates). They take their centre and
 * radius FROM the cell rather than computing one, so a figure is the same
 * drawing whether it sits in a full cell or a band, and everything in the
 * column shares a centre line. Built from primitives rather than traced, so
 * the column reads as one plate instead of a scrapbook.
 *
 * `rng` is only for the figures that WANT to differ between appearances — a
 * read-out has no canonical arrangement, a hexagram does.
 */

interface Cell {
  /** Cell size in user units. */
  w: number;
  h: number;
  /** Centre. A figure reads these rather than assuming its cell is square,
   * which is what lets one drawing serve a column cell and a band cell. */
  cx: number;
  cy: number;
  /** Radius the figure is drawn to — the cell's short side, less the pad. */
  r: number;
}

type Sigil = (cell: Cell, rng: () => number, clipId: string) => ReactNode;

/* ---- full-height figures ---- */

/** Concentric rings with a filled centre — the plainest mark in the set, and
 * the one that keeps the column from becoming a parade of novelties. */
const rings: Sigil = ({ cy, r }) => (
  <>
    <circle cx={C} cy={cy} r={r} />
    <circle cx={C} cy={cy} r={r * 0.66} />
    <circle cx={C} cy={cy} r={r * 0.32} />
    <circle cx={C} cy={cy} r={0.9} fill="currentColor" stroke="none" />
  </>
);

/** Two interlocking triangles in a circle. */
const hexagram: Sigil = ({ cy, r }) => {
  const pts = (offset: number) =>
    [0, 1, 2]
      .map((i) => {
        const a = offset + (i * 2 * Math.PI) / 3;
        return `${(C + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
      })
      .join(' ');
  return (
    <>
      <circle cx={C} cy={cy} r={r} />
      <polygon points={pts(0)} />
      <polygon points={pts(Math.PI)} />
    </>
  );
};

/** Vesica piscis: the two circles whose overlap is the almond. */
const vesica: Sigil = ({ cy, r }) => (
  <>
    <circle cx={C - r * 0.42} cy={cy} r={r * 0.78} />
    <circle cx={C + r * 0.42} cy={cy} r={r * 0.78} />
    <line x1={C} y1={cy - r} x2={C} y2={cy + r} />
  </>
);

/** A square and the same square turned 45 — the eight-pointed star of the
 * plate borders, drawn as its two halves rather than as an outline. */
const octagram: Sigil = ({ cy, r }) => {
  const s = r * 0.72;
  return (
    <>
      <circle cx={C} cy={cy} r={r} />
      <rect x={C - s} y={cy - s} width={s * 2} height={s * 2} />
      <rect x={C - s} y={cy - s} width={s * 2} height={s * 2} transform={`rotate(45 ${C} ${cy})`} />
    </>
  );
};

/** A radiant: spokes struck from an inner circle out to the rim. The hero's
 * own halo, reduced to a mark. */
const radiant: Sigil = ({ cy, r }) => {
  const spokes = 16;
  const inner = r * 0.36;
  return (
    <>
      <circle cx={C} cy={cy} r={inner} />
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i * 2 * Math.PI) / spokes;
        return (
          <line
            key={i}
            x1={(C + inner * Math.sin(a)).toFixed(2)}
            y1={(cy - inner * Math.cos(a)).toFixed(2)}
            x2={(C + r * Math.sin(a)).toFixed(2)}
            y2={(cy - r * Math.cos(a)).toFixed(2)}
          />
        );
      })}
    </>
  );
};

/** A circuit junction: a spine with breakouts to terminal pads. The one
 * figure in the set that is machine rather than temple, which is the whole
 * reason for putting it beside them.
 *
 * The spine runs the full cell, always — it is what joins this cartouche to
 * the ones above and below, so the column reads as a board rather than as a
 * figure that happens to be a circuit. Only the breakouts vary; rolling all
 * four arms independently, as this first did, regularly left a lone stub
 * hanging off the node, which reads as a mistake rather than as a trace
 * going somewhere. */
const junction: Sigil = ({ h, cy, r }, rng) => {
  const side = rng() > 0.5 ? 1 : -1;
  const second = rng() > 0.4;
  const edge = (s: number) => C + s * (C - 1.5);
  const breakout = (s: number, y: number) => {
    const bend = C + s * r * 0.52;
    const run = y - r * 0.4;
    return (
      <g key={`${s}-${y}`}>
        <line x1={C} y1={y} x2={bend} y2={y} />
        <line x1={bend} y1={y} x2={bend} y2={run} />
        <line x1={bend} y1={run} x2={edge(s)} y2={run} />
        <rect x={s < 0 ? edge(s) : edge(s) - 2.6} y={run - 1.5} width={2.6} height={3} />
      </g>
    );
  };
  return (
    <>
      <line x1={C} y1={1.5} x2={C} y2={h - 1.5} />
      {breakout(side, cy + r * 0.52)}
      {second && breakout(-side, cy - r * 0.2)}
      <circle cx={C} cy={cy} r={r * 0.32} />
      <circle cx={C} cy={cy} r={1.1} fill="currentColor" stroke="none" />
      <circle cx={C} cy={cy + r * 0.52} r={1.5} />
      <circle cx={C} cy={cy - r * 0.76} r={1.5} />
    </>
  );
};

/** A lattice of points — the dotted fields the plates use to hold a corner
 * without drawing anything in it. */
const lattice: Sigil = ({ cy, r }) => {
  const n = 5;
  const step = (r * 2) / (n - 1);
  const dots: ReactNode[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      dots.push(
        <circle
          key={`${x}-${y}`}
          cx={(C - r + x * step).toFixed(2)}
          cy={(cy - r + y * step).toFixed(2)}
          r={0.75}
          fill="currentColor"
          stroke="none"
        />
      );
    }
  }
  return <>{dots}</>;
};

/** Seven circles on a hexagonal centre — the flower, cut back to its own rim
 * so it sits in the cell as a disc rather than as a bouquet. */
const flower: Sigil = ({ cy, r }, _rng, clipId) => {
  const s = r * 0.5;
  return (
    <>
      <circle cx={C} cy={cy} r={r} />
      <g clipPath={`url(#${clipId})`}>
        <circle cx={C} cy={cy} r={s} />
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3;
          return (
            <circle
              key={i}
              cx={(C + s * Math.sin(a)).toFixed(2)}
              cy={(cy - s * Math.cos(a)).toFixed(2)}
              r={s}
            />
          );
        })}
      </g>
    </>
  );
};

/** An eye: the vesica stood on its side, with a pupil. */
const eye: Sigil = ({ cy, r }) => (
  <>
    <path
      d={`M ${C - r} ${cy} Q ${C} ${cy - r * 0.95} ${C + r} ${cy} Q ${C} ${cy + r * 0.95} ${C - r} ${cy} Z`}
    />
    <circle cx={C} cy={cy} r={r * 0.34} />
    <circle cx={C} cy={cy} r={1.1} fill="currentColor" stroke="none" />
  </>
);

/** Three rings on a triangle — the trefoil that closes the bottom corner of
 * the plates. */
const trefoil: Sigil = ({ cy, r }) => {
  const s = r * 0.52;
  const d = r * 0.44;
  return (
    <>
      {[0, 1, 2].map((i) => {
        const a = (i * 2 * Math.PI) / 3;
        return (
          <circle
            key={i}
            cx={(C + d * Math.sin(a)).toFixed(2)}
            cy={(cy - d * Math.cos(a) + d * 0.25).toFixed(2)}
            r={s}
          />
        );
      })}
    </>
  );
};

/** A cross with two bars, ringed — the plates' sceptre. */
const sceptre: Sigil = ({ cy, r }) => (
  <>
    <line x1={C} y1={cy - r} x2={C} y2={cy + r} />
    <line x1={C - r * 0.62} y1={cy - r * 0.28} x2={C + r * 0.62} y2={cy - r * 0.28} />
    <line x1={C - r * 0.38} y1={cy + r * 0.3} x2={C + r * 0.38} y2={cy + r * 0.3} />
    <circle cx={C} cy={cy - r * 0.72} r={r * 0.24} />
  </>
);

/* ---- half-height bands ----
 *
 * These run the cell's full width rather than sitting inside a circle: they
 * are the plate's connective tissue, not its figures, and they read as a
 * measure taken between two drawings.
 */

/** A read-out: bars of varied width — the plates' way of writing something
 * down without writing anything. Genuinely random, because there is no
 * canonical barcode and a repeated one would read as a logo. */
const readout: Sigil = ({ w, cy, h }, rng) => {
  const bars: ReactNode[] = [];
  const half = h * 0.3;
  const end = w - PAD;
  let x = PAD;
  let i = 0;
  while (x < end - 0.6) {
    const bw = 0.7 + rng() * 1.8;
    if (rng() > 0.32) {
      bars.push(
        <rect
          key={i}
          x={x.toFixed(2)}
          y={(cy - half).toFixed(2)}
          width={Math.min(bw, end - x).toFixed(2)}
          height={(half * 2).toFixed(2)}
          fill="currentColor"
          stroke="none"
        />
      );
    }
    x += bw + 0.7;
    i++;
  }
  return <>{bars}</>;
};

/** A braid: two strands crossing — the woven band the plates run under an
 * anatomical figure. */
const braid: Sigil = ({ w, cy, h }) => {
  // Steps scale with the run, so a double-width band gets the same wave
  // length as a single one rather than a stretched version of it.
  const span = w - PAD * 2;
  const steps = Math.max(14, Math.round((span / CELL) * 28));
  const x0 = PAD;
  const amp = h * 0.28;
  const strand = (phase: number) => {
    let d = '';
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (i / steps) * span;
      const y = cy + amp * Math.sin((x / CELL) * Math.PI * 4 + phase);
      d += `${i ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return d;
  };
  return (
    <>
      <path d={strand(0)} />
      <path d={strand(Math.PI)} />
    </>
  );
};

/** A rule of ticks, long every fourth — a scale with no numbers on it. */
const ticks: Sigil = ({ w, cy, h }) => {
  const span = w - PAD * 2;
  // Same tick spacing whatever the run — a scale that stretches is not a
  // scale.
  const n = Math.max(5, Math.round((span / CELL) * 16) + 1);
  const x0 = PAD;
  const base = cy + h * 0.22;
  return (
    <>
      <line x1={x0} y1={base} x2={x0 + span} y2={base} />
      {Array.from({ length: n }, (_, i) => {
        const x = x0 + (i / (n - 1)) * span;
        const len = i % 4 === 0 ? h * 0.34 : h * 0.17;
        return (
          <line
            key={i}
            x1={x.toFixed(2)}
            y1={base.toFixed(2)}
            x2={x.toFixed(2)}
            y2={(base - len).toFixed(2)}
          />
        );
      })}
    </>
  );
};

/** Two rows of points, offset — the lattice at band height. */
const dotBand: Sigil = ({ w, cy, h }) => {
  const span = w - PAD * 2;
  const n = Math.max(3, Math.round((span / CELL) * 6) + 1);
  const x0 = PAD;
  const gap = span / (n - 1);
  const dots: ReactNode[] = [];
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < n - row; i++) {
      dots.push(
        <circle
          key={`${row}-${i}`}
          cx={(x0 + i * gap + (row ? gap / 2 : 0)).toFixed(2)}
          cy={(cy + (row ? h * 0.2 : -h * 0.2)).toFixed(2)}
          r={0.75}
          fill="currentColor"
          stroke="none"
        />
      );
    }
  }
  return <>{dots}</>;
};

/** Nested chevrons — the one survivor of the dogtooth this replaced, kept so
 * the new column still answers to the box's cut edge. */
const chevrons: Sigil = ({ w, cx, cy, h }) => (
  <>
    {[0, 1, 2].map((i) => {
      const o = (i - 1) * h * 0.24;
      const up = (cy - h * 0.16 + o).toFixed(2);
      const down = (cy + h * 0.16 + o).toFixed(2);
      return <polyline key={i} points={`${PAD},${up} ${cx},${down} ${w - PAD},${up}`} />;
    })}
  </>
);

const FIGURES: readonly Sigil[] = [
  rings,
  hexagram,
  vesica,
  octagram,
  radiant,
  junction,
  lattice,
  flower,
  eye,
  trefoil,
  sceptre,
];

const BANDS: readonly Sigil[] = [readout, braid, ticks, dotBand, chevrons];

/** Draws from a pool without repeating until it is exhausted, so every mark
 * appears before any appears twice and no two neighbours are the same. A
 * plain random draw clumps, and a clump is the one thing that makes a
 * hand-set panel look machine-made. */
function bagDraw(pool: readonly Sigil[], rng: () => number, skip = 0) {
  let bag: Sigil[] = [];
  let last: Sigil | null = null;
  let first = true;
  return () => {
    if (!bag.length) {
      bag = [...pool];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = (rng() * (i + 1)) | 0;
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      // The first fill discards this panel's offset into the shared order,
      // so consecutive panels consume consecutive runs of it. Later refills
      // reshuffle normally — a panel long enough to exhaust the alphabet has
      // already used every figure once, which is all the rule promises.
      if (first) {
        first = false;
        for (let i = 0; i < skip && bag.length > 1; i++) bag.pop();
      }
      // Don't let the reshuffle put the same mark either side of the seam.
      if (last && bag[bag.length - 1] === last && bag.length > 1) {
        [bag[bag.length - 1], bag[0]] = [bag[0], bag[bag.length - 1]];
      }
    }
    last = bag.pop()!;
    return last;
  };
}

interface Slot {
  draw: Sigil;
  /** Extent ALONG the axis, in user units. */
  run: number;
}

/** Lays a panel out: `units` slots of one CELL each along the axis, except
 * that some break into two — which keeps the total exactly `units * CELL`,
 * so the panel ends flush however big it is.
 *
 * A split slot is always WIDER than it is tall, whichever axis is running:
 * down a column that means two half-height cells, across a band it means one
 * double-width cell. The band figures are horizontal marks — a read-out, a
 * scale — and they want a landscape cell either way.
 */
function layout(units: number, run: number, axis: 'y' | 'x', rng: () => number, skip: number): Slot[] {
  const order = mulberry32(PAGE_SEED);
  const figure = bagDraw(FIGURES, order, skip);
  const band = bagDraw(BANDS, order, skip);
  const slots: Slot[] = [];
  let used = 0;
  while (used < units) {
    const left = units - used;
    // Never two split slots running: a run of bands stops reading as
    // punctuation between figures and starts being its own texture.
    const prev = slots[slots.length - 1];
    const canSplit = used > 0 && prev?.run === run && (axis === 'y' ? left >= 1 : left >= 2);
    if (canSplit && rng() < (axis === 'y' ? 0.3 : 0.34)) {
      if (axis === 'y') {
        slots.push({ draw: band(), run: run / 2 }, { draw: band(), run: run / 2 });
        used += 1;
      } else {
        slots.push({ draw: band(), run: run * 2 });
        used += 2;
      }
    } else {
      slots.push({ draw: figure(), run });
      used += 1;
    }
  }
  return slots;
}

interface Props {
  /** Which way the cells run. 'y' is a column, 'x' a band. */
  axis?: 'y' | 'x';
  /** Varies the sequence, so two panels on one page are a set and not copies
   * of each other. */
  seed?: number;
  /** Forces the cell count instead of solving it from the panel's shape —
   * 1 gives a single cartouche filling the panel. */
  units?: number;
  /** This panel's offset into the sheet's shared order of figures. Space
   * these out by at least as many cells as the panel before will use and no
   * figure appears twice across the whole sheet. */
  skip?: number;
  className?: string;
}

/** One panel of cartouches, sized to its own box. */
export default function SigilPlate({ axis = 'y', seed = 7, units: fixed, skip = 0, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  /** The panel's measured box. The SHAPE is what matters, not the pixels:
   * the viewBox is built to the panel's own aspect so the plate maps onto it
   * 1:1 and a circle drawn in user units arrives on screen as a circle.
   *
   * The first version stretched a square-celled viewBox onto whatever box
   * the grid handed it (preserveAspectRatio: none), which is fine until the
   * panel is not a whole number of cells long — and none of them are. The
   * top-left cartouche was a 210x186 cell carrying a 13% squash, and every
   * ring in it came out an egg. */
  const [box, setBox] = useState(() => (axis === 'y' ? { w: 40, h: 240 } : { w: 240, h: 40 }));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w && h) setBox({ w, h });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const down = axis === 'y';
  // The panel's long side in user units, with its short side pinned to CELL.
  const span = CELL * (down ? box.h / box.w : box.w / box.h);
  const units = fixed ?? Math.min(48, Math.max(1, Math.round(span / (CELL * DENSITY))));
  // Cells divide the span EXACTLY, so the run is whatever that leaves —
  // slightly off square, and the figures don't care because each is drawn to
  // its own cell's short side.
  const run = span / units;

  const clipId = `sigil-clip-${axis}-${seed}`;
  const slots =
    units === 1
      ? [{ draw: bagDraw(FIGURES, mulberry32(PAGE_SEED), skip)(), run }]
      : layout(units, run, axis, mulberry32(seed), skip);

  let at = 0;
  return (
    <div ref={ref} className={`sigil-plate${className ? ` ${className}` : ''}`} aria-hidden="true">
      <svg
        className="sigil-plate-svg"
        viewBox={down ? `0 0 ${CELL} ${span.toFixed(3)}` : `0 0 ${span.toFixed(3)} ${CELL}`}
        focusable="false"
      >
        <defs>
          {/* The flower is drawn oversized and cut back to its rim. Only full
              cells use it, so one geometry covers every case. */}
          {/* Sized to the cell the flower can actually appear in. */}
          <clipPath id={clipId}>
            <circle
              cx={C}
              cy={Math.min(CELL, run) / 2}
              r={Math.max(1.5, Math.min(CELL, run) / 2 - PAD)}
            />
          </clipPath>
        </defs>
        {slots.map((slot, i) => {
          const start = at;
          at += slot.run;
          // A slot runs `run` along the axis and one CELL across it.
          const w = down ? CELL : slot.run;
          const h = down ? slot.run : CELL;
          // The pad is a fixed share of a full cell, so a cell short enough
          // (a half-height band on a squat panel, or the placeholder box
          // before the observer has measured anything) can ask for a radius
          // below zero. Floored rather than scaled: a figure that small is
          // about to be replaced by a real measurement anyway.
          const cell: Cell = {
            w,
            h,
            cx: w / 2,
            cy: h / 2,
            r: Math.max(1.5, Math.min(w, h) / 2 - PAD),
          };
          // Every third rule is doubled, the way a plate breaks a long run
          // into groups instead of holding one cadence end to end.
          const doubled = i > 0 && i % 3 === 0;
          const rule = (o: number) =>
            down ? (
              <line x1={0} y1={o} x2={CELL} y2={o} className="sigil-rule" />
            ) : (
              <line x1={o} y1={0} x2={o} y2={CELL} className="sigil-rule" />
            );
          return (
            <g key={i} transform={down ? `translate(0 ${start})` : `translate(${start} 0)`}>
              {i > 0 && rule(0)}
              {doubled && rule(1.6)}
              {/* Its own stream, keyed to the slot: a figure that consumes a
                  different number of draws depending on what it rolls would
                  otherwise shift every figure after it. */}
              {slot.draw(cell, mulberry32(seed + i * 131), clipId)}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

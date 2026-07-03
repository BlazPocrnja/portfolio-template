interface Props {
  label: string;
}

/**
 * Per-character roll: each letter gets its own stacked top/bottom copy (see
 * .chr-hover / .ch-wrap / .ch-top / .ch-bot in global.css) and a `--i` index
 * that staggers its transition-delay, so the whole label cascades on hover
 * instead of flipping as one flat block.
 */
export default function HoverLink({ label }: Props) {
  return (
    <span className="chr-hover">
      <span className="chr-chars" aria-hidden="true">
        {[...label].map((ch, i) =>
          ch === ' ' ? (
            <span key={i} className="ch-space" />
          ) : (
            <span key={i} className="ch-wrap" style={{ '--i': i } as React.CSSProperties}>
              <span className="ch-top">{ch}</span>
              <span className="ch-bot">{ch}</span>
            </span>
          )
        )}
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

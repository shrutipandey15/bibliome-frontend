import { bloomAlt } from "./cardModel";

/**
 * The bloom as SVG, from the backend's path data — the same strings the canvas
 * renderer and the link preview draw, so all three are one flower. Ink is
 * `currentColor`; the layers carry their own opacities.
 */
export default function Bloom({ bloom, size = "100%", alt, className = "" }) {
  if (!bloom?.layers) return null;
  return (
    <svg
      className={`bloom ${className}`.trim()}
      viewBox={`0 0 ${bloom.size} ${bloom.size}`}
      width={size}
      height={size}
      role="img"
      aria-label={alt || bloomAlt(bloom)}
    >
      {bloom.layers.map((layer, i) => (
        layer.stroke != null ? (
          <path key={i} d={layer.d} fill="none" stroke="currentColor"
            strokeOpacity={layer.stroke} strokeWidth={layer.width} />
        ) : (
          <path key={i} d={layer.d} fill="currentColor" fillOpacity={layer.fill} />
        )
      ))}
    </svg>
  );
}

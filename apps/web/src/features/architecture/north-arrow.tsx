import { DRAW } from './drawing-colors';

/** North arrow for the SVG drawings (north = up). */
export function NorthArrow({ x, y, size = 40 }: { x: number; y: number; size?: number }) {
  return (
    <g aria-label="North" role="img">
      <path d={`M ${x} ${y - size} L ${x + size / 3} ${y} L ${x} ${y - size / 4} L ${x - size / 3} ${y} Z`} fill={DRAW.ink} />
      <text x={x} y={y + size / 1.6} fontSize={size / 1.6} textAnchor="middle" fill={DRAW.ink}>
        N
      </text>
    </g>
  );
}

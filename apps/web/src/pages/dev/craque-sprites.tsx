import type { CSSProperties } from 'react';
import { spritePaths, type SpriteMap } from '../../components/ui/pixel-sprite-maps';
import { GOLD } from './craque-sprite-maps';

export function Px({
  map,
  scale,
  className,
  style,
}: {
  map: SpriteMap;
  scale: number;
  className?: string;
  style?: CSSProperties;
}) {
  const paths = spritePaths(map, GOLD);
  const w = map[0]!.length;
  return (
    <svg
      aria-hidden
      focusable="false"
      width={w * scale}
      height={map.length * scale}
      viewBox={`0 0 ${w} ${map.length}`}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

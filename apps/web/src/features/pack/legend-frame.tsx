import type { CSSProperties } from 'react';
import { spritePaths, type SpriteMap } from '../../components/ui/pixel-sprite-maps';
import { cn } from '../../lib/cn';
import './legend-frame.css';
import { LEGEND_PALETTE, SPARK, SPIKE, TROPHY, WING } from './legend-sprite-maps';

function Px({
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
  const paths = spritePaths(map, LEGEND_PALETTE);
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

/** Faísca que paira e pisca em degraus (parada com Reduzir movimento). */
function Spark({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <Px
      map={SPARK}
      scale={3}
      className={cn('animate-star-twinkle pointer-events-none absolute', className)}
      style={{ '--moment-delay': `${delay}ms` } as CSSProperties}
    />
  );
}

/**
 * Os enfeites de fora da moldura "Lenda": troféu com asas em cima, ponteiras nos cantos de cima e faíscas em volta.
 * Tudo decoração (`aria-hidden`) e fora do texto da carta.
 */
export function LegendOrnaments() {
  return (
    <>
      <Px
        map={WING}
        scale={4}
        className="pointer-events-none absolute top-[4px] left-[calc(50%-24px-56px)] z-10"
      />
      <Px
        map={WING}
        scale={4}
        className="pointer-events-none absolute top-[4px] left-[calc(50%+24px)] z-10 [transform:scaleX(-1)]"
      />
      <Px
        map={TROPHY}
        scale={3}
        className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 drop-shadow-[0_3px_0_rgb(0_0_0/45%)]"
      />
      <Px
        map={SPIKE}
        scale={4}
        className="pointer-events-none absolute top-[34px] -left-[10px] z-10 [transform:rotate(-14deg)]"
      />
      <Px
        map={SPIKE}
        scale={4}
        className="pointer-events-none absolute top-[34px] -right-[10px] z-10 [transform:rotate(14deg)]"
      />
      <Spark className="-top-1 left-2" delay={0} />
      <Spark className="top-16 -left-7" delay={250} />
      <Spark className="top-[46%] -right-7" delay={500} />
      <Spark className="bottom-10 -left-6" delay={150} />
      <Spark className="-bottom-3 right-8" delay={400} />
      <Spark className="top-4 right-0" delay={600} />
    </>
  );
}

/** As faíscas de dentro do miolo e os dois brilhos fortes que passam (parados com Reduzir movimento). */
export function LegendShine() {
  return (
    <>
      <Spark className="top-[66px] right-[92px]" delay={300} />
      <Spark className="bottom-[84px] left-[104px]" delay={650} />
      <i aria-hidden className="legend-sweep legend-sweep-strong" />
      <i aria-hidden className="legend-sweep legend-sweep-strong legend-sweep-late" />
    </>
  );
}

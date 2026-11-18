import { spritePaths, type SpriteMap } from './pixel-sprite-maps';

type PixelPictureProps = {
  map: SpriteMap;
  palette: Record<string, string>;
  /** Escala inteira (nunca fração): 4 → cada pixel do mapa vira 4 px. */
  scale?: number;
  className?: string;
};

/** Qualquer mapa de pixels (uma letra por cor) como imagem decorativa: o nome vem sempre do texto ao lado. */
export function PixelPicture({ map, palette, scale = 4, className }: PixelPictureProps) {
  const width = map[0]!.length;
  const paths = spritePaths(map, palette);
  return (
    <svg
      aria-hidden
      width={width * scale}
      height={map.length * scale}
      viewBox={`0 0 ${width} ${map.length}`}
      shapeRendering="crispEdges"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

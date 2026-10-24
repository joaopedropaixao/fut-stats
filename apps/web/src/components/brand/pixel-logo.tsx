import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { logoWordArt, type LogoWordArt } from './logo-art';

const FUT = logoWordArt('FUT');
const STATS = logoWordArt('STATS');

type Palette = { face: string; outline: string };

/** Uma palavra do logo, com a profundidade amarela de fliperama. `scale` é o tamanho do pixel (inteiro). */
function LogoWord({
  art,
  scale,
  palette,
  className,
  style,
}: {
  art: LogoWordArt;
  scale: number;
  palette: Palette;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      width={art.width * scale}
      height={art.height * scale}
      viewBox={`0 0 ${art.width} ${art.height}`}
      shapeRendering="crispEdges"
      className={cn('block', className)}
      style={style}
    >
      <path d={art.shadow} fill="#000000" />
      <path d={art.outline} fill={palette.outline} />
      <path d={art.extrude} fill="var(--color-game)" />
      <path d={art.face} fill={palette.face} />
    </svg>
  );
}

/**
 * Logo "FUT STATS" (grande momento da capa): letras pretas sobre contorno branco (Branco x Preto),
 * com a profundidade amarela (`--color-game`, a mesma exceção do VS). As palavras caem em degraus, uma depois da outra;
 * com "reduzir movimento", já aparecem no lugar.
 */
export function PixelLogo({ scale = 8, className }: { scale?: number; className?: string }) {
  return (
    <div role="img" aria-label="Fut Stats" className={cn('flex flex-col', className)}>
      <LogoWord
        art={FUT}
        scale={scale}
        palette={{ face: 'var(--color-team-black)', outline: 'var(--color-team-white)' }}
        className="animate-logo-drop"
      />
      <LogoWord
        art={STATS}
        scale={scale}
        palette={{ face: 'var(--color-team-black)', outline: 'var(--color-team-white)' }}
        className="animate-logo-drop [animation-delay:180ms]"
        style={{ marginTop: -2 * scale }}
      />
    </div>
  );
}

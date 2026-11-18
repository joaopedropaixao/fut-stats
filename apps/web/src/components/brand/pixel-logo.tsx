import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { logoWordArt, type LogoWordArt } from './logo-art';

const FUT = logoWordArt('FUT');
const STATS = logoWordArt('STATS');

/** Cores de cada camada de uma palavra: letra, contorno, profundidade e sombra dura. */
type LogoColors = { face: string; outline: string; extrude: string; shadow: string };

/** Letreiro amarelo de fliperama, como o VS da folha: letra amarela, contorno preto, profundidade branca. */
const COLORS: LogoColors = {
  face: 'var(--color-game)',
  outline: '#000000',
  extrude: 'var(--color-team-white)',
  shadow: '#000000',
};

/** Uma palavra do logo. `scale` é o tamanho do pixel (inteiro). */
function LogoWord({
  art,
  scale,
  colors,
  className,
  style,
}: {
  art: LogoWordArt;
  scale: number;
  colors: LogoColors;
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
      <path d={art.shadow} fill={colors.shadow} />
      <path d={art.outline} fill={colors.outline} />
      <path d={art.extrude} fill={colors.extrude} />
      <path d={art.face} fill={colors.face} />
    </svg>
  );
}

/**
 * Logo "FUT STATS" (grande momento da capa), em letreiro de fliperama: letra amarela (`--color-game`,
 * a mesma exceção do VS), contorno preto, profundidade branca e sombra dura. As palavras caem em
 * degraus, uma depois da outra; com "reduzir movimento", já aparecem no lugar.
 */
export function PixelLogo({ scale = 8, className }: { scale?: number; className?: string }) {
  return (
    <div role="img" aria-label="Fut Stats" className={cn('flex flex-col', className)}>
      <LogoWord art={FUT} scale={scale} colors={COLORS} className="animate-logo-drop" />
      <LogoWord
        art={STATS}
        scale={scale}
        colors={COLORS}
        className="animate-logo-drop [animation-delay:180ms]"
        style={{ marginTop: -2 * scale }}
      />
    </div>
  );
}

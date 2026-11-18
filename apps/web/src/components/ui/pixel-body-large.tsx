import type { PlayerAvatar } from '@fut-stats/shared';
import { useMemo, type CSSProperties } from 'react';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import {
  BODY_LARGE_HEIGHT,
  BODY_LARGE_WIDTH,
  bodyLargeMap,
  bodyLargePalette,
} from './pixel-body-large-maps';
import { spritePaths, type SpriteTeam } from './pixel-sprite-maps';

type PixelBodyLargeProps = {
  /** Sem time (`null`), a camisa é neutra. */
  team: SpriteTeam | null;
  avatar?: PlayerAvatar;
  /** Escala inteira (nunca fração): 2 → 32x48, 4 → 64x96. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * O bonequinho de corpo inteiro das telas grandes (montador, figurinha, card de resultado), grade 16 x 24, no
 * traço do rosto 12 x 12. Decorativo: o nome do jogador vem sempre em texto. Os mapas ficam fora do JS inicial
 * (só essas telas importam este módulo); VS, faixa VOCÊ e vitrine seguem com o `PlayerSprite` 8 x 12.
 */
export function PixelBodyLarge({
  team,
  avatar = DEFAULT_AVATAR,
  scale = 4,
  className,
  style,
}: PixelBodyLargeProps) {
  const { skin, hair, hairColor } = avatar;
  const paths = useMemo(() => {
    const value = { skin, hair, hairColor };
    return spritePaths(bodyLargeMap(value), bodyLargePalette(value, team));
  }, [skin, hair, hairColor, team]);
  return (
    <svg
      aria-hidden
      width={BODY_LARGE_WIDTH * scale}
      height={BODY_LARGE_HEIGHT * scale}
      viewBox={`0 0 ${BODY_LARGE_WIDTH} ${BODY_LARGE_HEIGHT}`}
      style={style}
      shapeRendering="crispEdges"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

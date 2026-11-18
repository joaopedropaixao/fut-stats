import type { PlayerAvatar } from '@fut-stats/shared';
import { useMemo, type CSSProperties } from 'react';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import {
  playerPalette,
  playerSpriteMap,
  SPRITE_PLAYER_HEIGHT,
  SPRITE_PLAYER_WIDTH,
  spritePaths,
  type SpriteTeam,
} from './pixel-sprite-maps';

type PlayerSpriteProps = {
  /** Sem time (`null`), a camisa é neutra. */
  team: SpriteTeam | null;
  /** O bonequinho do jogador (pele e cabelo). Sem ele, o padrão. */
  avatar?: PlayerAvatar;
  /** Escala inteira (nunca fração): 2 → 16x24, 3 → 24x36. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

/** O bonequinho em pixel, decorativo (o nome do jogador vem sempre em texto ao lado). */
export function PlayerSprite({
  team,
  avatar = DEFAULT_AVATAR,
  scale = 2,
  className,
  style,
}: PlayerSpriteProps) {
  const { skin, hair, hairColor } = avatar;
  const paths = useMemo(() => {
    const value = { skin, hair, hairColor };
    return spritePaths(playerSpriteMap(value), playerPalette(value, team));
  }, [skin, hair, hairColor, team]);
  return (
    <svg
      aria-hidden
      width={SPRITE_PLAYER_WIDTH * scale}
      height={SPRITE_PLAYER_HEIGHT * scale}
      viewBox={`0 0 ${SPRITE_PLAYER_WIDTH} ${SPRITE_PLAYER_HEIGHT}`}
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

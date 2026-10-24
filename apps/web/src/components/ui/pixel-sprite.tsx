import { useMemo, type CSSProperties } from 'react';
import {
  PLAYER_SPRITE,
  SPRITE_PLAYER_HEIGHT,
  SPRITE_PLAYER_WIDTH,
  spritePaths,
  teamPalette,
  type SpriteTeam,
} from './pixel-sprite-maps';

type PlayerSpriteProps = {
  team: SpriteTeam;
  /** Escala inteira (nunca fração): 2 → 16x24, 3 → 24x36. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
};

/** O bonequinho em pixel, decorativo (o nome do jogador vem sempre em texto ao lado). */
export function PlayerSprite({ team, scale = 2, className, style }: PlayerSpriteProps) {
  const paths = useMemo(() => spritePaths(PLAYER_SPRITE, teamPalette(team)), [team]);
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

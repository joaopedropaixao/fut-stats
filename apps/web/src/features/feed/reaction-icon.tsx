import {
  REACTION_PALETTES,
  REACTION_SPRITE_SIZE,
  REACTION_SPRITES,
  spritePaths,
} from '../../components/ui/pixel-sprite-maps';
import type { PostReaction } from '@fut-stats/shared';

/** Um ícone pixel de reação (12 x 12); decorativo: o nome vem do botão. Escala inteira: 2 → 24 px. */
export function ReactionIcon({ reaction, scale = 2 }: { reaction: PostReaction; scale?: number }) {
  const paths = spritePaths(REACTION_SPRITES[reaction], REACTION_PALETTES[reaction]);
  return (
    <svg
      aria-hidden
      width={REACTION_SPRITE_SIZE * scale}
      height={REACTION_SPRITE_SIZE * scale}
      viewBox={`0 0 ${REACTION_SPRITE_SIZE} ${REACTION_SPRITE_SIZE}`}
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

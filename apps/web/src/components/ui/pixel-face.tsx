import type { PlayerAvatar } from '@fut-stats/shared';
import { useMemo } from 'react';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import { FACE_SIZE, faceMap, facePalette } from './pixel-face-maps';
import { spritePaths, type SpriteTeam } from './pixel-sprite-maps';

type PixelFaceProps = {
  avatar?: PlayerAvatar;
  /** O time dá a cor da camisa (ombros); sem time, o tom neutro. */
  team?: SpriteTeam | null;
  /** Escala inteira (nunca fração): 2 → 24 px, 3 → 36 px, 4 → 48 px. */
  scale?: number;
  className?: string;
};

/** O rosto do bonequinho (cabeça e ombros, grade 12 x 12), decorativo: o apelido vem sempre em texto. */
export function PixelFace({
  avatar = DEFAULT_AVATAR,
  team = null,
  scale = 3,
  className,
}: PixelFaceProps) {
  const { skin, hair, hairColor } = avatar;
  const paths = useMemo(() => {
    const value = { skin, hair, hairColor };
    return spritePaths(faceMap(value), facePalette(value, team));
  }, [skin, hair, hairColor, team]);
  return (
    <svg
      aria-hidden
      width={FACE_SIZE * scale}
      height={FACE_SIZE * scale}
      viewBox={`0 0 ${FACE_SIZE} ${FACE_SIZE}`}
      shapeRendering="crispEdges"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

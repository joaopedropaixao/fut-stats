import type { PlayerAvatar } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { PixelDigits } from './pixel-digits';
import { PixelFace } from './pixel-face';
import { PixelText } from './pixel-text';

export type AvatarTeam = 'white' | 'black';
export type AvatarSize = 32 | 40 | 56;

const SIZE: Record<AvatarSize, string> = { 32: 'size-8', 40: 'size-10', 56: 'size-14' };
/** O rosto (12 x 12) cabe no círculo em escala inteira: 32 → ×2, 40 → ×3, 56 → ×4. */
const FACE_SCALE: Record<AvatarSize, number> = { 32: 2, 40: 3, 56: 4 };

/** Anel do time: um vão da cor do fundo e o anel por fora (Preto ganha um fio claro para aparecer no escuro). */
const RING: Record<AvatarTeam, string> = {
  white: '0 0 0 2px var(--avatar-gap), 0 0 0 4px #fff',
  black: '0 0 0 2px var(--avatar-gap), 0 0 0 4px #000, 0 0 0 5px rgb(255 255 255 / 35%)',
};

/**
 * O disco do rosto: o bonequinho de cabeça e ombros num círculo de fundo médio (a pele e o cabelo de todo
 * jeito aparecem nele). Os ombros encostam embaixo e o círculo corta os cantos.
 */
export function FaceDisc({
  avatar,
  team,
  size,
  className,
  style,
}: {
  avatar: PlayerAvatar;
  team: AvatarTeam | null;
  size: AvatarSize;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        'relative inline-flex items-end justify-center overflow-hidden rounded-full bg-border-strong',
        SIZE[size],
        className,
      )}
    >
      <PixelFace avatar={avatar} team={team} scale={FACE_SCALE[size]} />
    </span>
  );
}

type AvatarProps = {
  nickname: string;
  /** O bonequinho do jogador: o rosto dele em todo lugar. */
  avatar: PlayerAvatar;
  team: AvatarTeam;
  size?: AvatarSize;
  /** Mostra o selo "G" de goleiro. */
  goalkeeper?: boolean;
  /** Cor do vão entre o avatar e o anel: a do fundo onde ele está. */
  gap?: 'bg' | 'surface' | 'surface-raised' | 'surface-3' | 'field';
  className?: string;
};

/** O anel diz o time; perto do avatar sempre aparece o nome do time escrito (daltonismo). */
export function Avatar({
  nickname,
  avatar,
  team,
  size = 40,
  goalkeeper,
  gap = 'bg',
  className,
}: AvatarProps) {
  const style = { '--avatar-gap': `var(--color-${gap})`, boxShadow: RING[team] } as CSSProperties;
  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      role="img"
      aria-label={nickname}
    >
      <FaceDisc avatar={avatar} team={team} size={size} style={style} />
      {goalkeeper && (
        <span
          aria-hidden
          style={{ boxShadow: `0 0 0 2px var(--color-${gap})` }}
          className="absolute -right-2 -bottom-2 inline-flex size-5 items-center justify-center rounded-full bg-text pl-px text-team-black"
        >
          <PixelText className="leading-none">G</PixelText>
        </span>
      )}
    </span>
  );
}

/** "+9": quantos faltam mostrar num grupo de avatares. */
export function AvatarMore({ count }: { count: number }) {
  return (
    <span
      role="img"
      aria-label={`mais ${count}`}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-raised text-text"
    >
      <PixelDigits value={`+${count}`} scale={2} decorative />
    </span>
  );
}

import type { CSSProperties } from 'react';
import { cn } from '../../lib/cn';
import { PixelDigits } from './pixel-digits';
import { PixelText } from './pixel-text';

export type AvatarTeam = 'white' | 'black';
export type AvatarSize = 32 | 40 | 56;

const SIZE: Record<AvatarSize, string> = { 32: 'size-8', 40: 'size-10', 56: 'size-14' };

/** Anel do time: um vão da cor do fundo e o anel por fora (Preto ganha um fio claro para aparecer no escuro). */
const RING: Record<AvatarTeam, string> = {
  white: '0 0 0 2px var(--avatar-gap), 0 0 0 4px #fff',
  black: '0 0 0 2px var(--avatar-gap), 0 0 0 4px #000, 0 0 0 5px rgb(255 255 255 / 35%)',
};

/** Iniciais do avatar: as 2 primeiras letras do apelido. */
function avatarInitials(nickname: string): string {
  return [...nickname.trim()].slice(0, 2).join('').toUpperCase();
}

type AvatarProps = {
  nickname: string;
  team: AvatarTeam;
  size?: AvatarSize;
  /** Mostra o selo "G" de goleiro. */
  goalkeeper?: boolean;
  /** Cor do vão entre o avatar e o anel: a do fundo onde ele está. */
  gap?: 'bg' | 'surface' | 'surface-raised';
  className?: string;
};

/** O anel diz o time; perto do avatar sempre aparece o nome do time escrito (daltonismo). */
export function Avatar({
  nickname,
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
      <span
        aria-hidden
        style={style}
        className={cn(
          'inline-flex items-center justify-center rounded-full pl-0.5',
          SIZE[size],
          team === 'white' ? 'bg-team-white text-team-black' : 'bg-team-black text-team-white',
        )}
      >
        <PixelText size={size >= 56 ? 24 : 16} className="leading-none">
          {avatarInitials(nickname)}
        </PixelText>
      </span>
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
      <PixelDigits value={`+${count}`} scale={2} />
    </span>
  );
}

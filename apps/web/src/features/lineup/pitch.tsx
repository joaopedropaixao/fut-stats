import { POSITION_LABELS, TEAM_LABELS } from '@fut-stats/shared';
import type { Ref } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import {
  SLOTS,
  type LineupMember,
  type SlotKey,
  type TeamDraft,
  type TeamKey,
} from './lineup-draft';
import { NoPresence } from './no-presence';

/**
 * Onde cada vaga do 1-2-3-1 fica no campo (ataque em cima, goleiro embaixo).
 * Na linha de três, o meio fica mais atrás para os nomes não se encostarem.
 */
const SLOT_POSITION: Record<SlotKey, { left: string; top: number }> = {
  FWD: { left: '50%', top: 30 },
  WING1: { left: '18.4%', top: 160 },
  MID: { left: '50%', top: 196 },
  WING2: { left: '77.1%', top: 160 },
  DEF1: { left: '27.9%', top: 296 },
  DEF2: { left: '72.1%', top: 296 },
  GK: { left: '50%', top: 392 },
};

type PitchProps = {
  team: TeamKey;
  draft: TeamDraft;
  members: ReadonlyMap<string, LineupMember>;
  /** Jogador na mão (destacado no campo). */
  pickedId?: string | null;
  /** A vaga livre da vez: a única amarela do campo. */
  targetSlot?: SlotKey | null;
  /** Sem `onSlot`, o campo é só para olhar (times publicados). */
  onSlot?: (slot: SlotKey) => void;
  ref?: Ref<HTMLDivElement>;
};

/** O campo 1-2-3-1. Montando: toque no jogador e depois na vaga. Publicado: só para ver. */
export function Pitch({
  team,
  draft,
  members,
  pickedId = null,
  targetSlot = null,
  onSlot,
  ref,
}: PitchProps) {
  return (
    <div
      ref={ref}
      role="group"
      aria-label={`Campo do ${TEAM_LABELS[team]}`}
      className="relative h-120 scroll-mt-4 shrink-0 overflow-hidden bg-linear-to-b from-[#1f5a33] to-field shadow-[inset_0_0_0_3px_#000,4px_4px_0_var(--color-shadow)]"
    >
      <ChalkLines />
      {SLOTS.map(({ key, position }) => {
        const id = draft.slots[key];
        const member = id ? members.get(id) : undefined;
        const label = POSITION_LABELS[position];
        const picked = id !== null && id === pickedId;
        const target = key === targetSlot;
        const content = (
          <>
            <Marker
              team={team}
              member={member}
              goalkeeper={position === 'GOALKEEPER'}
              picked={picked}
              target={target}
            />
            {member ? (
              <>
                <PixelText>{member.nickname}</PixelText>
                {!member.confirmed && <NoPresence />}
              </>
            ) : (
              <PixelText className={target ? 'text-accent' : 'text-text'}>
                {target ? 'Toque aqui' : label}
              </PixelText>
            )}
          </>
        );
        const className =
          'absolute flex w-34 -translate-x-1/2 flex-col items-center gap-1.5 outline-offset-2';
        const style = SLOT_POSITION[key];
        const name = member
          ? `${label}: ${member.nickname}${member.confirmed ? '' : ', sem presença'}`
          : `${label}: vaga livre`;
        return onSlot ? (
          <button
            key={key}
            type="button"
            style={style}
            onClick={() => onSlot(key)}
            aria-label={name}
            aria-pressed={picked}
            className={cn(className, 'min-h-11')}
          >
            {content}
          </button>
        ) : (
          <div key={key} style={style} role="img" aria-label={name} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}

/** As linhas de giz: meio-campo no alto (arco) e a grande área com a pequena área embaixo. */
function ChalkLines() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 358 480"
      preserveAspectRatio="none"
      className="absolute inset-0 size-full"
      fill="none"
      stroke="rgb(255 255 255 / 30%)"
      strokeWidth="2"
    >
      <rect x="14" y="14" width="330" height="452" vectorEffect="non-scaling-stroke" />
      <path d="M119 14a60 60 0 0 0 120 0" vectorEffect="non-scaling-stroke" />
      <rect x="99" y="392" width="160" height="74" vectorEffect="non-scaling-stroke" />
      <rect x="139" y="438" width="80" height="28" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Marker({
  team,
  member,
  goalkeeper,
  picked,
  target,
}: {
  team: TeamKey;
  member: LineupMember | undefined;
  goalkeeper: boolean;
  picked: boolean;
  target: boolean;
}) {
  if (member) {
    return (
      <span
        className={cn(
          // O anel creme diz "na mão"; o amarelo fica só para a vaga livre da vez
          '-m-1.5 inline-flex rounded-full p-1.5',
          picked && 'shadow-[inset_0_0_0_3px_var(--color-text)]',
        )}
      >
        <Avatar
          nickname={member.nickname}
          team={team === 'WHITE' ? 'white' : 'black'}
          size={40}
          gap="field"
          goalkeeper={goalkeeper}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full',
        target
          ? 'text-accent shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_6px_rgb(250_204_21/14%)]'
          : 'text-text-muted shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
      )}
    >
      <Icon name="plus" size={target ? 18 : 16} strokeWidth={target ? 2.4 : 2.2} />
    </span>
  );
}

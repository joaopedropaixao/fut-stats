import type { LineupPlayer } from '@fut-stats/shared';
import { POSITION_LABELS } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { SLOTS, type SlotKey, type TeamDraft, type TeamKey } from './lineup-draft';

type Member = Pick<LineupPlayer, 'membershipId' | 'nickname' | 'primaryPosition'>;

/** Onde cada vaga do 1-2-3-1 fica no campo (ataque em cima, goleiro embaixo). */
const SLOT_POSITION: Record<SlotKey, { left: string; top: number }> = {
  FWD: { left: '50%', top: 20 },
  WING1: { left: '22%', top: 148 },
  MID: { left: '50%', top: 196 },
  WING2: { left: '78%', top: 148 },
  DEF1: { left: '28%', top: 290 },
  DEF2: { left: '72%', top: 290 },
  GK: { left: '50%', top: 392 },
};

type PitchProps = {
  team: TeamKey;
  draft: TeamDraft;
  members: ReadonlyMap<string, Member>;
  /** Tem jogador na mão: as vagas ficam em destaque. */
  picking: boolean;
  pickedId: string | null;
  /** Sem `onSlot`, o campo é só para olhar. */
  onSlot?: (slot: SlotKey) => void;
};

/** O campo 1-2-3-1 (assinatura 2): toque no jogador e depois na vaga. */
export function Pitch({ team, draft, members, picking, pickedId, onSlot }: PitchProps) {
  return (
    <div
      className="relative h-120 overflow-hidden bg-linear-to-b from-[#1f5a33] to-field shadow-[inset_0_0_0_3px_#000,4px_4px_0_var(--color-shadow)]"
      role="group"
      aria-label={`Campo do time ${team === 'WHITE' ? 'Branco' : 'Preto'}`}
    >
      <div aria-hidden className="absolute inset-3.5 border-2 border-chalk" />
      <div aria-hidden className="absolute inset-x-3.5 top-1/2 h-0.5 bg-chalk" />
      <div aria-hidden className="absolute top-3.5 left-[30%] h-14 w-[40%] border-2 border-chalk" />
      <div
        aria-hidden
        className="absolute bottom-3.5 left-[30%] h-14 w-[40%] border-2 border-chalk"
      />
      {SLOTS.map(({ key, position }) => {
        const id = draft.slots[key];
        const member = id ? members.get(id) : undefined;
        const { left, top } = SLOT_POSITION[key];
        const style: CSSProperties = { left, top };
        const label = POSITION_LABELS[position];
        return (
          <button
            key={key}
            type="button"
            disabled={!onSlot}
            style={style}
            onClick={() => onSlot?.(key)}
            aria-label={member ? `${label}: ${member.nickname}` : `${label}: vaga livre`}
            aria-pressed={id !== null && id === pickedId}
            className="absolute flex min-h-11 w-34 -translate-x-1/2 flex-col items-center gap-1.5 disabled:cursor-default"
          >
            <Marker
              team={team}
              member={member}
              picked={id !== null && id === pickedId}
              target={picking && id !== pickedId}
            />
            <PixelText className={cn(member ? 'text-text' : 'text-text-muted')}>
              {member ? member.nickname : label}
            </PixelText>
          </button>
        );
      })}
    </div>
  );
}

function Marker({
  team,
  member,
  picked,
  target,
}: {
  team: TeamKey;
  member: Member | undefined;
  picked: boolean;
  target: boolean;
}) {
  if (member) {
    return (
      <span
        className={cn(
          'inline-flex rounded-full',
          picked && 'shadow-[0_0_0_6px_rgb(250_204_21/30%)]',
        )}
      >
        <Avatar
          nickname={member.nickname}
          team={team === 'WHITE' ? 'white' : 'black'}
          size={40}
          gap="field"
          goalkeeper={member.primaryPosition === 'GOALKEEPER'}
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
          ? 'shadow-[inset_0_0_0_2px_var(--color-accent),0_0_0_6px_rgb(250_204_21/14%)]'
          : 'shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
      )}
    />
  );
}

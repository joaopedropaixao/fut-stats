import { POSITION_LABELS, positionSchema } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { MemberAvatar } from '../rounds/member-avatar';
import type { LineupMember } from './lineup-draft';

type BenchProps = {
  players: readonly LineupMember[];
  pickedId: string | null;
  onPick: (id: string) => void;
};

/** Banco: quem confirmou e ainda está sem time, agrupado pela posição principal. */
export function Bench({ players, pickedId, onPick }: BenchProps) {
  const picked = players.find((p) => p.membershipId === pickedId);
  // Na ordem do 1-2-3-1: goleiro, zagueiro, ala, meio-campo, atacante
  const groups = positionSchema.options
    .map((position) => ({
      position,
      players: players
        .filter((p) => p.primaryPosition === position)
        .toSorted((a, b) => a.nickname.localeCompare(b.nickname, 'pt-BR')),
    }))
    .filter((g) => g.players.length > 0);

  return (
    <section aria-label="Banco" className="flex flex-col gap-4 bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <PixelText as="h2">Banco</PixelText>
        <PixelText className="text-text-muted">{`${players.length} sem time`}</PixelText>
      </div>

      {players.length === 0 ? (
        <p className="text-sm text-text-muted">Todos os confirmados já estão num time.</p>
      ) : (
        groups.map(({ position, players: group }) => (
          <div key={position} className="flex flex-col gap-2">
            <PixelText as="h3" className="text-text-muted">
              {POSITION_LABELS[position]}
            </PixelText>
            <ul className="flex flex-wrap gap-2">
              {group.map((p) => {
                const selected = p.membershipId === pickedId;
                return (
                  <li key={p.membershipId}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      aria-label={`${p.nickname}, ${POSITION_LABELS[p.primaryPosition]}`}
                      onClick={() => onPick(p.membershipId)}
                      className={cn(
                        'flex h-12 items-center gap-2 pr-3 pl-1',
                        'transition-colors duration-(--duration-fast) ease-out',
                        selected
                          ? 'bg-surface-3 shadow-[inset_0_0_0_3px_var(--color-text)]'
                          : 'bg-surface-raised active:bg-surface-3',
                      )}
                    >
                      <MemberAvatar nickname={p.nickname} goalkeeper={p.isHiredGoalkeeper} />
                      <PixelText>{p.nickname}</PixelText>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))
      )}

      {players.length > 0 && (
        <p className="text-caption text-text-muted">
          {picked
            ? `${picked.nickname} na mão. Toque numa vaga livre, ou num jogador do campo para trocar.`
            : 'Toque no jogador e depois na vaga do campo ou da reserva.'}
        </p>
      )}
    </section>
  );
}

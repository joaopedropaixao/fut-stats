import { TEAM_LABELS } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { countStarters, SLOTS, TEAM_KEYS, type Draft, type TeamKey } from './lineup-draft';

/**
 * Quantos titulares cada time já tem, em casas de fliperama: 7 brancas de um lado, 7 pretas do outro.
 * `blocker` é o motivo da API para não publicar, quando os dois times já estão cheios na tela.
 */
export function LineupStatus({ draft, blocker }: { draft: Draft; blocker?: string }) {
  const total = SLOTS.length;
  const missing = TEAM_KEYS.map((team) => ({ team, count: total - countStarters(draft, team) }))
    .filter((m) => m.count > 0)
    .map((m) => `${m.count} no ${TEAM_LABELS[m.team]}`);

  return (
    <section aria-label="Escalação" className="flex flex-col gap-3 bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <TeamCount team="WHITE" filled={countStarters(draft, 'WHITE')} total={total} />
        <TeamCount team="BLACK" filled={countStarters(draft, 'BLACK')} total={total} />
      </div>
      <div aria-hidden className="flex gap-3">
        <Cells team="WHITE" filled={countStarters(draft, 'WHITE')} total={total} />
        <Cells team="BLACK" filled={countStarters(draft, 'BLACK')} total={total} />
      </div>
      {missing.length > 0 ? (
        <p className="text-caption text-text-muted">{`Faltam ${missing.join(' e ')}.`}</p>
      ) : blocker ? (
        <p className="flex gap-2 text-caption text-text-muted">
          <Icon name="alert" size={16} className="mt-px shrink-0 text-warning" />
          {blocker}
        </p>
      ) : (
        <p className="flex items-center gap-2 text-caption text-text-muted">
          <Icon name="check" size={16} strokeWidth={2.6} className="shrink-0 text-success" />
          Os dois times estão completos.
        </p>
      )}
    </section>
  );
}

function TeamCount({ team, filled, total }: { team: TeamKey; filled: number; total: number }) {
  return (
    <span className={cn('flex items-baseline gap-2', team === 'BLACK' && 'flex-row-reverse')}>
      <PixelText>{TEAM_LABELS[team]}</PixelText>
      <PixelText className="text-text-muted">{`${filled} de ${total}`}</PixelText>
    </span>
  );
}

/** Uma casa por vaga; o Preto enche da direita para a esquerda, como num placar. */
function Cells({ team, filled, total }: { team: TeamKey; filled: number; total: number }) {
  return (
    <span className={cn('flex flex-1 gap-1', team === 'BLACK' && 'flex-row-reverse')}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            'h-3 flex-1 transition-colors duration-(--duration-fast) ease-out',
            i >= filled
              ? 'shadow-[inset_0_0_0_2px_rgb(255_255_255/18%)]'
              : team === 'WHITE'
                ? 'bg-team-white'
                : 'bg-team-black shadow-[inset_0_0_0_1px_rgb(255_255_255/35%)]',
          )}
        />
      ))}
    </span>
  );
}

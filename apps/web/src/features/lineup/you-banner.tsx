import { TEAM_LABELS } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import type { TeamKey } from './lineup-draft';

type YouBannerProps = {
  team: TeamKey;
  /** Posição por extenso ("Zagueiro") ou `null` para reserva. */
  position: string | null;
};

/** Faixa de quem está escalado: "Você joga no Branco", a posição e o selo do time. Texto e forma, não só cor. */
export function YouBanner({ team, position }: YouBannerProps) {
  const white = team === 'WHITE';
  return (
    <section
      aria-label={`Você joga no ${TEAM_LABELS[team]}`}
      className={cn(
        'flex items-center gap-3 bg-surface-3 p-3',
        white
          ? 'shadow-[inset_0_0_0_3px_var(--color-team-white)]'
          : 'shadow-[inset_0_0_0_3px_var(--color-team-black),inset_0_0_0_4px_rgb(255_255_255/35%)]',
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-14 shrink-0 items-center justify-center bg-field shadow-[inset_0_0_0_2px_rgb(255_255_255/30%)]"
      >
        <PlayerSprite team={white ? 'white' : 'black'} scale={3} />
      </span>
      <div className="flex min-w-0 flex-col gap-2">
        <PixelText wrap>{`Você joga no ${TEAM_LABELS[team]}`}</PixelText>
        <div className="flex flex-wrap items-center gap-2">
          <Badge label={TEAM_LABELS[team]} variant={white ? 'white' : 'black'} />
          <Badge label={position ?? 'Reserva'} variant="neutral" />
        </div>
      </div>
    </section>
  );
}

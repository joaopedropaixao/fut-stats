import type { HistoryDetail } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatMatchDay, formatMatchTime } from '../../features/history/format';
import { DIAGONAL_CUT, LiveDot } from './result';

/** Selo verde "✓ VENCEU" da folha, colado no número de quem venceu. */
function WonSeal() {
  return (
    <span className="mb-1 inline-flex h-7 items-center gap-1 bg-success px-2 text-[#04210f]">
      <Icon name="check" size={14} strokeWidth={3} className="shrink-0" />
      <PixelText>Venceu</PixelText>
    </span>
  );
}

type MiddleKind = 'draw' | 'live' | 'pending';

const MIDDLE_LABEL: Record<MiddleKind, string> = {
  draw: 'Empate',
  live: 'Em jogo',
  pending: 'Sem placar',
};

/** Selo do meio do placar: superfície escura para aparecer nos dois lados do corte. */
function MiddleSeal({ kind }: { kind: MiddleKind }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 bg-surface-3 px-2 text-text shadow-[inset_0_0_0_2px_var(--color-border-strong)]">
      {kind === 'live' && <LiveDot />}
      {kind === 'draw' && <Icon name="minus" size={14} strokeWidth={3} className="shrink-0" />}
      <PixelText>{MIDDLE_LABEL[kind]}</PixelText>
    </span>
  );
}

/** Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro, dígitos escala 12. */
export function Scoreboard({ match }: { match: HistoryDetail }) {
  const { score, winner } = match;
  const live = match.status === 'IN_PROGRESS';
  return (
    <section aria-label="Placar" className="bg-surface shadow-card">
      <div className="flex flex-col gap-2 px-5 pt-4 pb-5" style={{ backgroundImage: DIAGONAL_CUT }}>
        <div className="flex items-center justify-between">
          <PixelText className="text-[#3a3f3b]">{formatMatchDay(match.scheduledAt)}</PixelText>
          <PixelText className="text-[#b8bcb9]">{formatMatchTime(match.scheduledAt)}</PixelText>
        </div>
        {score ? (
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-end gap-3">
              <PixelDigits
                value={score.WHITE}
                scale={12}
                className="text-team-black"
                label={`Branco ${score.WHITE}`}
              />
              {winner === 'WHITE' && <WonSeal />}
            </div>
            {(winner === 'DRAW' || live) && (
              <span className="mb-1">
                <MiddleSeal kind={live ? 'live' : 'draw'} />
              </span>
            )}
            <div className="flex items-end gap-3">
              {winner === 'BLACK' && <WonSeal />}
              <PixelDigits
                value={score.BLACK}
                scale={12}
                className="text-team-white"
                label={`Preto ${score.BLACK}`}
              />
            </div>
          </div>
        ) : (
          // Sem placar lançado: um traço grosso de cada lado no lugar do número
          <div className="flex h-27 items-center justify-between">
            <span aria-hidden className="h-3 w-12 bg-team-black" />
            <MiddleSeal kind={live ? 'live' : 'pending'} />
            <span aria-hidden className="h-3 w-12 bg-team-white" />
          </div>
        )}
        <div className="flex items-center justify-between">
          <PixelText className="text-team-black">Branco</PixelText>
          <PixelText className="text-team-white">Preto</PixelText>
        </div>
      </div>
      {match.location && (
        <p className="px-5 py-3 text-sm text-text-muted">
          <span className="sr-only">Local: </span>
          {match.location}
        </p>
      )}
    </section>
  );
}

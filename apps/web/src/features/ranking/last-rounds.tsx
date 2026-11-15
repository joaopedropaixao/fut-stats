import type { PlayerRound } from '@fut-stats/shared';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRoundDay } from '../../lib/round-format';
import { ResultMark } from '../history/result-mark';
import { formatAverage, RESULT_WORD, roundLancesText } from './ranking-text';

/** Cor do resultado: vitória verde, derrota vermelha, empate neutro (ouro é só do líder). A marca ✓ ✕ = vai junto. */
const TONE: Record<PlayerRound['result'], string> = {
  WIN: 'text-success',
  LOSS: 'text-[#f87171]',
  DRAW: 'text-text',
};

function RoundRow({ round }: { round: PlayerRound }) {
  const score = round.score === null ? null : formatAverage(round.score);
  return (
    <li className="shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none">
      <Link to={`/historico/${round.roundId}`} className="flex flex-col active:bg-highlight">
        <span className="flex min-h-18 items-center gap-3 px-3 py-2">
          <span className={cn('flex w-6 shrink-0 justify-center', TONE[round.result])}>
            <span className="sr-only">{RESULT_WORD[round.result]}</span>
            <ResultMark kind={round.result} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <PixelText wrap>{`Rodada ${round.number}`}</PixelText>
            <PixelText wrap className="text-text-muted">
              {formatRoundDay(round.scheduledAt)}
            </PixelText>
            <span className="text-sm text-text-muted">{roundLancesText(round)}</span>
          </span>
          <span className="flex w-14 shrink-0 flex-col items-end gap-1">
            <PixelText className="text-text-muted">Nota</PixelText>
            {score === null ? (
              <span aria-label="Sem nota" className="h-0.5 w-3 bg-text-muted" />
            ) : (
              <PixelDigits value={score} scale={3} label={`Nota ${score}`} />
            )}
          </span>
        </span>
        {(round.isMvp || round.isFlop) && (
          // Os selos ocupam a linha toda: "PERNA DE PAU" não cabe ao lado da nota em 320 px
          <span className="flex flex-wrap gap-2 px-3 pb-3 pl-12">
            {round.isMvp && <Badge variant="craque" label="Craque" />}
            {round.isFlop && <Badge variant="flop" label="Perna de Pau" />}
          </span>
        )}
      </Link>
    </li>
  );
}

/** "ÚLTIMAS RODADAS": até 5, da mais recente para a mais antiga; cada linha leva ao detalhe no Histórico. */
export function LastRounds({ rounds }: { rounds: readonly PlayerRound[] }) {
  if (rounds.length === 0) return null;
  return (
    <section aria-labelledby="ultimas-rodadas" className="flex flex-col gap-2">
      <h2 id="ultimas-rodadas">
        <PixelText>Últimas rodadas</PixelText>
      </h2>
      <ul className="flex flex-col bg-surface shadow-card">
        {rounds.map((round) => (
          <RoundRow key={round.roundId} round={round} />
        ))}
      </ul>
    </section>
  );
}

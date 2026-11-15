import type { RankingPlayer } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { cn } from '../../lib/cn';
import { Ordinal } from './ordinal';
import { formatAverage, missingRounds, missingRoundsText, trendLabel } from './ranking-text';
import { TrendMark } from './trend-mark';

/**
 * Frase em pixel que quebra por palavra. O `PixelText` com número dentro guarda o resto da frase num trecho que não
 * quebra (`whitespace-pre`) e ele vazava do card em 320 px; aqui cada palavra é uma peça que pode ir para a linha de baixo.
 */
function WrappedPixel({ text }: { text: string }) {
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1">
      <span className="sr-only">{text}</span>
      {text.split(' ').map((word, i) => (
        <span key={i} aria-hidden>
          <PixelText>{word}</PixelText>
        </span>
      ))}
    </p>
  );
}

type YouCardProps = {
  me: RankingPlayer;
  minRatedGames: number;
};

/**
 * "VOCÊ ESTÁ EM 4º": o card de grande momento do topo do Ranking (contorno de 3 px, sombra dura, entrada em degraus).
 * O meu bonequinho, a minha posição em dígitos pixel, a média e a tendência. Quem ainda não entrou vê quantas
 * rodadas faltam. Ouro só se eu for o líder.
 */
export function YouCard({ me, minRatedGames }: YouCardProps) {
  const { rank, trend, stats } = me;
  const leader = rank === 1;
  const missing = missingRounds(minRatedGames, stats.ratedGames);

  return (
    <section
      aria-label={rank === null ? missingRoundsText(missing) : `Você está em ${rank}º`}
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
    >
      <div className="flex items-center gap-4 p-4">
        <span
          aria-hidden
          className="inline-flex size-20 shrink-0 min-[360px]:size-24 items-end justify-center bg-field pb-2 shadow-[inset_0_0_0_3px_#000]"
        >
          <PlayerSprite team={null} avatar={me.avatar} scale={5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {rank === null ? (
            <>
              <WrappedPixel text={missingRoundsText(missing)} />
              <p className="text-sm text-text-muted">{`Você tem ${stats.ratedGames} de ${minRatedGames} rodadas com nota.`}</p>
            </>
          ) : (
            <>
              <PixelText wrap className="text-text-muted">
                Você está em
              </PixelText>
              <span className="flex items-start gap-1" aria-hidden>
                <PixelDigits
                  value={rank}
                  scale={6}
                  decorative
                  className={leader ? 'text-gold' : 'text-text'}
                />
                <Ordinal scale={3} className={cn('mt-1', leader ? 'text-gold' : 'text-text')} />
              </span>
            </>
          )}
        </div>
      </div>
      {rank !== null && stats.average !== null && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 shadow-[inset_0_3px_0_0_var(--color-border-strong)]">
          <span className="flex items-center gap-3">
            <PixelText className="text-text-muted">Média</PixelText>
            <PixelDigits
              value={formatAverage(stats.average)}
              scale={3}
              label={`Média ${formatAverage(stats.average)}`}
              className={leader ? 'text-gold' : 'text-text'}
            />
          </span>
          {trend !== null && (
            <span className="flex items-center gap-2">
              <TrendMark trend={trend} />
              <span aria-hidden className="text-sm text-text-muted">
                {trendLabel(trend)}
              </span>
            </span>
          )}
        </div>
      )}
    </section>
  );
}

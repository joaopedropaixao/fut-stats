import type { RankingPlayer } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { Bump } from '../../components/ui/bump';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { cn } from '../../lib/cn';
import { Medal } from './medal';
import { Ordinal } from './ordinal';
import { PODIUM_TEXT, podiumLabel, podiumTier } from './podium';
import { formatAverage, missingRounds, missingRoundsText, trendLabel } from './ranking-text';
import { RankConfetti } from './rank-confetti';
import { TrendMark } from './trend-mark';
import { useRankReveal } from './use-rank-reveal';

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
  /** Rodadas encerradas do grupo: a animação de subir ou descer toca uma vez por rodada nova. */
  closedRounds: number;
};

/**
 * "VOCÊ ESTÁ EM 4º": o card de grande momento do topo do Ranking (contorno de 3 px, sombra dura, entrada em degraus).
 * O meu bonequinho, a minha posição em dígitos pixel, a média e a tendência. Quem ainda não entrou vê quantas
 * rodadas faltam. Ouro só se eu for o líder.
 */
export function YouCard({ me, minRatedGames, closedRounds }: YouCardProps) {
  const { rank, trend, stats } = me;
  const reveal = useRankReveal({ membershipId: me.membershipId, closedRounds, rank, trend });
  // O pódio segue o número que aparece (na animação, o degrau da vez); o rótulo para leitor de tela é o do final
  const shownRank = reveal.shown ?? rank;
  const tier = podiumTier(shownRank);
  const tone = tier ? PODIUM_TEXT[tier] : 'text-text';
  const missing = missingRounds(minRatedGames, stats.ratedGames);

  return (
    <section
      aria-label={
        rank === null
          ? missingRoundsText(missing)
          : podiumLabel(rank)
            ? `Você está em ${podiumLabel(rank)}`
            : `Você está em ${rank}º`
      }
      style={
        tier
          ? {
              // Moldura do pódio: contorno na cor do degrau e um fio por dentro, na sombra dele
              borderColor: `var(--color-${tier})`,
              boxShadow: `inset 0 0 0 3px var(--color-${tier}-shadow), 4px 4px 0 var(--color-shadow)`,
            }
          : undefined
      }
      className="moment-frame animate-moment-in relative flex flex-col overflow-hidden bg-surface-raised"
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
                <Bump value={shownRank ?? rank} scale={1.25}>
                  <PixelDigits value={shownRank ?? rank} scale={6} decorative className={tone} />
                </Bump>
                <Ordinal scale={3} className={cn('mt-1', tone)} />
                {tier && <Medal tier={tier} scale={4} className="ml-2 mt-1" />}
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
              className={tone}
            />
          </span>
          {trend !== null && (
            <span className="flex items-center gap-2">
              <Bump value={reveal.finished ? 1 : 0} scale={1.6} origin="50% 50%">
                <TrendMark trend={trend} />
              </Bump>
              <span aria-hidden className="text-sm text-text-muted">
                {trendLabel(trend)}
              </span>
            </span>
          )}
        </div>
      )}
      {reveal.celebrate && <RankConfetti />}
    </section>
  );
}

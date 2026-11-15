import { POSITION_LABELS, type RankingPlayer } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { YouTag } from '../lineup/you-tag';
import { MemberAvatar } from '../rounds/member-avatar';
import {
  formatAverage,
  gamesText,
  goalkeeperLines,
  shownRank,
  type RankingTab,
} from './ranking-text';
import { TrendMark } from './trend-mark';

/** Só as primeiras linhas entram em degraus: o resto aparece sem animar. */
const STAGGERED_ROWS = 8;
const STEP_MS = 40;

type RankingRowProps = {
  player: RankingPlayer;
  tab: RankingTab;
  index: number;
  mine: boolean;
};

/**
 * Uma linha do ranking (72 px no mínimo): posição em dígitos pixel, rosto, apelido inteiro, posição e jogos, média e
 * tendência. A linha toda é um link só para a figurinha. Só o líder em ouro; a minha linha leva "VOCÊ" e fundo de
 * destaque. Na aba Goleiros entram os números do gol embaixo.
 */
export function RankingRow({ player, tab, index, mine }: RankingRowProps) {
  const rank = shownRank(player, tab);
  const leader = rank === 1;
  const { average } = player.stats;
  const averageText = average === null ? null : formatAverage(average);
  // Tendência é a do ranking geral: nas outras abas ela confundiria com a posição de dentro da posição
  const trend = tab === 'geral' ? player.trend : null;
  const keeper = tab === 'goleiros';

  return (
    <li
      style={{ '--moment-delay': `${index * STEP_MS}ms` } as CSSProperties}
      className={cn(
        'shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none',
        index < STAGGERED_ROWS && 'animate-row-in',
        mine &&
          'bg-highlight shadow-[inset_0_0_0_2px_var(--color-text)] first:shadow-[inset_0_0_0_2px_var(--color-text)]',
      )}
    >
      <Link
        to={`/jogadores/${player.membershipId}`}
        state={{ fromRanking: true }}
        className="flex flex-col active:bg-highlight"
      >
        <span className="flex min-h-18 items-center gap-1.5 px-2.5 py-2 min-[360px]:gap-2.5 min-[360px]:px-3">
          {/* Largura fixa: as posições alinham entre as linhas, de um e de dois dígitos */}
          <span className="flex w-6.5 shrink-0 justify-center">
            {rank === null ? (
              <>
                <span className="sr-only">Sem posição</span>
                <span aria-hidden className="h-0.5 w-3 bg-text-muted" />
              </>
            ) : (
              <PixelDigits
                value={rank}
                scale={2}
                label={`${rank}º no ranking`}
                className={leader ? 'text-gold' : 'text-text-muted'}
              />
            )}
          </span>
          {/* Em 320 px o rosto de 32 deixa o apelido de 10 letras inteiro; a partir de 360 px, o de 40 */}
          <span className="inline-flex shrink-0 min-[360px]:hidden">
            <MemberAvatar nickname={player.nickname} avatar={player.avatar} size={32} />
          </span>
          <span className="hidden shrink-0 min-[360px]:inline-flex">
            <MemberAvatar nickname={player.nickname} avatar={player.avatar} />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            {mine && (
              <span className="flex">
                <YouTag />
              </span>
            )}
            <PixelText>{player.nickname}</PixelText>
            <span className="flex flex-wrap gap-x-1.5 text-sm text-text-muted">
              <span>{POSITION_LABELS[player.primaryPosition]}</span>
              <span>{`· ${gamesText(player.stats.games)}`}</span>
            </span>
          </span>
          <span className="flex w-12 shrink-0 flex-col items-end gap-1">
            {averageText === null ? (
              <span aria-label="Sem média" className="h-0.5 w-3 bg-text-muted" />
            ) : (
              <PixelDigits
                value={averageText}
                scale={averageText.length > 3 ? 2 : 3}
                label={`Média ${averageText}`}
                className={leader ? 'text-gold' : 'text-text'}
              />
            )}
            {trend !== null && <TrendMark trend={trend} />}
          </span>
        </span>
        {keeper && (
          <span className="flex flex-col gap-1 px-3 pb-3 text-text-muted">
            {goalkeeperLines(player.stats.goalkeeper).map((line) => (
              <PixelText key={line} wrap>
                {line}
              </PixelText>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}

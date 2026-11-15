import {
  TEAM_LABELS,
  type HistoryItem,
  type MatchScore,
  type PlayerAvatar,
} from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { YouTag } from '../lineup/you-tag';
import { detailResultParts, detailResultText, listResultText } from './history-text';
import { ResultMark } from './result-mark';
import { RESULT_TONE } from './result-tone';

type ResultBannerProps = {
  /** Quem vê: o time e o resultado, vindos da API. Nulo = não jogou. */
  me: HistoryItem['me'];
  score: MatchScore;
  /** O meu bonequinho. */
  avatar: PlayerAvatar;
};

/**
 * A faixa do meu resultado no detalhe, no padrão da faixa "Você joga no ..." (anel do meu time, o meu bonequinho
 * e a etiqueta VOCÊ), mas com o resultado dito: "Você venceu 3 a 2 no Branco". Texto e marca, nunca só cor.
 */
export function ResultBanner({ me, score, avatar }: ResultBannerProps) {
  const { kind } = listResultText(me);
  const text = detailResultText(me, score);
  const { headline, line } = detailResultParts(me, score);
  const white = me?.team === 'WHITE';
  return (
    <section
      aria-label={text}
      className={cn(
        'animate-moment-in flex items-center gap-3 bg-surface-3 p-3 [--moment-delay:120ms]',
        !me && 'shadow-[inset_0_0_0_3px_var(--color-border-strong),4px_4px_0_var(--color-shadow)]',
        me &&
          white &&
          'shadow-[inset_0_0_0_3px_var(--color-team-white),4px_4px_0_var(--color-shadow)]',
        me &&
          !white &&
          'shadow-[inset_0_0_0_3px_var(--color-team-black),inset_0_0_0_4px_rgb(255_255_255/35%),4px_4px_0_var(--color-shadow)]',
      )}
    >
      {me && (
        <span
          aria-hidden
          className="inline-flex size-14 shrink-0 items-center justify-center bg-field shadow-[inset_0_0_0_2px_rgb(255_255_255/30%)]"
        >
          <PlayerSprite team={white ? 'white' : 'black'} avatar={avatar} scale={3} />
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <span className={cn('inline-flex items-center gap-2', RESULT_TONE[kind])}>
            <ResultMark kind={kind} />
            <PixelText wrap>{headline}</PixelText>
          </span>
          <PixelText wrap className="text-text">
            {line}
          </PixelText>
        </div>
        {me && (
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={TEAM_LABELS[me.team]} variant={white ? 'white' : 'black'} />
            <YouTag />
          </div>
        )}
      </div>
    </section>
  );
}

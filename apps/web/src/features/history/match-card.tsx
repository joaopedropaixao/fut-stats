import {
  ROUND_STATUS_LABELS,
  TEAM_LABELS,
  type HistoryItem,
  type PlayerAvatar,
} from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { MemberAvatar } from '../rounds/member-avatar';
import { PlayerSprite } from '../../components/ui/pixel-sprite';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRoundDay } from '../../lib/round-format';
import { Scoreboard } from '../match/scoreboard';
import { cardAriaLabel, listResultText } from './history-text';
import { ResultMark } from './result-mark';
import { RESULT_TONE } from './result-tone';

/** Só os primeiros cards entram em degraus: o resto da rolagem aparece sem animar, para a lista não pesar. */
export const STAGGERED_CARDS = 6;
const STEP_MS = 70;

type MatchCardProps = {
  item: HistoryItem;
  /** O meu bonequinho, na faixa do meu resultado. */
  avatar: PlayerAvatar;
  /** A posição do card na lista (decide a entrada em degraus). */
  index: number;
};

/**
 * Uma partida finalizada na lista: grande momento (contorno de 3px, sombra dura, entrada em degraus) com a rodada, a
 * data, o placar e a faixa do meu resultado. O card inteiro é um link só. Quem venceu aparece escrito sob o time,
 * e o meu resultado, escrito com a marca (✓ ✕ =), nunca só cor.
 */
export function MatchCard({ item, avatar, index }: MatchCardProps) {
  const { kind, text } = listResultText(item.me);
  const stage = item.status === 'POST_MATCH' || item.status === 'VOTING';
  return (
    <Link
      to={`/historico/${item.roundId}`}
      aria-label={cardAriaLabel(item)}
      style={{ '--moment-delay': `${index * STEP_MS}ms` } as CSSProperties}
      className={cn(
        'moment-frame flex flex-col bg-surface-raised',
        'active:translate-x-1 active:translate-y-1 active:[box-shadow:0_0_0_var(--color-shadow)]',
        index < STAGGERED_CARDS && 'animate-moment-in',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-3 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        <PixelText className="text-gold">{`Rodada ${item.number}`}</PixelText>
        {stage && <Badge label={ROUND_STATUS_LABELS[item.status]} />}
        <PixelText className="basis-full text-text-muted">
          {formatRoundDay(item.scheduledAt)}
        </PixelText>
      </div>
      <Scoreboard
        status={item.status}
        score={item.score}
        winner={item.winner}
        compact
        bare
        hideStatus
      />
      <div
        className={cn(
          'flex min-h-14 items-center gap-3 px-4 py-2 shadow-[inset_0_3px_0_0_var(--color-border-strong)]',
          RESULT_TONE[kind],
        )}
      >
        {item.me && (
          <span aria-hidden className="inline-flex shrink-0 items-end bg-field p-1 shadow-card">
            <PlayerSprite team={item.me.team === 'WHITE' ? 'white' : 'black'} avatar={avatar} />
          </span>
        )}
        <div className="flex min-w-0 flex-col gap-1">
          <span className="inline-flex items-center gap-2">
            <ResultMark kind={kind} />
            <PixelText wrap>{text}</PixelText>
          </span>
          {item.me && (
            <PixelText className="text-text-muted">{`No ${TEAM_LABELS[item.me.team]}`}</PixelText>
          )}
        </div>
      </div>
      {item.mvps.length > 0 && (
        <ul
          aria-label="Craque da rodada"
          className="flex flex-col gap-2 px-4 py-3 shadow-[inset_0_3px_0_0_var(--color-border-strong)]"
        >
          {item.mvps.map((mvp) => (
            <li key={mvp.membershipId} className="flex min-h-10 items-center gap-3">
              <MemberAvatar nickname={mvp.nickname} avatar={mvp.avatar} size={40} />
              <Badge variant="craque" label="Craque" />
              <PixelText wrap className="min-w-0 text-gold">
                {mvp.nickname}
              </PixelText>
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

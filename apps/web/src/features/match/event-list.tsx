import {
  MATCH_EVENT_TYPE_LABELS,
  TEAM_LABELS,
  type MatchEventItem,
  type MatchView,
} from '@fut-stats/shared';
import { useId } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';

type EventListProps = {
  events: MatchEventItem[];
  score: MatchView['score'];
  onRemove: (event: MatchEventItem) => void;
  removing: boolean;
};

const TEAMS = ['WHITE', 'BLACK'] as const;

/** "2 de 3 gols": quantos gols do time já têm autor, perto do placar dele. Só conta, não decide nada. */
function goalCount(goals: number, scored: number | undefined): string {
  if (scored === undefined) return goals === 1 ? '1 gol' : `${goals} gols`;
  return `${goals} de ${scored} ${scored === 1 ? 'gol' : 'gols'}`;
}

/** Lances por time: quem fez, se foi gol ou assistência e, quando foi outra pessoa, quem lançou. */
export function EventList({ events, score, onRemove, removing }: EventListProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId}>
        <PixelText>Lances</PixelText>
      </h2>
      {TEAMS.map((team) => {
        const list = events.filter((event) => event.team === team);
        const goals = list.filter((event) => event.type === 'GOAL').length;
        const scored = score?.[team];
        const complete = scored !== undefined && goals === scored;
        return (
          <div
            key={team}
            role="group"
            aria-label={`Lances do ${TEAM_LABELS[team]}`}
            className="flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-3">
              <Badge variant={team === 'WHITE' ? 'white' : 'black'} label={TEAM_LABELS[team]} />
              <span className="inline-flex items-center gap-1.5 text-text-muted">
                {complete && (
                  <Icon name="check" size={16} strokeWidth={3} className="text-success" />
                )}
                <PixelText>{goalCount(goals, scored)}</PixelText>
              </span>
            </div>
            <ul className="flex flex-col bg-surface shadow-card">
              {list.length === 0 && (
                <li className="flex min-h-16 items-center px-4 text-sm text-text-muted">
                  Nenhum gol ou assistência lançado ainda.
                </li>
              )}
              {list.map((event, i) => (
                <li
                  key={event.id}
                  className={`flex min-h-16 items-center gap-3 py-2 pr-3 pl-4 ${
                    i > 0 ? 'shadow-[inset_0_2px_0_0_var(--color-border)]' : ''
                  }`}
                >
                  <Avatar
                    nickname={event.nickname}
                    team={team === 'WHITE' ? 'white' : 'black'}
                    size={40}
                    gap="surface"
                  />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <PixelText>{event.nickname}</PixelText>
                    <p className="text-sm text-text-muted">
                      <span className="font-semibold text-text">
                        {MATCH_EVENT_TYPE_LABELS[event.type]}
                      </span>
                      {event.createdById !== event.membershipId &&
                        ` · lançado por ${event.createdByNickname}`}
                    </p>
                  </div>
                  {event.canRemove && (
                    <IconButton
                      icon="trash"
                      label={`Remover ${MATCH_EVENT_TYPE_LABELS[event.type].toLowerCase()} de ${event.nickname}`}
                      disabled={removing}
                      onClick={() => onRemove(event)}
                      className="disabled:bg-surface disabled:text-disabled disabled:shadow-card"
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

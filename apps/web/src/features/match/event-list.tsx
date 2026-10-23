import { MATCH_EVENT_TYPE_LABELS, TEAM_LABELS, type MatchEventItem } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';

type EventListProps = {
  events: MatchEventItem[];
  onRemove: (event: MatchEventItem) => void;
  removing: boolean;
};

/** Lances por time: quem fez, se foi gol ou assistência e quem lançou. */
export function EventList({ events, onRemove, removing }: EventListProps) {
  return (
    <div className="flex flex-col gap-4">
      {(['WHITE', 'BLACK'] as const).map((team) => {
        const list = events.filter((event) => event.team === team);
        return (
          <section
            key={team}
            aria-label={`Lances do ${TEAM_LABELS[team]}`}
            className="flex flex-col gap-2"
          >
            <Badge
              variant={team === 'WHITE' ? 'white' : 'black'}
              label={TEAM_LABELS[team]}
              className="self-start"
            />
            {list.length === 0 ? (
              <p className="bg-surface px-4 py-3 text-sm text-text-muted shadow-card">
                Nenhum lance do {TEAM_LABELS[team]} ainda
              </p>
            ) : (
              <ul className="flex flex-col bg-surface shadow-card">
                {list.map((event, i) => (
                  <li
                    key={event.id}
                    className={`flex items-center gap-3 py-2 pr-2 pl-4 ${
                      i > 0 ? 'shadow-[inset_0_2px_0_0_var(--color-border)]' : ''
                    }`}
                  >
                    <Avatar
                      nickname={event.nickname}
                      team={team === 'WHITE' ? 'white' : 'black'}
                      size={32}
                      gap="surface"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <PixelText>{event.nickname}</PixelText>
                      <p className="text-caption text-text-muted">
                        <span className="font-semibold text-text">
                          {MATCH_EVENT_TYPE_LABELS[event.type]}
                        </span>
                        {' · lançado por '}
                        {event.createdByNickname}
                      </p>
                    </div>
                    {event.canRemove && (
                      <IconButton
                        icon="trash"
                        label={`Remover ${MATCH_EVENT_TYPE_LABELS[event.type].toLowerCase()} de ${event.nickname}`}
                        disabled={removing}
                        onClick={() => onRemove(event)}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

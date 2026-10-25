import {
  MATCH_EVENT_TYPE_LABELS,
  POSITION_LABELS,
  TEAM_LABELS,
  type MatchEventItem,
  type MatchPlayer,
  type MatchView,
} from '@fut-stats/shared';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Bump } from '../../components/ui/bump';
import { IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { TeamSegmented } from '../lineup/team-segmented';
import { goalsOfScore } from './match-text';
import { lastRemovable, ownGoalLabel, ownGoalsFor, playerCounts } from './player-counts';

type Team = 'WHITE' | 'BLACK';
type MatchEventType = MatchEventItem['type'];

type PlayerLinesProps = {
  view: Pick<MatchView, 'players' | 'events' | 'score' | 'tally'>;
  /** Lança um lance do jogador (o toque no +). */
  onLaunch: (player: MatchPlayer, type: MatchEventType) => void;
  /** Apaga um lance (o toque no −, no último daquele tipo do jogador). */
  onRemove: (event: MatchEventItem) => void;
  /** Uma remoção em andamento: o − espera, para não apagar o mesmo lance duas vezes. */
  removing: boolean;
};

/**
 * A Resenha do admin: o time escolhido no seletor, com uma linha por jogador e os contadores de gol e
 * assistência (−/+). A contagem sai dos lances; o − apaga o último lance daquele tipo do jogador. O "⋯" da
 * linha abre o gol contra.
 */
export function PlayerLines({ view, onLaunch, onRemove, removing }: PlayerLinesProps) {
  const [team, setTeam] = useState<Team>('WHITE');
  const headingId = useId();
  const players = view.players.filter((player) => player.team === team);
  const goals = view.tally.goals[team];
  const scored = view.score?.[team];
  const complete = scored !== undefined && goals === scored;
  const ownGoals = ownGoalsFor(view.events, team);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <h2 id={headingId}>
        <PixelText>Lances</PixelText>
      </h2>
      <TeamSegmented value={team} onChange={setTeam} />
      <p role="status" className="flex items-center gap-2 text-text">
        {complete && <Icon name="check" size={18} strokeWidth={3} className="text-success" />}
        <Bump value={`${goals}-${scored}`} scale={1.12} origin="0% 50%">
          <PixelText>{`${TEAM_LABELS[team]} ${goalsOfScore(goals, scored)}`}</PixelText>
        </Bump>
      </p>
      <ul
        key={team}
        aria-label={`Jogadores do ${TEAM_LABELS[team]}`}
        className="flex flex-col bg-surface shadow-card"
      >
        {players.length === 0 && (
          <li className="flex min-h-16 items-center px-4 text-sm text-text-muted">
            Nenhum jogador neste time.
          </li>
        )}
        {players.map((player, i) => (
          <PlayerLine
            key={player.membershipId}
            player={player}
            index={i}
            events={view.events}
            onLaunch={onLaunch}
            onRemove={onRemove}
            removing={removing}
          />
        ))}
      </ul>
      {ownGoals.length > 0 && (
        <ul
          aria-label={`Gols contra a favor do ${TEAM_LABELS[team]}`}
          className="flex flex-col bg-surface shadow-card"
        >
          {ownGoals.map((event, i) => (
            <li
              key={event.id}
              className={cn(
                'animate-row-in flex min-h-14 items-center gap-3 px-4 py-2',
                i > 0 && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
              )}
            >
              <Avatar
                nickname={event.nickname}
                team={event.playerTeam === 'WHITE' ? 'white' : 'black'}
                size={32}
                gap="surface"
              />
              <p className="text-sm text-text-muted">
                <span className="font-semibold text-text">
                  {ownGoalLabel(event.nickname, TEAM_LABELS[event.playerTeam])}
                </span>
                {' · conta para o '}
                {TEAM_LABELS[team]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PlayerLine({
  player,
  index,
  events,
  onLaunch,
  onRemove,
  removing,
}: {
  player: MatchPlayer;
  index: number;
  events: readonly MatchEventItem[];
  onLaunch: PlayerLinesProps['onLaunch'];
  onRemove: PlayerLinesProps['onRemove'];
  removing: boolean;
}) {
  const [menu, setMenu] = useState(false);
  const counts = playerCounts(events, player.membershipId);

  const counter = (type: MatchEventType, label: string) => {
    const last = lastRemovable(events, player.membershipId, type);
    return (
      <Counter
        label={label}
        nickname={player.nickname}
        count={counts[type]}
        canRemove={last !== undefined && !removing}
        onAdd={() => onLaunch(player, type)}
        onRemove={() => last && onRemove(last)}
      />
    );
  };

  return (
    <li
      style={{ '--moment-delay': `${Math.min(index, 6) * 40}ms` } as CSSProperties}
      className={cn(
        'animate-row-in relative flex flex-col gap-3 px-4 py-3',
        index > 0 && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
        menu && 'z-10',
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar
          nickname={player.nickname}
          team={player.team === 'WHITE' ? 'white' : 'black'}
          size={40}
          goalkeeper={player.position === 'GOALKEEPER' && !player.isReserve}
          gap="surface"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <PixelText>{player.nickname}</PixelText>
          <span className="text-sm text-text-muted">
            {player.isReserve ? 'Reserva' : POSITION_LABELS[player.position]}
          </span>
        </div>
        <div className="relative">
          <IconButton
            icon="more"
            label={`Mais lances de ${player.nickname}`}
            aria-expanded={menu}
            aria-haspopup="dialog"
            onClick={() => setMenu((open) => !open)}
          />
          {menu && (
            <OwnGoalMenu
              nickname={player.nickname}
              onClose={() => setMenu(false)}
              counter={counter('OWN_GOAL', MATCH_EVENT_TYPE_LABELS.OWN_GOAL)}
            />
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {counter('GOAL', MATCH_EVENT_TYPE_LABELS.GOAL)}
        {counter('ASSIST', MATCH_EVENT_TYPE_LABELS.ASSIST)}
      </div>
    </li>
  );
}

/** O menu do "⋯": só o gol contra, com o mesmo contador. Esc, o véu e o botão fecham. */
function OwnGoalMenu({
  nickname,
  counter,
  onClose,
}: {
  nickname: string;
  counter: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCloseRef.current();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, []);

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-(--z-nav) cursor-default"
      />
      <div
        ref={ref}
        role="dialog"
        aria-label={`Gol contra de ${nickname}`}
        className="animate-menu-in absolute top-13 right-0 z-(--z-nav) flex w-60 flex-col gap-3 bg-surface-3 p-4 shadow-float"
      >
        {counter}
        <p className="text-sm text-text-muted">O gol contra conta para o adversário.</p>
      </div>
    </>
  );
}

/** GOL [−] n [+]: o rótulo em cima, o contador com o número em dígitos pixel que batem ao mudar. */
function Counter({
  label,
  nickname,
  count,
  canRemove,
  onAdd,
  onRemove,
}: {
  label: string;
  nickname: string;
  count: number;
  canRemove: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const noun = label.toLowerCase();
  return (
    <div role="group" aria-label={`${label} de ${nickname}`} className="flex flex-col gap-1.5">
      <PixelText className="text-text-muted">{label}</PixelText>
      <div className="flex items-center justify-between gap-1">
        <IconButton
          icon="minus"
          label={`Apagar ${noun} de ${nickname}`}
          disabled={!canRemove}
          onClick={onRemove}
          className="disabled:bg-surface disabled:text-disabled disabled:shadow-card"
        />
        <span className="flex min-w-8 justify-center">
          <Bump value={count}>
            <PixelDigits
              value={count}
              scale={3}
              label={`${label}: ${count}`}
              className="text-text"
            />
          </Bump>
        </span>
        <IconButton icon="plus" label={`Lançar ${noun} de ${nickname}`} onClick={onAdd} />
      </div>
    </div>
  );
}

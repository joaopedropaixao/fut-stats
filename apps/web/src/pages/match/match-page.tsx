import {
  MATCH_EVENT_TYPE_LABELS,
  POSITION_LABELS,
  TEAM_LABELS,
  type LaunchableEventType,
  type MatchEventItem,
  type MatchView,
} from '@fut-stats/shared';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ConfirmSheet, Sheet } from '../../components/ui/sheet';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Toast, type ToastData } from '../../components/ui/toast';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { EventList } from '../../features/match/event-list';
import { ScoreStepper, Scoreboard } from '../../features/match/scoreboard';
import { useMatch, useMatchActions } from '../../features/match/use-match';
import { ApiError } from '../../lib/api';

/** Jogo da rodada: placar, lances (gols e assistências) e começar/encerrar o jogo. */
export function MatchPage() {
  const { roundId = '' } = useParams();
  const { group, isPending: groupPending } = useCurrentGroup();

  return (
    <>
      <title>Jogo · Fut Stats</title>
      <div className="flex items-center justify-between gap-3">
        <PixelText as="h1" size={24} wrap className="outline-none">
          Jogo
        </PixelText>
        <Link to={`/rodadas/${roundId}`} className="inline-flex h-11 items-center gap-1 pr-1">
          <Icon name="chevronLeft" size={18} />
          <PixelText>Rodada</PixelText>
        </Link>
      </div>
      {groupPending ? (
        <SkeletonList rows={3} />
      ) : group ? (
        <MatchContent groupId={group.id} roundId={roundId} />
      ) : (
        <EmptyState
          title="Você ainda não está num grupo"
          message="Crie um grupo ou entre por um convite para ver o jogo."
        />
      )}
    </>
  );
}

function failureText(error: unknown): string {
  return error instanceof ApiError && error.body
    ? error.body.message
    : 'Não deu certo. Tente de novo.';
}

function MatchContent({ groupId, roundId }: { groupId: string; roundId: string }) {
  const match = useMatch(groupId, roundId);

  if (match.isPending && match.errorUpdateCount === 0) return <SkeletonList rows={3} />;
  if (!match.data) {
    const notFound = match.error instanceof ApiError && match.error.status === 404;
    return (
      <ErrorState
        title={notFound ? 'Rodada não encontrada' : 'Não deu para abrir o jogo'}
        message={
          notFound
            ? 'Essa rodada não existe neste grupo.'
            : 'Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes.'
        }
        onRetry={notFound ? undefined : () => void match.refetch()}
        retrying={match.isFetching}
      />
    );
  }
  return <MatchBoard groupId={groupId} roundId={roundId} view={match.data} />;
}

type Confirming = 'start' | 'finish' | null;

function MatchBoard({
  groupId,
  roundId,
  view,
}: {
  groupId: string;
  roundId: string;
  view: MatchView;
}) {
  const actions = useMatchActions(groupId, roundId);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [picking, setPicking] = useState<LaunchableEventType | null>(null);
  const dismissToast = useCallback(() => setToast(null), []);

  const fail = (error: unknown) => setToast({ kind: 'error', text: failureText(error) });
  const { isAdmin, membershipId } = view.me;
  const me = view.players.find((player) => player.membershipId === membershipId);

  function launch(playerId: string, type: LaunchableEventType, nickname: string) {
    actions.launchEvent.mutate(
      { membershipId: playerId, type },
      {
        onSuccess: () =>
          setToast({ text: `${MATCH_EVENT_TYPE_LABELS[type]} de ${nickname} lançado` }),
        onError: fail,
      },
    );
  }

  function remove(event: MatchEventItem) {
    actions.removeEvent.mutate(event.id, {
      onSuccess: () =>
        setToast({
          text: `${MATCH_EVENT_TYPE_LABELS[event.type]} de ${event.nickname} removido`,
          action: {
            label: 'Desfazer',
            onClick: () => launch(event.membershipId, event.type, event.nickname),
          },
        }),
      onError: fail,
    });
  }

  function changeStatus(to: 'IN_PROGRESS' | 'VOTING') {
    actions.changeStatus.mutate(
      { to },
      {
        onSuccess: () => {
          setConfirming(null);
          setToast({ text: to === 'IN_PROGRESS' ? 'O jogo começou' : 'O jogo foi encerrado' });
        },
        onError: (error) => {
          setConfirming(null);
          fail(error);
        },
      },
    );
  }

  const next = view.next;
  const notStarted = view.status === 'SCHEDULED' || view.status === 'TEAMS_PUBLISHED';

  return (
    <>
      {notStarted ? (
        <EmptyState
          title={
            view.status === 'SCHEDULED'
              ? 'Os times ainda não foram publicados'
              : 'O jogo ainda não começou'
          }
          message={
            view.status === 'SCHEDULED'
              ? 'Quando o admin publicar os times e começar o jogo, o placar aparece aqui.'
              : 'Quando o admin começar o jogo, o placar e os lances aparecem aqui.'
          }
        />
      ) : (
        <>
          <Scoreboard status={view.status} score={view.score} />
          {isAdmin && view.isOpen && (
            <ScoreStepper
              score={view.score}
              busy={actions.setScore.isPending}
              onChange={(score) => actions.setScore.mutate(score, { onError: fail })}
            />
          )}
          <EventList
            events={view.events}
            onRemove={remove}
            removing={actions.removeEvent.isPending}
          />
          {view.isOpen && (isAdmin || me) && (
            <section aria-label="Lançar" className="flex flex-col gap-3">
              {isAdmin ? (
                <>
                  <Button
                    variant="outline"
                    icon="plus"
                    label="Lançar gol"
                    block
                    onClick={() => setPicking('GOAL')}
                  />
                  <Button
                    variant="outline"
                    icon="plus"
                    label="Lançar assistência"
                    block
                    onClick={() => setPicking('ASSIST')}
                  />
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    icon="plus"
                    label="Meu gol"
                    block
                    loading={
                      actions.launchEvent.isPending &&
                      actions.launchEvent.variables?.type === 'GOAL'
                    }
                    disabled={actions.launchEvent.isPending}
                    onClick={() => launch(membershipId, 'GOAL', me?.nickname ?? '')}
                  />
                  <Button
                    variant="outline"
                    icon="plus"
                    label="Minha assistência"
                    block
                    loading={
                      actions.launchEvent.isPending &&
                      actions.launchEvent.variables?.type === 'ASSIST'
                    }
                    disabled={actions.launchEvent.isPending}
                    onClick={() => launch(membershipId, 'ASSIST', me?.nickname ?? '')}
                  />
                </>
              )}
            </section>
          )}
        </>
      )}

      {isAdmin && next && (
        <div className="flex flex-col gap-2">
          <Button
            label={next.to === 'IN_PROGRESS' ? 'Começar jogo' : 'Encerrar jogo'}
            block
            disabled={!next.allowed}
            onClick={() => setConfirming(next.to === 'IN_PROGRESS' ? 'start' : 'finish')}
          />
          {next.reason && <p className="text-sm text-text-muted">{next.reason}</p>}
        </div>
      )}

      <ConfirmSheet
        open={confirming === 'start'}
        title="Começar o jogo?"
        message="O placar e os lances passam a valer. Quem jogou pode lançar os próprios gols e assistências."
        confirmLabel="Começar"
        loading={actions.changeStatus.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => changeStatus('IN_PROGRESS')}
      />
      <ConfirmSheet
        open={confirming === 'finish'}
        title="Encerrar o jogo?"
        message="O jogo vai para a votação. Dá para corrigir o placar e os lances até a rodada ser encerrada."
        confirmLabel="Encerrar"
        loading={actions.changeStatus.isPending}
        onClose={() => setConfirming(null)}
        onConfirm={() => changeStatus('VOTING')}
      />
      <Sheet
        open={picking !== null}
        title={picking === 'ASSIST' ? 'Quem deu a assistência?' : 'Quem fez o gol?'}
        onClose={() => setPicking(null)}
      >
        {picking && (
          <PlayerPicker
            players={view.players}
            onPick={(player) => {
              setPicking(null);
              launch(player.membershipId, picking, player.nickname);
            }}
          />
        )}
      </Sheet>
      {toast && <Toast data={toast} onDismiss={dismissToast} />}
    </>
  );
}

function PlayerPicker({
  players,
  onPick,
}: {
  players: MatchView['players'];
  onPick: (player: MatchView['players'][number]) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {(['WHITE', 'BLACK'] as const).map((team) => (
        <div key={team} className="flex flex-col gap-2">
          <Badge
            variant={team === 'WHITE' ? 'white' : 'black'}
            label={TEAM_LABELS[team]}
            className="self-start"
          />
          <ul className="flex flex-col gap-2">
            {players
              .filter((player) => player.team === team)
              .map((player) => (
                <li key={player.membershipId}>
                  <button
                    type="button"
                    onClick={() => onPick(player)}
                    className="flex h-14 w-full items-center gap-3 bg-surface px-4 text-left shadow-card active:bg-highlight"
                  >
                    <Avatar
                      nickname={player.nickname}
                      team={team === 'WHITE' ? 'white' : 'black'}
                      size={32}
                      gap="surface"
                    />
                    <PixelText className="flex-1">{player.nickname}</PixelText>
                    <span className="text-caption text-text-muted">
                      {player.isReserve ? 'Reserva' : POSITION_LABELS[player.position]}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

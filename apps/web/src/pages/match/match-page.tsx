import {
  MATCH_EVENT_TYPE_LABELS,
  type LaunchableEventType,
  type MatchEventItem,
  type MatchView,
} from '@fut-stats/shared';
import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ConfirmSheet, Sheet } from '../../components/ui/sheet';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Toast, type ToastData } from '../../components/ui/toast';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { EventList } from '../../features/match/event-list';
import { PlayerPicker } from '../../features/match/player-picker';
import { Scoreboard } from '../../features/match/scoreboard';
import { useMatch, useMatchActions } from '../../features/match/use-match';
import { ApiError } from '../../lib/api';

/** Jogo da rodada: placar, lances (gols e assistências) e começar/encerrar o jogo. */
export function MatchPage() {
  const { roundId = '' } = useParams();
  const { group, isPending: groupPending } = useCurrentGroup();

  return (
    <>
      <title>Jogo · Fut Stats</title>
      <div className="-mt-2 flex items-center gap-1">
        <Link
          to={`/rodadas/${roundId}`}
          aria-label="Voltar para a rodada"
          className="-ml-3 inline-flex size-11 shrink-0 items-center justify-center"
        >
          <Icon name="chevronLeft" size={22} />
        </Link>
        <PixelText as="h1" size={24} className="outline-none">
          Jogo
        </PixelText>
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
    : 'Não deu certo. Confira a internet e tente de novo.';
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
            ? 'Essa rodada não existe neste grupo. Volte e escolha outra.'
            : 'Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes.'
        }
        onRetry={notFound ? undefined : () => void match.refetch()}
        retrying={match.isFetching}
      />
    );
  }
  return <MatchBoard groupId={groupId} roundId={roundId} view={match.data} />;
}

/** Antes do jogo: o que falta, dito para quem está vendo (o admin faz; o jogador espera). */
function notStartedText(status: 'SCHEDULED' | 'TEAMS_PUBLISHED', isAdmin: boolean) {
  if (status === 'SCHEDULED') {
    return {
      title: 'Os times ainda não saíram',
      message: isAdmin
        ? 'Monte e publique os times da rodada. Depois é só começar o jogo aqui.'
        : 'Quando o admin publicar os times e começar o jogo, o placar aparece aqui.',
    };
  }
  return {
    title: 'A bola ainda não rolou',
    message: isAdmin
      ? 'Comece o jogo quando a bola rolar: o placar e os lances passam a valer.'
      : 'Quando o admin começar o jogo, o placar e os lances aparecem aqui.',
  };
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
  const notStarted =
    view.status === 'SCHEDULED' || view.status === 'TEAMS_PUBLISHED'
      ? notStartedText(view.status, isAdmin)
      : null;
  const launching = (type: LaunchableEventType) =>
    actions.launchEvent.isPending && actions.launchEvent.variables?.type === type;

  return (
    <>
      {notStarted ? (
        <EmptyState title={notStarted.title} message={notStarted.message} />
      ) : (
        <>
          <Scoreboard
            status={view.status}
            score={view.score}
            scheduledAt={view.scheduledAt}
            editor={
              isAdmin && view.isOpen
                ? {
                    busy: actions.setScore.isPending,
                    onChange: (score) => actions.setScore.mutate(score, { onError: fail }),
                  }
                : undefined
            }
          />
          {view.isOpen && isAdmin && (
            <section aria-label="Lançar lance" className="flex flex-col gap-3">
              <Button
                variant="secondary"
                icon="plus"
                label="Lançar gol"
                block
                onClick={() => setPicking('GOAL')}
              />
              <Button
                variant="secondary"
                icon="plus"
                label="Lançar assistência"
                block
                onClick={() => setPicking('ASSIST')}
              />
            </section>
          )}
          {view.isOpen && !isAdmin && me && (
            <section aria-label="Lançar o meu lance" className="flex flex-col gap-3">
              <Button
                variant="secondary"
                icon="plus"
                label="Meu gol"
                block
                loading={launching('GOAL')}
                disabled={actions.launchEvent.isPending && !launching('GOAL')}
                onClick={() => launch(membershipId, 'GOAL', me.nickname)}
              />
              <Button
                variant="secondary"
                icon="plus"
                label="Minha assistência"
                block
                loading={launching('ASSIST')}
                disabled={actions.launchEvent.isPending && !launching('ASSIST')}
                onClick={() => launch(membershipId, 'ASSIST', me.nickname)}
              />
            </section>
          )}
          {view.isOpen && !isAdmin && !me && (
            <p className="text-sm text-text-muted">
              Você não jogou esta rodada: dá para acompanhar o placar e os lances por aqui.
            </p>
          )}
          <EventList
            events={view.events}
            score={view.score}
            onRemove={remove}
            removing={actions.removeEvent.isPending}
          />
        </>
      )}

      {isAdmin && next && (
        <div className="flex flex-col gap-3">
          <Button
            label={next.to === 'IN_PROGRESS' ? 'Começar jogo' : 'Encerrar jogo'}
            block
            disabled={!next.allowed}
            onClick={() => setConfirming(next.to === 'IN_PROGRESS' ? 'start' : 'finish')}
          />
          {next.reason && (
            <p className="flex gap-2 text-sm text-text-muted">
              <Icon name="alert" size={18} className="mt-px shrink-0 text-warning" />
              {next.reason}
            </p>
          )}
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

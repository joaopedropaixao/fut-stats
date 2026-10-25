import {
  MATCH_EVENT_TYPE_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  type LaunchMatchEventInput,
  type MatchEventItem,
  type MatchView,
} from '@fut-stats/shared';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { Sheet } from '../../components/ui/sheet';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useNotice } from '../../components/ui/use-notice';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RoundHeading } from '../../features/lineup/round-heading';
import { EventList } from '../../features/match/event-list';
import { PlayerPicker } from '../../features/match/player-picker';
import { useMatch, useMatchActions } from '../../features/match/queries';
import { ResultCard } from '../../features/match/result-card';
import { hasSeenResult } from '../../features/match/result-seen';
import { ScoreStepper, Scoreboard } from '../../features/match/scoreboard';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError, apiErrorMessage } from '../../lib/api';

/** /rodadas/:roundId/jogo: placar e lances; começar, finalizar e abrir a votação (admin); a Resenha dos jogadores. */
export function MatchPage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string | undefined }) {
  const match = useMatch(groupId, roundId);

  return (
    <>
      <RouteButton
        to={roundId ? `/rodadas/${roundId}` : '/rodadas'}
        label="Rodada"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <RoundHeading
        title={match.data?.status === 'POST_MATCH' ? 'Resenha pós-jogo' : 'Jogo'}
        round={match.data && { ...match.data, location: null }}
      />
      {match.isError ? (
        match.error instanceof ApiError && match.error.status === 404 ? (
          <ErrorState
            title="Rodada não encontrada"
            message="Essa rodada não existe neste grupo. Confira o link ou volte para as rodadas."
          />
        ) : (
          <ErrorState
            title="Não deu para abrir o jogo"
            message="Confira a internet e tente de novo."
            onRetry={() => void match.refetch()}
            retrying={match.isFetching}
          />
        )
      ) : !match.data ? (
        <SkeletonList rows={3} label="Carregando o jogo" />
      ) : (
        <Board groupId={groupId} view={match.data} />
      )}
    </>
  );
}

type Confirming = 'start' | 'finish' | 'voting' | null;
type EventType = LaunchMatchEventInput['type'];

const OWN_KEYS: { type: EventType; label: string }[] = [
  { type: 'GOAL', label: 'Meu gol' },
  { type: 'ASSIST', label: 'Minha assistência' },
  { type: 'OWN_GOAL', label: 'Meu gol contra' },
];
const ANY_KEYS: { type: EventType; label: string }[] = [
  { type: 'GOAL', label: 'Gol' },
  { type: 'ASSIST', label: 'Assistência' },
  { type: 'OWN_GOAL', label: 'Gol contra' },
];
const PICKER_TITLES: Record<EventType, string> = {
  GOAL: 'Quem fez o gol?',
  ASSIST: 'Quem deu a assistência?',
  OWN_GOAL: 'Quem fez o gol contra?',
};

function Board({ groupId, view }: { groupId: string; view: MatchView }) {
  const actions = useMatchActions(groupId, view.roundId);
  const notice = useNotice();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [picking, setPicking] = useState<EventType | null>(null);
  const { permissions, me } = view;
  const started = view.status !== 'SCHEDULED' && view.status !== 'TEAMS_PUBLISHED';

  const fail = (error: unknown) =>
    notice.show({
      kind: 'error',
      title: 'Não deu certo',
      message: apiErrorMessage(error, 'Confira a internet e tente de novo.'),
    });

  function launch(input: LaunchMatchEventInput, who: string) {
    actions.launch.mutate(input, {
      onSuccess: () =>
        notice.show({
          kind: 'success',
          title: `${MATCH_EVENT_TYPE_LABELS[input.type]} ${who} lançado`,
        }),
      onError: fail,
    });
  }

  function remove(event: MatchEventItem) {
    actions.remove.mutate(event.id, {
      onSuccess: () =>
        notice.show({
          kind: 'success',
          title: `${MATCH_EVENT_TYPE_LABELS[event.type]} de ${event.nickname} apagado`,
          onUndo: () =>
            launch({ membershipId: event.membershipId, type: event.type }, `de ${event.nickname}`),
        }),
      onError: fail,
    });
  }

  const launching = (type: EventType) =>
    actions.launch.isPending && actions.launch.variables?.type === type;

  return (
    <div className="flex flex-col gap-6">
      {!started ? (
        <BeforeMatch view={view} onStart={() => setConfirming('start')} />
      ) : (
        <>
          {me.result && view.score && me.team && (
            <ResultMoment
              roundId={view.roundId}
              result={me.result}
              score={view.score}
              myTeam={me.team}
            />
          )}
          <Scoreboard
            status={view.status}
            score={view.score}
            editor={
              permissions.setScore
                ? {
                    busy: actions.setScore.isPending,
                    onChange: (score) => actions.setScore.mutate(score, { onError: fail }),
                  }
                : undefined
            }
          />
          {view.status === 'VOTING' || view.status === 'CLOSED' ? (
            <Note icon="lock">
              {view.status === 'VOTING'
                ? 'A votação está aberta. O placar e os lances não mudam mais.'
                : 'A rodada foi encerrada. O placar e os lances não mudam mais.'}
            </Note>
          ) : permissions.launchAny || permissions.launchOwn ? (
            <section aria-label="Lançar lance" className="flex flex-col gap-3">
              {(permissions.launchAny ? ANY_KEYS : OWN_KEYS).map((key) => (
                <Button
                  key={key.type}
                  variant="secondary"
                  icon="plus"
                  label={key.label}
                  block
                  loading={launching(key.type)}
                  disabled={actions.launch.isPending && !launching(key.type)}
                  onClick={() =>
                    permissions.launchAny
                      ? setPicking(key.type)
                      : launch({ membershipId: me.membershipId, type: key.type }, 'seu')
                  }
                />
              ))}
              {!permissions.launchAny && (
                <p className="text-sm text-text-muted">
                  Lance só os seus gols, assistências e gols contra. Eles não passam do placar.
                </p>
              )}
            </section>
          ) : view.status === 'IN_PROGRESS' ? (
            <Note icon="alert">
              {me.team
                ? 'Seus lances entram na Resenha, depois do jogo.'
                : 'Você não jogou esta rodada: dá para acompanhar o placar e os lances por aqui.'}
            </Note>
          ) : null}
          <EventList view={view} onRemove={remove} removing={actions.remove.isPending} />
          {permissions.finish && (
            <Button
              label="Finalizar jogo"
              icon="check"
              block
              onClick={() => setConfirming('finish')}
            />
          )}
          {permissions.openVoting && (
            <div className="flex flex-col gap-3">
              <Button
                label="Abrir votação"
                block
                disabled={view.errors.length > 0}
                onClick={() => setConfirming('voting')}
              />
              <Reasons errors={view.errors} />
            </div>
          )}
        </>
      )}

      {confirming === 'start' && (
        <ConfirmSheet
          title="Começar o jogo?"
          message="O placar e os lances passam a valer. Durante o jogo, só você lança os lances."
          confirmLabel="Começar jogo"
          loading={actions.start.isPending}
          error={actions.start.error}
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            actions.start.mutate(undefined, { onSuccess: () => setConfirming(null) })
          }
        />
      )}
      {confirming === 'voting' && (
        <ConfirmSheet
          title="Abrir a votação?"
          message="O placar e os lances ficam congelados. Quem jogou passa a votar nas notas."
          confirmLabel="Abrir votação"
          loading={actions.openVoting.isPending}
          error={actions.openVoting.error}
          onClose={() => setConfirming(null)}
          onConfirm={() =>
            actions.openVoting.mutate(undefined, { onSuccess: () => setConfirming(null) })
          }
        />
      )}
      {confirming === 'finish' && (
        <FinishSheet
          view={view}
          loading={actions.finish.isPending}
          error={actions.finish.error}
          onClose={() => setConfirming(null)}
          onConfirm={(score) =>
            actions.finish.mutate(score, { onSuccess: () => setConfirming(null) })
          }
        />
      )}
      {picking && (
        <Sheet
          title={PICKER_TITLES[picking]}
          onClose={() => setPicking(null)}
          actions={
            <Button
              variant="outline"
              size={52}
              label="Voltar"
              className="flex-1"
              onClick={() => setPicking(null)}
            />
          }
        >
          <PlayerPicker
            players={view.players}
            onPick={(player) => {
              setPicking(null);
              launch({ membershipId: player.membershipId, type: picking }, `de ${player.nickname}`);
            }}
          />
        </Sheet>
      )}
      {notice.node}
    </div>
  );
}

/** O card de resultado toca uma vez por rodada: o que o navegador lembrou vale na hora em que ele entra. */
function ResultMoment(props: ComponentProps<typeof ResultCard>) {
  const [show] = useState(() => !hasSeenResult(props.roundId));
  return show ? <ResultCard {...props} /> : null;
}

function Note({ icon, children }: { icon: 'lock' | 'alert'; children: ReactNode }) {
  return (
    <p role="status" className="flex gap-3 bg-surface p-4 text-sm text-text-muted shadow-card">
      <Icon name={icon} size={18} className="mt-px shrink-0" />
      {children}
    </p>
  );
}

/** Por que o admin ainda não pode dar o próximo passo (textos do shared). */
function Reasons({ errors }: { errors: MatchView['errors'] }) {
  if (errors.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {errors.map((code) => (
        <li key={code} className="flex gap-2 text-sm text-text-muted">
          <Icon name="alert" size={18} className="mt-px shrink-0 text-warning" />
          {ROUND_TRANSITION_ERROR_LABELS[code]}.
        </li>
      ))}
    </ul>
  );
}

function BeforeMatch({ view, onStart }: { view: MatchView; onStart: () => void }) {
  if (view.permissions.start) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          title="A bola ainda não rolou"
          message="Comece o jogo quando a bola rolar. O placar e os lances passam a valer."
        />
        <Button label="Começar jogo" block disabled={view.errors.length > 0} onClick={onStart} />
        <Reasons errors={view.errors} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <EmptyState
        title="O jogo ainda não começou"
        message={
          view.me.isAdmin
            ? 'Monte e publique os times da rodada. Depois é só começar o jogo aqui.'
            : 'Quando o admin publicar os times e começar o jogo, o placar aparece aqui.'
        }
      />
      <RouteButton
        to={`/rodadas/${view.roundId}/times`}
        label={view.me.isAdmin ? 'Montar times' : 'Ver times'}
        variant="outline"
        size={48}
        block
      />
    </div>
  );
}

function SheetError({ error }: { error: unknown }) {
  return (
    <div className="pt-3">
      <ErrorState
        title="Não deu certo"
        message={apiErrorMessage(error, 'Falha de conexão. Tente de novo.')}
      />
    </div>
  );
}

function ConfirmSheet({
  title,
  message,
  confirmLabel,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" size={52} label="Voltar" className="flex-1" onClick={onClose} />
          <Button
            size={52}
            label={confirmLabel}
            className="flex-1"
            loading={loading}
            onClick={onConfirm}
          />
        </>
      }
    >
      <p>{message}</p>
      {error != null && <SheetError error={error} />}
    </Sheet>
  );
}

/** Finalizar: o placar final nos −/+, partindo do placar lançado ou dos gols já lançados. */
function FinishSheet({
  view,
  loading,
  error,
  onClose,
  onConfirm,
}: {
  view: MatchView;
  loading: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: (score: { WHITE: number; BLACK: number }) => void;
}) {
  const [score, setScore] = useState(view.score ?? view.tally.goals);
  return (
    <Sheet
      title="Finalizar o jogo?"
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" size={52} label="Voltar" className="flex-1" onClick={onClose} />
          <Button
            size={52}
            label="Finalizar"
            className="flex-1"
            loading={loading}
            onClick={() => onConfirm(score)}
          />
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>Informe o placar final. Depois, a turma lança os próprios lances na Resenha.</p>
        <ScoreStepper value={score} onChange={setScore} />
        <p className="text-sm">
          {`Gols lançados até aqui: Branco ${view.tally.goals.WHITE}, Preto ${view.tally.goals.BLACK}.`}
        </p>
        {error != null && <SheetError error={error} />}
      </div>
    </Sheet>
  );
}

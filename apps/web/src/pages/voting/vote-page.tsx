import { VOTING_ERROR_LABELS, type VotingView } from '@fut-stats/shared';
import { useEffect, useReducer, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { useNotice } from '../../components/ui/use-notice';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RoundHeading } from '../../features/lineup/round-heading';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError, apiErrorMessage } from '../../lib/api';
import { AdminBlock } from '../../features/voting/admin-block';
import { closesInLabel } from '../../features/voting/deadline';
import { Meter } from '../../features/voting/meter';
import { MyVotes } from '../../features/voting/my-votes';
import { PickStep } from '../../features/voting/pick-step';
import { useVoting, useVotingActions } from '../../features/voting/queries';
import { RatingStep } from '../../features/voting/rating-step';
import { ReviewStep } from '../../features/voting/review-step';
import { SentCard } from '../../features/voting/sent-card';
import { useCountdown } from '../../features/voting/use-countdown';
import { VoteClosed } from '../../features/voting/vote-closed';
import { clearDraft, loadDraft, saveDraft } from '../../features/voting/vote-draft';
import {
  currentTargetId,
  flowReducer,
  initFlow,
  openAt,
  ratedCount,
  toSubmit,
} from '../../features/voting/vote-flow';

/** /rodadas/:roundId/votar: dar as notas, escolher o Craque e o Perna de Pau, enviar e editar até fechar. */
export function VotePage() {
  const { roundId } = useParams();
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Content groupId={group.id} roundId={roundId} />;
}

function Content({ groupId, roundId }: { groupId: string; roundId: string | undefined }) {
  const voting = useVoting(groupId, roundId);
  const view = voting.data;

  return (
    <>
      <RouteButton
        to="/"
        label="Início"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <RoundHeading title="Votação" round={view && { ...view, location: null }} />
      {voting.isError && !view ? (
        voting.error instanceof ApiError && voting.error.status === 404 ? (
          <ErrorState
            title="Rodada não encontrada"
            message="Essa rodada não existe neste grupo. Confira o link ou volte para o início."
          />
        ) : (
          <ErrorState
            title="Não deu para abrir a votação"
            message="Confira a internet e tente de novo."
            onRetry={() => void voting.refetch()}
            retrying={voting.isFetching}
          />
        )
      ) : !view ? (
        <SkeletonList rows={3} label="Carregando a votação" />
      ) : (
        <Loaded groupId={groupId} view={view} updatedAt={voting.dataUpdatedAt} />
      )}
    </>
  );
}

function Loaded({
  groupId,
  view,
  updatedAt,
}: {
  groupId: string;
  view: VotingView;
  updatedAt: number;
}) {
  const navigate = useNavigate();
  const notice = useNotice();
  const actions = useVotingActions(groupId, view.roundId);
  const remaining = useCountdown(view, updatedAt);
  const [closedHere, setClosedHere] = useState(false);
  const [editing, setEditing] = useState<'review' | 'mvp' | 'flop' | null>(null);
  const [sent, setSent] = useState(false);
  const closed = closedHere || view.status === 'CLOSED';
  const open = view.status === 'VOTING' && !closed;

  // Fechou: o rascunho não vale mais (o voto não entra), em qualquer caminho até aqui
  useEffect(() => {
    if (closed) clearDraft(view.roundId, view.me.membershipId);
  }, [closed, view.roundId, view.me.membershipId]);

  const fail = (error: unknown) =>
    notice.show({
      kind: 'error',
      title: 'Não deu certo',
      message: apiErrorMessage(error, 'Confira a internet e tente de novo.'),
    });

  async function closeVoting() {
    try {
      await actions.close.mutateAsync();
      void navigate(`/rodadas/${view.roundId}/resultado`);
    } catch (error) {
      fail(error);
    }
  }

  if (closed) {
    return <VoteClosed roundId={view.roundId} resultReady />;
  }
  if (!open) {
    return (
      <div className="flex flex-col gap-3">
        <ErrorState
          title={VOTING_ERROR_LABELS.VOTING_NOT_OPEN}
          message="Quando o admin abrir, você dá as notas por aqui."
        />
        <RouteButton
          to={`/rodadas/${view.roundId}`}
          label="Ver a rodada"
          variant="outline"
          size={48}
          block
        />
      </div>
    );
  }

  let body;
  if (!view.me.played) {
    body = <NotPlayed view={view} remaining={remaining} />;
  } else if (sent) {
    body = (
      <SentCard
        view={view}
        remaining={remaining}
        onEdit={() => {
          setSent(false);
          setEditing('review');
        }}
      />
    );
  } else if (view.me.vote && editing === null) {
    body = <MyVotes view={view} remaining={remaining} onEdit={setEditing} />;
  } else {
    body = (
      <VoteFlow
        groupId={groupId}
        view={view}
        startAt={editing}
        onClosed={() => setClosedHere(true)}
        onSent={(wasEdit) => {
          setEditing(null);
          if (wasEdit) notice.show({ kind: 'success', title: 'Votos atualizados' });
          else setSent(true);
        }}
        onCancelEdit={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 pb-4">
      {body}
      {(view.permissions.close || (view.pending?.length ?? 0) > 0) && (
        <AdminBlock
          pending={view.pending}
          canClose={view.permissions.close}
          onClose={() => void closeVoting()}
          closing={actions.close.isPending}
        />
      )}
      {notice.node}
    </div>
  );
}

/** Quem não jogou: vê que há votação, o medidor e o prazo, sem o fluxo de notas. */
function NotPlayed({ view, remaining }: { view: VotingView; remaining: number | null }) {
  return (
    <section
      aria-label="Votação aberta"
      className="moment-frame animate-moment-in flex flex-col gap-4 bg-surface-raised p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="inline-flex items-center gap-2 text-warning">
          <Icon name="urn" size={22} />
          <PixelText>Votação aberta</PixelText>
        </span>
        {remaining !== null && <Badge variant="deadline" label={closesInLabel(remaining)} />}
      </div>
      <Meter voted={view.progress.voted} total={view.progress.total} showMissing />
      <p className="text-sm text-text-muted">Só quem jogou vota. O resultado sai quando fechar.</p>
      <RouteButton to="/" variant="outline" size={52} label="Voltar para o início" block />
    </section>
  );
}

type FlowProps = {
  groupId: string;
  view: VotingView;
  /** Passo de abertura ao editar o voto enviado; `null` = primeiro voto. */
  startAt: 'review' | 'mvp' | 'flop' | null;
  onSent: (wasEdit: boolean) => void;
  onClosed: () => void;
  onCancelEdit: () => void;
};

/** O fluxo de votar: um reducer puro (`vote-flow.ts`) e o rascunho no aparelho para quem fecha o app no meio. */
function VoteFlow({ groupId, view, startAt, onSent, onClosed, onCancelEdit }: FlowProps) {
  const { roundId } = view;
  const membershipId = view.me.membershipId;
  const targets = view.players.filter((p) => p.membershipId !== membershipId);
  const actions = useVotingActions(groupId, roundId);
  const [state, dispatch] = useReducer(flowReducer, undefined, () => {
    const targetIds = targets.map((p) => p.membershipId);
    if (view.me.vote) return openAt(initFlow(targetIds, view.me.vote), startAt ?? 'review');
    return loadDraft(roundId, membershipId, targetIds) ?? initFlow(targetIds);
  });
  const [error, setError] = useState<unknown>(null);
  const editing = view.me.vote !== null;

  // O rascunho só vale para o primeiro voto; quem edita parte do voto enviado
  useEffect(() => {
    if (!editing) saveDraft(roundId, membershipId, state);
  }, [editing, roundId, membershipId, state]);

  const current = targets[state.index];
  const pickable = targets;

  async function send() {
    const input = toSubmit(state);
    if (!input) return;
    setError(null);
    try {
      await actions.submit.mutateAsync(input);
      clearDraft(roundId, membershipId);
      onSent(editing);
    } catch (e) {
      if (e instanceof ApiError && e.body?.code === 'VOTING_CLOSED') {
        clearDraft(roundId, membershipId);
        onClosed();
      } else {
        setError(e);
      }
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {editing && state.step === 'review' && (
        <button
          type="button"
          onClick={onCancelEdit}
          className="inline-flex min-h-11 items-center gap-1 self-start"
        >
          <Icon name="chevronLeft" size={18} />
          <PixelText>Seus votos</PixelText>
        </button>
      )}
      {state.step === 'rate' && current && (
        <RatingStep
          player={current}
          index={state.index}
          total={targets.length}
          ratedCount={ratedCount(state)}
          value={state.ratings[currentTargetId(state) ?? ''] ?? null}
          backToReview={state.backToReview}
          onRate={(value) => dispatch({ type: 'rate', targetId: current.membershipId, value })}
          onNext={() => dispatch({ type: 'next' })}
          onPrevious={() => dispatch({ type: 'previous' })}
        />
      )}
      {state.step === 'review' && (
        <ReviewStep
          players={targets}
          ratings={state.ratings}
          onEdit={(index) => dispatch({ type: 'edit', index })}
          onContinue={() => dispatch({ type: 'toVote' })}
        />
      )}
      {state.step === 'mvp' && (
        <PickStep
          kind="mvp"
          players={pickable}
          chosenId={state.mvpId}
          onPick={(id) => dispatch({ type: 'pickMvp', id })}
          onBack={() => dispatch({ type: 'back' })}
          onNext={() => dispatch({ type: 'forward' })}
        />
      )}
      {state.step === 'flop' && (
        <>
          <PickStep
            kind="flop"
            players={pickable}
            chosenId={state.flopId}
            lockedId={state.mvpId}
            sending={actions.submit.isPending}
            onPick={(id) => dispatch({ type: 'pickFlop', id })}
            onBack={() => dispatch({ type: 'back' })}
            onNext={() => void send()}
          />
          {error !== null && (
            <ErrorState
              title="Não deu para enviar os votos"
              message={apiErrorMessage(
                error,
                'Confira a internet e tente de novo. Nada se perdeu.',
              )}
              onRetry={() => void send()}
              retrying={actions.submit.isPending}
            />
          )}
        </>
      )}
    </div>
  );
}

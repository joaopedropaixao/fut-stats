import {
  ROUND_STATUS_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  type LaunchMatchEventInput,
  type MatchEventItem,
  type MatchScore,
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
import { eventNoticeTitle } from '../../features/match/match-text';
import { PlayerLines } from '../../features/match/player-lines';
import { useMatch, useMatchActions } from '../../features/match/queries';
import { ResultCard } from '../../features/match/result-card';
import { hasSeenResult } from '../../features/match/result-seen';
import { ScoreStepper, Scoreboard } from '../../features/match/scoreboard';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError, apiErrorMessage } from '../../lib/api';

/**
 * /rodadas/:roundId/jogo: em jogo, o placar (o admin finaliza com ele); na Resenha, os lances (o admin por jogador,
 * cada jogador os seus); o admin começa, finaliza e abre a votação.
 */
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
        title={match.data?.status === 'POST_MATCH' ? ROUND_STATUS_LABELS.POST_MATCH : 'Jogo'}
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

function Board({ groupId, view }: { groupId: string; view: MatchView }) {
  const actions = useMatchActions(groupId, view.roundId);
  const notice = useNotice();
  const [confirming, setConfirming] = useState<Confirming>(null);
  const { permissions, me } = view;
  const started = view.status !== 'SCHEDULED' && view.status !== 'TEAMS_PUBLISHED';
  const frozen = view.status === 'VOTING' || view.status === 'CLOSED';

  const fail = (error: unknown) =>
    notice.show({
      kind: 'error',
      title: 'Não deu certo',
      message: apiErrorMessage(error, 'Confira a internet e tente de novo.'),
    });

  // mutateAsync (e não os callbacks do mutate): toques seguidos no + não perdem o aviso nem o erro de nenhum
  async function launch(input: LaunchMatchEventInput, nickname: string | null) {
    try {
      const next = await actions.launch.mutateAsync(input);
      // O lance novo é o último desse jogador e tipo, na ordem de lançamento
      const created = next.events.findLast(
        (e) => e.membershipId === input.membershipId && e.type === input.type,
      );
      notice.show({
        kind: 'success',
        title: eventNoticeTitle(input.type, nickname, 'launched'),
        onUndo: created ? () => void actions.remove.mutateAsync(created.id).catch(fail) : undefined,
      });
    } catch (error) {
      fail(error);
    }
  }

  async function remove(event: MatchEventItem) {
    // O próprio lance fala em primeira pessoa, como ao lançar ("Sua assistência apagada")
    const who = event.membershipId === me.membershipId ? null : event.nickname;
    try {
      await actions.remove.mutateAsync(event.id);
      notice.show({
        kind: 'success',
        title: eventNoticeTitle(event.type, who, 'removed'),
        onUndo: () => void launch({ membershipId: event.membershipId, type: event.type }, who),
      });
    } catch (error) {
      fail(error);
    }
  }

  const launching = (type: EventType) =>
    actions.launch.isPending && actions.launch.variables?.type === type;

  return (
    <div className="flex flex-col gap-6 pb-4">
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
              // O placar se corrige na Resenha; em jogo ele só sai no "Finalizar jogo"
              permissions.setScore && view.status === 'POST_MATCH'
                ? {
                    busy: actions.setScore.isPending,
                    onChange: (score) => actions.setScore.mutate(score, { onError: fail }),
                  }
                : undefined
            }
          />
          {view.status === 'IN_PROGRESS' && (
            <>
              <Note icon="alert">
                {permissions.finish
                  ? 'Os lances entram na Resenha, depois do jogo. Quando o jogo acabar, finalize com o placar.'
                  : me.team
                    ? 'Seus lances entram na Resenha, depois do jogo.'
                    : 'Você não jogou esta rodada: dá para acompanhar o placar por aqui.'}
              </Note>
              {permissions.finish && (
                <Button
                  label="Finalizar jogo"
                  icon="check"
                  block
                  loading={actions.finish.isPending}
                  onClick={() => setConfirming('finish')}
                />
              )}
            </>
          )}
          {frozen && (
            <>
              <Note icon="lock">
                {view.status === 'VOTING'
                  ? 'A votação está aberta. O placar e os lances não mudam mais.'
                  : 'A rodada foi encerrada. O placar e os lances não mudam mais.'}
              </Note>
              <EventList view={view} onRemove={(event) => void remove(event)} removing />
            </>
          )}
          {view.status === 'POST_MATCH' && (
            <>
              {permissions.launchAny ? (
                <PlayerLines
                  view={view}
                  onLaunch={(player, type) =>
                    void launch({ membershipId: player.membershipId, type }, player.nickname)
                  }
                  onRemove={(event) => void remove(event)}
                  removing={actions.remove.isPending}
                />
              ) : (
                <>
                  {permissions.launchOwn && (
                    <section aria-label="Lançar lance" className="flex flex-col gap-3">
                      {OWN_KEYS.map((key) => (
                        <Button
                          key={key.type}
                          variant="secondary"
                          icon="plus"
                          label={key.label}
                          block
                          loading={launching(key.type)}
                          disabled={actions.launch.isPending && !launching(key.type)}
                          onClick={() =>
                            void launch({ membershipId: me.membershipId, type: key.type }, null)
                          }
                        />
                      ))}
                      <p className="text-sm text-text-muted">
                        Lance só os seus gols, assistências e gols contra. Os gols não passam do
                        placar.
                      </p>
                    </section>
                  )}
                  <EventList
                    view={view}
                    onRemove={(event) => void remove(event)}
                    removing={actions.remove.isPending}
                  />
                </>
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
        </>
      )}

      {confirming === 'start' && (
        <ConfirmSheet
          title="Começar o jogo?"
          message="A bola rola. No fim, você informa o placar e a turma lança os gols e assistências na Resenha."
          confirmLabel="Começar jogo"
          onClose={() => setConfirming(null)}
          onConfirm={() => void actions.start.mutateAsync().catch(fail)}
        />
      )}
      {confirming === 'voting' && (
        <ConfirmSheet
          title="Abrir a votação?"
          message="O placar e os lances ficam congelados. Quem jogou passa a votar nas notas."
          confirmLabel="Abrir votação"
          onClose={() => setConfirming(null)}
          onConfirm={() => void actions.openVoting.mutateAsync().catch(fail)}
        />
      )}
      {confirming === 'finish' && (
        <FinishSheet
          view={view}
          onClose={() => setConfirming(null)}
          onConfirm={(score) => void actions.finish.mutateAsync(score).catch(fail)}
        />
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
    <p
      role="status"
      className="animate-row-in flex gap-3 bg-surface p-4 text-sm text-text-muted shadow-card"
    >
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
          message="Comece o jogo quando a bola rolar. No fim, você informa o placar e a turma lança os lances na Resenha."
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
            : view.status === 'TEAMS_PUBLISHED'
              ? 'Os times já saíram. Quando o admin começar o jogo, o placar aparece aqui.'
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

function ConfirmSheet({
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet
      title={title}
      onClose={onClose}
      actions={(close) => (
        <>
          <Button variant="outline" size={52} label="Voltar" className="flex-1" onClick={close} />
          <Button
            size={52}
            label={confirmLabel}
            className="flex-1"
            // Fecha na hora e deixa a chamada seguir: o erro, se vier, aparece no aviso
            onClick={() => {
              onConfirm();
              close();
            }}
          />
        </>
      )}
    >
      <p>{message}</p>
    </Sheet>
  );
}

/** Finalizar: o placar final nos −/+, começando em 0 x 0. Qualquer placar vale; os lances vêm na Resenha. */
function FinishSheet({
  view,
  onClose,
  onConfirm,
}: {
  view: MatchView;
  onClose: () => void;
  onConfirm: (score: MatchScore) => void;
}) {
  const [score, setScore] = useState<MatchScore>(view.score ?? { WHITE: 0, BLACK: 0 });
  return (
    <Sheet
      title="Finalizar o jogo?"
      onClose={onClose}
      actions={(close) => (
        <>
          <Button variant="outline" size={52} label="Voltar" className="flex-1" onClick={close} />
          <Button
            size={52}
            label="Finalizar"
            className="flex-1"
            onClick={() => {
              onConfirm(score);
              close();
            }}
          />
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <p>Informe o placar final. Depois, os gols e as assistências entram na Resenha.</p>
        <ScoreStepper value={score} onChange={setScore} />
      </div>
    </Sheet>
  );
}

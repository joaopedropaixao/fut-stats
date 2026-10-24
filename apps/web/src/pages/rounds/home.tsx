import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { Badge } from '../../components/ui/badge';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRespondedAt } from '../../lib/round-format';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { MyPresence } from '../../features/rounds/my-presence';
import { useRound, useRounds } from '../../features/rounds/queries';
import { RoundWhen } from '../../features/rounds/round-when';
import { RouteButton } from '../../features/rounds/route-button';
import { usePresence } from '../../features/rounds/use-presence';
import { MemberAvatar } from '../../features/rounds/member-avatar';
import { PresenceTally } from '../../features/rounds/presence-tally';
import { POSITION_LABELS, type RoundDetail } from '@fut-stats/shared';

/** Início (aba Feed, versão Fase 1): a próxima rodada e a presença. Sem grupo, o shell manda para /comecar. */
export function HomePage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Home groupId={group.id} isAdmin={group.role === 'ADMIN'} />;
}

function Home({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const rounds = useRounds(groupId);
  // A rodada da vez vem da API (pickCurrentRound): em jogo, senão a próxima
  const all = rounds.data ? [...rounds.data.upcoming, ...rounds.data.past] : [];
  const current = all.find((r) => r.id === rounds.data?.currentId) ?? null;
  const nextId = current?.id;
  const next = useRound(groupId, nextId);

  return (
    <>
      <title>Início · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        {current?.status === 'IN_PROGRESS' ? 'Em jogo' : 'Próxima rodada'}
      </PixelText>
      {rounds.isError || next.isError ? (
        <ErrorState
          title="Não deu para carregar a rodada"
          message="Confira a internet e tente de novo."
          onRetry={() => void (rounds.isError ? rounds.refetch() : next.refetch())}
          retrying={rounds.isFetching || next.isFetching}
        />
      ) : rounds.isPending || (nextId !== undefined && !next.data) ? (
        <SkeletonList rows={3} label="Carregando a rodada" />
      ) : next.data ? (
        <NextRound groupId={groupId} round={next.data} isAdmin={isAdmin} />
      ) : (
        <Empty isAdmin={isAdmin} />
      )}
    </>
  );
}

function Empty({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        title="Nenhuma rodada marcada"
        message={
          isAdmin
            ? 'Marque o dia e o local para o grupo confirmar presença.'
            : 'Quando o admin marcar a próxima, ela aparece aqui.'
        }
      />
      {isAdmin && <RouteButton to="/rodadas/nova" label="Criar rodada" icon="plus" block />}
      <RouteButton to="/rodadas" label="Ver rodadas passadas" variant="outline" size={48} block />
    </div>
  );
}

function NextRound({
  groupId,
  round,
  isAdmin,
}: {
  groupId: string;
  round: RoundDetail;
  isAdmin: boolean;
}) {
  const presence = usePresence(groupId, round);
  const going = round.attendance.confirmed;
  const set = (confirmed: boolean) => presence.setAttendance(round.myMembershipId, confirmed);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-5 bg-surface-raised p-5 shadow-card">
        <RoundWhen
          number={round.number}
          scheduledAt={round.scheduledAt}
          location={round.location}
        />
        <MyPresence round={round} onChange={set} />
        <div className="shadow-[inset_0_2px_0_0_var(--color-border)] pt-5">
          <PresenceTally round={round} />
        </div>
      </div>

      <section className="flex flex-col gap-2">
        <h2>
          <PixelText>{`Quem vai · ${round.confirmedCount}`}</PixelText>
        </h2>
        {going.length === 0 ? (
          <p className="px-1 text-sm text-text-muted">Ninguém confirmou ainda. Seja o primeiro.</p>
        ) : (
          <ul className="flex flex-col bg-surface shadow-card">
            {going.map((m, i) => {
              const me = m.membershipId === round.myMembershipId;
              return (
                <li
                  key={m.membershipId}
                  className={cn(
                    'flex min-h-18 items-center gap-2.5 px-3 py-2 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none',
                    me && 'bg-success/8',
                  )}
                >
                  <MemberAvatar nickname={m.nickname} goalkeeper={m.isHiredGoalkeeper} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-center gap-2">
                      <PixelText>{m.nickname}</PixelText>
                      {me && <Badge label="Você" />}
                    </span>
                    <PixelText className="text-text-muted">
                      {POSITION_LABELS[m.primaryPosition]}
                    </PixelText>
                  </div>
                  {/* Ordem de chegada (a lista de chamada) e a hora em que confirmou */}
                  <div className="flex w-14 shrink-0 flex-col items-end gap-1.5">
                    <PixelDigits
                      value={i + 1}
                      scale={2}
                      label={`${i + 1}º a confirmar`}
                      className={i === 0 ? 'text-gold' : 'text-text'}
                    />
                    {m.respondedAt && (
                      <PixelText className="text-text-muted">
                        {formatRespondedAt(m.respondedAt)}
                      </PixelText>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col gap-3">
        <RouteButton
          to={`/rodadas/${round.id}`}
          label={isAdmin ? 'Administrar rodada' : 'Ver rodada'}
          variant="outline"
          size={48}
          block
        />
        <RouteButton to="/rodadas" label="Todas as rodadas" variant="outline" size={48} block />
        {isAdmin && (
          <RouteButton
            to="/rodadas/nova"
            label="Nova rodada"
            icon="plus"
            variant="outline"
            size={48}
            block
          />
        )}
      </div>
      {presence.notice}
    </div>
  );
}

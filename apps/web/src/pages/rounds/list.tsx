import { ROUND_STATUS_LABELS, type RoundSummary } from '@fut-stats/shared';
import { Link } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { useRounds } from '../../features/rounds/queries';
import { RouteButton } from '../../features/rounds/route-button';
import { formatRoundWhen } from '../../lib/round-format';

/** Lista de rodadas do grupo: as próximas (mais perto primeiro) e as passadas (mais recente primeiro). */
export function RoundsPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Rounds groupId={group.id} isAdmin={group.role === 'ADMIN'} />;
}

function Rounds({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const rounds = useRounds(groupId);
  const { data } = rounds;
  const empty = data && data.upcoming.length === 0 && data.past.length === 0;

  return (
    <>
      <title>Rodadas · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Rodadas
      </PixelText>
      {isAdmin && <RouteButton to="/rodadas/nova" label="Nova rodada" icon="plus" block />}
      {rounds.isError ? (
        <ErrorState
          title="Não deu para carregar as rodadas"
          message="Confira a internet e tente de novo."
          onRetry={() => void rounds.refetch()}
          retrying={rounds.isFetching}
        />
      ) : !data ? (
        <SkeletonList rows={4} label="Carregando as rodadas" />
      ) : empty ? (
        <EmptyState
          title="Nenhuma rodada ainda"
          message={
            isAdmin
              ? 'Crie a primeira para o grupo confirmar presença.'
              : 'Quando o admin marcar uma rodada, ela aparece aqui.'
          }
        />
      ) : (
        <>
          <Section title="Próximas" rounds={data.upcoming} empty="Nenhuma rodada marcada." />
          <Section title="Passadas" rounds={data.past} empty="Nenhuma rodada passada." />
        </>
      )}
    </>
  );
}

function Section({
  title,
  rounds,
  empty,
}: {
  title: string;
  rounds: RoundSummary[];
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2>
        <PixelText>{`${title} · ${rounds.length}`}</PixelText>
      </h2>
      {rounds.length === 0 ? (
        <p className="px-1 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col bg-surface shadow-card">
          {rounds.map((round) => (
            <li
              key={round.id}
              className="shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none"
            >
              <Link
                to={`/rodadas/${round.id}`}
                className="flex min-h-20 items-center gap-3 px-4 py-3 active:bg-highlight"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <PixelText>{formatRoundWhen(round.scheduledAt)}</PixelText>
                  <PixelText className="text-text-muted">
                    {round.location ?? 'Local a combinar'}
                  </PixelText>
                  <div className="flex items-center gap-2">
                    <Badge label={ROUND_STATUS_LABELS[round.status]} />
                    <PixelText className="text-text-muted">{`${round.confirmedCount} vão`}</PixelText>
                  </div>
                </div>
                <Icon name="chevronRight" size={22} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

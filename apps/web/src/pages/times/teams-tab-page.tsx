import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { PublishedTeams } from '../../features/lineup/published-teams';
import { useLineup } from '../../features/lineup/queries';
import { RoundHeading } from '../../features/lineup/round-heading';
import { useRounds } from '../../features/rounds/queries';
import { RouteButton } from '../../features/rounds/route-button';

/** Aba Times: os times publicados da rodada atual, para todo o grupo. Sem grupo, o shell manda para /comecar. */
export function TeamsTabPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return (
    <CurrentTeams
      groupId={group.id}
      isAdmin={group.role === 'ADMIN'}
      myMembershipId={group.membershipId}
    />
  );
}

function CurrentTeams({
  groupId,
  isAdmin,
  myMembershipId,
}: {
  groupId: string;
  isAdmin: boolean;
  myMembershipId: string;
}) {
  const rounds = useRounds(groupId);
  // A rodada da vez vem da API (pickCurrentRound), a mesma do início
  const all = rounds.data ? [...rounds.data.upcoming, ...rounds.data.past] : [];
  const round = all.find((r) => r.id === rounds.data?.currentId) ?? null;
  const lineup = useLineup(groupId, round?.id);

  return (
    <>
      <RoundHeading title="Times" round={round ?? undefined} />
      {rounds.isError || lineup.isError ? (
        <ErrorState
          title="Não deu para abrir os times"
          message="Confira a internet e tente de novo."
          onRetry={() => {
            void rounds.refetch();
            if (round) void lineup.refetch();
          }}
          retrying={rounds.isFetching || lineup.isFetching}
        />
      ) : rounds.isPending || (round && !lineup.data) ? (
        <SkeletonList rows={3} label="Carregando os times" />
      ) : !round ? (
        <>
          <EmptyState
            title="Nenhuma rodada marcada"
            message={
              isAdmin
                ? 'Marque a próxima rodada; quando o grupo confirmar, você monta Branco x Preto aqui.'
                : 'Quando o admin marcar a próxima rodada e publicar os times, Branco x Preto aparece aqui.'
            }
          />
          {isAdmin && <RouteButton to="/rodadas/nova" label="Criar rodada" icon="plus" block />}
        </>
      ) : lineup.data?.published ? (
        <>
          <PublishedTeams lineup={lineup.data} roundId={round.id} myMembershipId={myMembershipId} />
          {isAdmin && lineup.data.permissions.unpublish && (
            <RouteButton
              to={`/rodadas/${round.id}/times`}
              label="Ajustar times"
              icon="pencil"
              variant="outline"
              size={52}
              block
            />
          )}
        </>
      ) : (
        <>
          <EmptyState
            title="Times ainda não saíram"
            message={
              isAdmin
                ? 'Monte Branco x Preto com quem confirmou e publique para o grupo ver.'
                : 'Assim que o admin publicar, você vê aqui em que time vai jogar.'
            }
          />
          {isAdmin && <RouteButton to={`/rodadas/${round.id}/times`} label="Montar times" block />}
        </>
      )}
    </>
  );
}

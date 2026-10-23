import type { Lineup, RoundSummary } from '@fut-stats/shared';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { PublishedTeams } from '../../features/lineup/published-teams';
import { NoGroup } from '../../features/lineup/no-group';
import { useLineup, useNextRound } from '../../features/lineup/queries';
import { RoundHeading } from '../../features/lineup/round-heading';
import { RouterButtonLink } from '../../features/lineup/router-button-link';

/** Aba Times: os times publicados da próxima rodada, para todo o grupo. */
export function TeamsTabPage() {
  // O AppShell só mostra a tela com a sessão carregada: sem grupo aqui é estar fora de qualquer pelada
  const { group } = useCurrentGroup();
  if (!group) {
    return (
      <>
        <RoundHeading title="Times" />
        <NoGroup />
      </>
    );
  }
  return <NextRoundTeams groupId={group.id} isAdmin={group.role === 'ADMIN'} />;
}

function NextRoundTeams({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const next = useNextRound(groupId);
  const round = next.data;
  const lineup = useLineup(groupId, round?.id ?? '', { enabled: Boolean(round) });
  const heading = <RoundHeading title="Times" round={round ?? undefined} />;

  if (next.isError || lineup.isError) {
    return (
      <>
        {heading}
        <ErrorState
          title="Não deu para abrir os times"
          message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
          onRetry={() => {
            void next.refetch();
            if (round) void lineup.refetch();
          }}
          retrying={next.isFetching || lineup.isFetching}
        />
      </>
    );
  }
  if (next.isPending || (round && lineup.isPending)) {
    return (
      <>
        {heading}
        <SkeletonList rows={3} label="Carregando os times" />
      </>
    );
  }

  if (!round) {
    return (
      <>
        {heading}
        <EmptyState
          title="Nenhuma rodada marcada"
          message={
            isAdmin
              ? 'Marque a próxima rodada; quando a galera confirmar, você monta Branco x Preto aqui.'
              : 'Quando o admin marcar a próxima rodada e publicar os times, Branco x Preto aparece aqui.'
          }
        />
        {isAdmin && (
          <RouterButtonLink
            to="/rodadas/nova"
            variant="outline"
            size={52}
            label="Marcar rodada"
            block
          />
        )}
      </>
    );
  }

  return (
    <>
      {heading}
      {lineup.data?.published ? (
        <Published round={round} isAdmin={isAdmin} lineup={lineup.data} />
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
          {isAdmin && (
            <RouterButtonLink to={`/rodadas/${round.id}/times`} label="Montar times" block />
          )}
        </>
      )}
    </>
  );
}

function Published({
  round,
  isAdmin,
  lineup,
}: {
  round: RoundSummary;
  isAdmin: boolean;
  lineup: Lineup;
}) {
  return (
    <>
      <PublishedTeams lineup={lineup} />
      {isAdmin && round.status === 'TEAMS_PUBLISHED' && (
        <RouterButtonLink
          to={`/rodadas/${round.id}/times`}
          variant="outline"
          size={52}
          icon="pencil"
          label="Ajustar times"
          block
        />
      )}
    </>
  );
}

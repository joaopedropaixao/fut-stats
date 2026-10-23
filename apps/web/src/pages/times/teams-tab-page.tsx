import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { formatRoundDate } from '../../features/lineup/format-round-date';
import { PublishedTeams } from '../../features/lineup/published-teams';
import { useLineup, useNextRound } from '../../features/lineup/queries';
import { RouterButtonLink } from '../../features/lineup/router-button-link';

/** Aba Times: os times publicados da próxima rodada, para todo o grupo. */
export function TeamsTabPage() {
  const { group } = useCurrentGroup();
  return (
    <>
      <PixelText as="h1" size={24} wrap>
        Times
      </PixelText>
      <title>Times · Fut Stats</title>
      {group ? (
        <NextRoundTeams groupId={group.id} isAdmin={group.role === 'ADMIN'} />
      ) : (
        <SkeletonList rows={3} />
      )}
    </>
  );
}

function NextRoundTeams({ groupId, isAdmin }: { groupId: string; isAdmin: boolean }) {
  const next = useNextRound(groupId);
  const round = next.data;
  const lineup = useLineup(groupId, round?.id ?? '', { enabled: Boolean(round) });

  if (next.isError || lineup.isError) {
    return (
      <ErrorState
        title="Não deu para abrir os times"
        message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
        onRetry={() => {
          void next.refetch();
          void lineup.refetch();
        }}
        retrying={next.isFetching || lineup.isFetching}
      />
    );
  }
  if (next.isPending || (round && lineup.isPending))
    return <SkeletonList rows={3} label="Carregando os times" />;

  if (!round) {
    return (
      <>
        <EmptyState
          title="Nenhuma rodada marcada"
          message="Quando houver uma próxima rodada, os times aparecem aqui."
        />
        {isAdmin && (
          <RouterButtonLink
            to="/rodadas/nova"
            variant="outline"
            size={48}
            label="Marcar rodada"
            block
          />
        )}
      </>
    );
  }
  if (!lineup.data?.published) {
    return (
      <>
        <PixelText className="text-text-muted">{formatRoundDate(round.scheduledAt)}</PixelText>
        <EmptyState
          title="Times ainda não saíram"
          message={
            isAdmin
              ? 'Monte Branco x Preto e publique para o grupo ver.'
              : 'Assim que o admin publicar, Branco x Preto aparece aqui.'
          }
        />
        {isAdmin && (
          <RouterButtonLink
            to={`/rodadas/${round.id}/times`}
            label="Montar times"
            size={48}
            block
          />
        )}
      </>
    );
  }
  return (
    <>
      <PixelText className="text-text-muted">{formatRoundDate(round.scheduledAt)}</PixelText>
      <PublishedTeams lineup={lineup.data} />
      {isAdmin && round.status === 'TEAMS_PUBLISHED' && (
        <RouterButtonLink
          to={`/rodadas/${round.id}/times`}
          variant="outline"
          size={48}
          label="Ajustar times"
          block
        />
      )}
    </>
  );
}

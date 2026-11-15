import { POSITION_LABELS } from '@fut-stats/shared';
import { useSearchParams } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { useRanking } from '../../features/ranking/queries';
import { RankingList } from '../../features/ranking/ranking-list';
import {
  FIELD_POSITIONS,
  parseRankingView,
  RANKING_TABS,
  RANKING_TAB_LABELS,
  rankingSearch,
  type FieldPosition,
  type RankingTab,
} from '../../features/ranking/ranking-text';
import { Segmented } from '../../features/ranking/segmented';
import { YouCard } from '../../features/ranking/you-card';

const TAB_OPTIONS = RANKING_TABS.map((value) => ({ value, label: RANKING_TAB_LABELS[value] }));
const POSITION_OPTIONS = FIELD_POSITIONS.map((value) => ({
  value,
  label: POSITION_LABELS[value],
}));

/** /ranking: quem está jogando mais. O "VOCÊ ESTÁ EM Nº" no topo e, embaixo, Geral, Posição ou Goleiros. */
export function RankingPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <Ranking groupId={group.id} />;
}

function Ranking({ groupId }: { groupId: string }) {
  const ranking = useRanking(groupId);
  const [params, setParams] = useSearchParams();
  const data = ranking.data;
  const me = data?.players.find((p) => p.membershipId === data.me.membershipId);
  const { tab, position } = parseRankingView(params, me?.primaryPosition);

  // A aba fica na URL: o voltar do navegador (e voltar da figurinha) reabre a mesma aba
  const go = (nextTab: RankingTab, nextPosition: FieldPosition) =>
    setParams(new URLSearchParams(rankingSearch(nextTab, nextPosition)));

  return (
    <>
      <title>Ranking · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Ranking
      </PixelText>
      {ranking.isError && !data ? (
        <ErrorState
          title="Não deu para carregar o ranking"
          message="Confira a internet e tente de novo."
          onRetry={() => void ranking.refetch()}
          retrying={ranking.isFetching}
        />
      ) : !data ? (
        <SkeletonList rows={5} label="Carregando o ranking" />
      ) : data.closedRounds === 0 ? (
        <EmptyState
          title="Ranking vazio"
          message="O ranking começa quando a primeira votação fechar."
        />
      ) : (
        <>
          {me && (
            <YouCard me={me} minRatedGames={data.minRatedGames} closedRounds={data.closedRounds} />
          )}
          <div className="flex flex-col gap-3">
            <Segmented
              label="Ranking"
              options={TAB_OPTIONS}
              value={tab}
              onChange={(next) => go(next, position)}
              className="flex [&>*]:flex-auto"
            />
            {tab === 'posicao' && (
              <Segmented
                label="Posição"
                options={POSITION_OPTIONS}
                value={position}
                onChange={(next) => go('posicao', next)}
                className="grid grid-cols-2 min-[560px]:grid-cols-4"
              />
            )}
          </div>
          <RankingList ranking={data} tab={tab} position={position} />
        </>
      )}
    </>
  );
}

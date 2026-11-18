import { useCurrentGroup } from '../group/use-current-group';
import { useRounds } from '../rounds/queries';
import { pickLiveRoundIds } from './pick-live-rounds';
import { usePageVisible } from './use-page-visible';
import { useRoundStream } from './use-round-stream';

/** Uma conexão: existe enquanto a rodada merece canal. */
function RoundStream({ groupId, roundId }: { groupId: string; roundId: string }) {
  useRoundStream(groupId, roundId);
  return null;
}

function GroupStreams({ groupId }: { groupId: string }) {
  const rounds = useRounds(groupId);
  const visible = usePageVisible();
  if (!visible) return null;
  return pickLiveRoundIds(rounds.data).map((roundId) => (
    <RoundStream key={`${groupId}:${roundId}`} groupId={groupId} roundId={roundId} />
  ));
}

/**
 * Mantém o canal ao vivo aberto para a rodada da vez e para a rodada em votação (no máximo duas conexões), só em
 * etapa ao vivo e com a aba à vista. Montado no AppShell: início, jogo e votação ficam ao vivo com a mesma conexão.
 * Não desenha nada.
 */
export function LiveRounds() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  return <GroupStreams key={group.id} groupId={group.id} />;
}

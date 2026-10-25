import type { MatchEventItem } from '@fut-stats/shared';

type MatchEventType = MatchEventItem['type'];

type Counted = Pick<MatchEventItem, 'membershipId' | 'type' | 'canRemove'>;

/** Quantos lances de cada tipo o jogador tem. A contagem sai dos lances (`events`), em ordem de lançamento. */
export function playerCounts(
  events: readonly Pick<MatchEventItem, 'membershipId' | 'type'>[],
  membershipId: string,
): Record<MatchEventType, number> {
  const counts: Record<MatchEventType, number> = { GOAL: 0, ASSIST: 0, OWN_GOAL: 0 };
  for (const event of events) {
    if (event.membershipId === membershipId) counts[event.type] += 1;
  }
  return counts;
}

/** O último lance daquele tipo do jogador que quem vê pode apagar (o − do contador). `undefined` = nenhum. */
export function lastRemovable<T extends Counted>(
  events: readonly T[],
  membershipId: string,
  type: MatchEventType,
): T | undefined {
  return events.findLast(
    (event) => event.membershipId === membershipId && event.type === type && event.canRemove,
  );
}

type OwnGoalFor = Pick<MatchEventItem, 'type' | 'team' | 'playerTeam' | 'nickname'>;

/** Gols contra a favor do time: o lance é de um jogador do adversário, mas o gol conta para este time. */
export function ownGoalsFor<T extends OwnGoalFor>(
  events: readonly T[],
  team: MatchEventItem['team'],
): T[] {
  return events.filter((event) => event.type === 'OWN_GOAL' && event.team === team);
}

/** "Gol contra de Diegão (Branco)": quem fez o gol contra e o time dele. */
export function ownGoalLabel(nickname: string, playerTeamLabel: string): string {
  return `Gol contra de ${nickname} (${playerTeamLabel})`;
}

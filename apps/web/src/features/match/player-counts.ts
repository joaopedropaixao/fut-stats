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

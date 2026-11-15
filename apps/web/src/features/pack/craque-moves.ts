import type { MatchEventItem } from '@fut-stats/shared';

/** Os lances do Craque na partida: só gols e assistências (gol contra não conta), na ordem em que foram lançados. */
export function craqueMoves(
  events: readonly MatchEventItem[],
  membershipId: string,
): MatchEventItem[] {
  return events.filter((e) => e.membershipId === membershipId && e.type !== 'OWN_GOAL');
}

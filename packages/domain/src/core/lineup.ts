import { FORMATION, PLAYERS_PER_TEAM } from './formation';
import { POSITIONS, type Position } from './position';
import type { Team } from './team';

/** Um jogador escalado numa posição. */
export interface LineupSlot {
  playerId: string;
  position: Position;
}

/** Escalação de um time. */
export type TeamLineup = readonly LineupSlot[];

/** Escalação completa de uma rodada: Branco x Preto. */
export type RoundLineup = Readonly<Record<Team, TeamLineup>>;

/** Conta quantos jogadores há em cada posição. */
export function countByPosition(lineup: TeamLineup): Record<Position, number> {
  const counts = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<Position, number>;
  for (const slot of lineup) counts[slot.position] += 1;
  return counts;
}

/** True se o time segue exatamente a formação 1-2-3-1, sem jogador repetido. */
export function matchesFormation(lineup: TeamLineup): boolean {
  if (lineup.length !== PLAYERS_PER_TEAM) return false;
  if (new Set(lineup.map((s) => s.playerId)).size !== lineup.length) return false;

  const counts = countByPosition(lineup);
  return POSITIONS.every((p) => counts[p] === FORMATION[p]);
}

/** True se os dois times seguem a formação e nenhum jogador está nos dois. */
export function isValidRoundLineup(round: RoundLineup): boolean {
  if (!matchesFormation(round.WHITE) || !matchesFormation(round.BLACK)) return false;

  const white = new Set(round.WHITE.map((s) => s.playerId));
  return round.BLACK.every((s) => !white.has(s.playerId));
}

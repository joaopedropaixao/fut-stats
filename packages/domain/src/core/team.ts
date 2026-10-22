/** Os dois times de toda rodada: Branco x Preto. */
export const TEAMS = ['WHITE', 'BLACK'] as const;

export type Team = (typeof TEAMS)[number];

export function opponentOf(team: Team): Team {
  return team === 'WHITE' ? 'BLACK' : 'WHITE';
}

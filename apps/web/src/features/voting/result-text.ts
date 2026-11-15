import type { ResultPlayer } from '@fut-stats/shared';

/** "2 GOLS · 1 AST": o que o jogador fez na rodada (só o que tem). Vazio quando não fez nada. */
export function statsText(player: Pick<ResultPlayer, 'goals' | 'assists' | 'ownGoals'>): string {
  const parts: string[] = [];
  if (player.goals > 0) parts.push(`${player.goals} ${player.goals === 1 ? 'gol' : 'gols'}`);
  if (player.assists > 0) parts.push(`${player.assists} ast`);
  if (player.ownGoals > 0) {
    parts.push(`${player.ownGoals} ${player.ownGoals === 1 ? 'gol contra' : 'gols contra'}`);
  }
  return parts.join(' · ');
}

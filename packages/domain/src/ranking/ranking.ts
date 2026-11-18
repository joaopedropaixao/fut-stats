import { rankByRating } from './rank';

/** Quantas rodadas com nota o jogador precisa para entrar no ranking (resposta do dono à P4). */
export const DEFAULT_MIN_RATED_GAMES = 3;

export interface MinRatedGamesOptions {
  target?: number;
}

/**
 * Mínimo de rodadas com nota para classificar: `min(alvo, rodadas encerradas do grupo)`, nunca menos que 1.
 * Assim o ranking existe desde a primeira rodada e, com o grupo maduro, um jogo bom não põe ninguém na ponta.
 */
export function minRatedGames(
  closedRounds: number,
  { target = DEFAULT_MIN_RATED_GAMES }: MinRatedGamesOptions = {},
): number {
  const rounds = Number.isFinite(closedRounds) ? Math.floor(closedRounds) : 0;
  const goal = Number.isFinite(target) ? Math.floor(target) : DEFAULT_MIN_RATED_GAMES;
  return Math.max(1, Math.min(goal, rounds));
}

export interface RankablePlayer {
  id: string;
  average: number | null;
  ratedGames: number;
}

/**
 * Posição de cada jogador no ranking pela média (`rankByRating`: empate divide e pula a seguinte). Quem tem
 * menos de `minRatedGames` rodadas com nota fica sem posição (`null`), mesmo com a maior média. Devolve
 * `id → posição`: os classificados na ordem do ranking, depois os sem posição.
 */
export function rankPlayers(
  players: readonly RankablePlayer[],
  { minRatedGames: min }: { minRatedGames: number },
): Map<string, number | null> {
  const ranked = rankByRating(
    players.flatMap((p) =>
      p.average !== null && p.ratedGames >= min ? [{ id: p.id, rating: p.average }] : [],
    ),
  );
  const result = new Map<string, number | null>(ranked);
  for (const p of players) if (!result.has(p.id)) result.set(p.id, null);
  return result;
}

/**
 * Quantas posições cada jogador subiu (+) ou desceu (−) entre dois rankings. Só entra quem está no `after`;
 * sem posição antes ou depois, `null`.
 */
export function rankTrend(
  before: ReadonlyMap<string, number | null>,
  after: ReadonlyMap<string, number | null>,
): Map<string, number | null> {
  const trend = new Map<string, number | null>();
  for (const [id, now] of after) {
    const was = before.get(id) ?? null;
    trend.set(id, was === null || now === null ? null : was - now);
  }
  return trend;
}

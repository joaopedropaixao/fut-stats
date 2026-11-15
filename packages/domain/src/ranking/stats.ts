import type { MatchResult } from '../round';

/**
 * O que um jogador fez numa rodada encerrada em que jogou. A API monta uma por rodada, da **mais antiga
 * para a mais recente**.
 */
export interface PlayerRoundRecord {
  result: MatchResult;
  goals: number;
  assists: number;
  ownGoals: number;
  /** Nota da rodada (`roundScore`); `null` = ninguém deu nota. */
  score: number | null;
  mvp: boolean;
  flop: boolean;
  /** Jogou na vaga de goleiro (titular ou reserva escalado como `GOALKEEPER`). */
  playedAsGoalkeeper: boolean;
  /** Gols do adversário na rodada (só conta nos números de goleiro). */
  goalsConceded: number;
}

/** Resultados iguais seguidos nas últimas rodadas jogadas. */
export interface Streak {
  result: MatchResult;
  count: number;
}

/** Números de goleiro: só as rodadas em que jogou na vaga de goleiro. */
export interface GoalkeeperStats {
  games: number;
  conceded: number;
  cleanSheets: number;
  /** 2 casas; `null` sem jogo no gol. */
  concededPerGame: number | null;
}

export interface PlayerStats {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  ownGoals: number;
  mvps: number;
  flops: number;
  ratedGames: number;
  /** Média das notas de rodada, 2 casas; `null` sem nota. */
  average: number | null;
  streak: Streak | null;
  /** Sempre presente (zerado); quem mostra é a API, só para quem tem goleiro como posição principal. */
  goalkeeper: GoalkeeperStats;
}

/** Meio para cima, como `roundScore`. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Estatísticas de um jogador nas rodadas encerradas que ele jogou (da mais antiga para a mais recente).
 * Gol contra não conta como gol. Rodada sem nota conta jogo, mas não entra na média. Sem rodada: tudo zero,
 * `average` e `streak` nulos.
 */
export function playerStats(records: readonly PlayerRoundRecord[]): PlayerStats {
  const scores = records.flatMap((r) => (r.score === null ? [] : [r.score]));
  const keeper = records.filter((r) => r.playedAsGoalkeeper);
  const conceded = keeper.reduce((sum, r) => sum + r.goalsConceded, 0);
  const count = (result: MatchResult) => records.filter((r) => r.result === result).length;
  const sum = (pick: (r: PlayerRoundRecord) => number) =>
    records.reduce((total, r) => total + pick(r), 0);

  return {
    games: records.length,
    wins: count('WIN'),
    draws: count('DRAW'),
    losses: count('LOSS'),
    goals: sum((r) => r.goals),
    assists: sum((r) => r.assists),
    ownGoals: sum((r) => r.ownGoals),
    mvps: records.filter((r) => r.mvp).length,
    flops: records.filter((r) => r.flop).length,
    ratedGames: scores.length,
    average: scores.length === 0 ? null : round2(scores.reduce((a, b) => a + b, 0) / scores.length),
    streak: streakOf(records),
    goalkeeper: {
      games: keeper.length,
      conceded,
      cleanSheets: keeper.filter((r) => r.goalsConceded === 0).length,
      concededPerGame: keeper.length === 0 ? null : round2(conceded / keeper.length),
    },
  };
}

function streakOf(records: readonly PlayerRoundRecord[]): Streak | null {
  const last = records[records.length - 1];
  if (!last) return null;
  let count = 0;
  for (let i = records.length - 1; i >= 0 && records[i]!.result === last.result; i -= 1) count += 1;
  return { result: last.result, count };
}

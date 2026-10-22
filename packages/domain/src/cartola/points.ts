import { isValidRating } from '../core';
import { DEFAULT_CARTOLA_SCORING, roundTo2, type CartolaScoringConfig } from './config';

export type MatchResult = 'WIN' | 'DRAW' | 'LOSS';

/** O que o jogador fez na partida da rodada, lançado pelo admin. */
export interface CartolaScouts {
  /** Escalado no Cartola mas não jogou = 0 pontos. */
  played: boolean;
  goals: number;
  assists: number;
  result: MatchResult;
  mvp: boolean;
  bolaMurcha: boolean;
  /** Regras de goleiro valem para quem jogou no gol na partida real, não para a vaga do Cartola. */
  playedAsGoalkeeper: boolean;
  /** Gols sofridos pelo time dele; só conta se jogou no gol. */
  goalsConceded: number;
}

export interface CartolaPointsOptions {
  captain?: boolean;
  /** Sobrescreve só os pesos informados; o resto vem dos defaults. */
  config?: Partial<CartolaScoringConfig>;
}

function assertCount(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} deve ser um inteiro >= 0, recebido ${value}`);
  }
}

/** Pontos de um jogador escalado no Cartola na rodada (2 casas decimais). */
export function cartolaPoints(
  scouts: CartolaScouts,
  roundRating: number,
  { captain = false, config: overrides }: CartolaPointsOptions = {},
): number {
  const config = { ...DEFAULT_CARTOLA_SCORING, ...overrides };
  if (!scouts.played) return 0;

  if (!isValidRating(roundRating)) {
    throw new RangeError(`Nota da rodada inválida: ${roundRating}`);
  }
  assertCount('goals', scouts.goals);
  assertCount('assists', scouts.assists);
  assertCount('goalsConceded', scouts.goalsConceded);

  let points = roundRating + config.goal * scouts.goals + config.assist * scouts.assists;

  if (scouts.result === 'WIN') points += config.win;
  if (scouts.result === 'DRAW') points += config.draw;
  if (scouts.mvp) points += config.mvp;
  if (scouts.bolaMurcha) points += config.bolaMurcha;

  if (scouts.playedAsGoalkeeper) {
    points +=
      scouts.goalsConceded === 0 ? config.cleanSheet : config.goalConceded * scouts.goalsConceded;
  }

  if (captain) points *= config.captainMultiplier;

  return roundTo2(points);
}

import type { Result } from '../core';
import type { MatchResult } from '../round/match';
import { DEFAULT_CARTOLA_SCORING, roundTo2, type CartolaScoringConfig } from './config';

/** O que o jogador fez na partida da rodada, lançado pelo admin. */
export interface CartolaScouts {
  /** Escalado no Cartola mas não jogou = 0 pontos. */
  played: boolean;
  goals: number;
  assists: number;
  result: MatchResult;
  /** Foi o Craque da rodada. */
  mvp: boolean;
  /** Foi o Perna de Pau da rodada. */
  flop: boolean;
  /** Regras de goleiro valem para quem jogou no gol na partida real, não para a vaga do Cartola. */
  playedAsGoalkeeper: boolean;
  /** Gols sofridos pelo time dele; só conta se jogou no gol. */
  goalsConceded: number;
}

/** Por que um scout é inválido. Textos de UI em `packages/shared` (`CARTOLA_SCOUT_ERROR_LABELS`). */
export const CARTOLA_SCOUT_ERRORS = ['INVALID_COUNT'] as const;

export type CartolaScoutError = (typeof CARTOLA_SCOUT_ERRORS)[number];

/** Um scout inválido: campo, valor recebido e motivo. */
export interface CartolaScoutIssue {
  field: 'goals' | 'assists' | 'goalsConceded';
  value: number;
  code: CartolaScoutError;
}

declare const validCartolaScouts: unique symbol;

/** Scouts que já passaram por `parseCartolaScouts`. Só ela cria esse tipo. */
export type ValidCartolaScouts = Readonly<CartolaScouts> & { readonly [validCartolaScouts]: true };

/** Valida os scouts de um jogador; devolve todas as contagens inválidas, se houver. */
export function parseCartolaScouts(
  scouts: CartolaScouts,
): Result<ValidCartolaScouts, CartolaScoutIssue> {
  const errors: CartolaScoutIssue[] = [];
  for (const field of ['goals', 'assists', 'goalsConceded'] as const) {
    const value = scouts[field];
    if (!Number.isInteger(value) || value < 0) errors.push({ field, value, code: 'INVALID_COUNT' });
  }
  return errors.length > 0
    ? { ok: false, errors }
    : { ok: true, value: scouts as ValidCartolaScouts };
}

/** Nota que entra nos pontos: a da rodada ou, se ninguém votou no jogador, a de referência. */
export interface CartolaRating {
  /** Saída de `roundScore` (1 casa decimal); null quando o jogador não recebeu notas. */
  round: number | null;
  /** `Player.rating`: média recente ou nota inicial do admin. */
  reference: number;
}

export interface CartolaPointsOptions {
  captain?: boolean;
  /** Sobrescreve só os pesos informados; o resto vem dos defaults. */
  config?: Partial<CartolaScoringConfig>;
}

/** Pontos de um jogador escalado no Cartola na rodada (2 casas decimais). */
export function cartolaPoints(
  scouts: ValidCartolaScouts,
  rating: CartolaRating,
  { captain = false, config: overrides }: CartolaPointsOptions = {},
): number {
  if (!scouts.played) return 0;
  const config = { ...DEFAULT_CARTOLA_SCORING, ...overrides };

  let points =
    (rating.round ?? rating.reference) +
    config.goal * scouts.goals +
    config.assist * scouts.assists;

  if (scouts.result === 'WIN') points += config.win;
  if (scouts.result === 'DRAW') points += config.draw;
  if (scouts.mvp) points += config.mvp;
  if (scouts.flop) points += config.flop;

  if (scouts.playedAsGoalkeeper) {
    points +=
      scouts.goalsConceded === 0 ? config.cleanSheet : config.goalConceded * scouts.goalsConceded;
  }

  if (captain) points *= config.captainMultiplier;

  return roundTo2(points);
}

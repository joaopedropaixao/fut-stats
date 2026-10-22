import { matchesFormation, type TeamLineup } from '../core';
import { CARTOLA_INITIAL_BUDGET, roundTo2 } from './config';

/** Escalação de um participante no Cartola: 1-2-3-1 com jogadores dos dois times. */
export interface CartolaSquad {
  picks: TeamLineup;
  captainId: string;
}

/** Preço atual de cada jogador disponível no mercado, por playerId. */
export type CartolaPrices = ReadonlyMap<string, number>;

export interface CartolaMarket {
  prices: CartolaPrices;
  /** Patrimônio do participante; por padrão o orçamento inicial. */
  budget?: number;
}

/** Por que uma escalação é inválida. Textos de UI em `packages/shared` (`CARTOLA_SQUAD_ERROR_LABELS`). */
export const CARTOLA_SQUAD_ERRORS = [
  'INVALID_FORMATION',
  'UNKNOWN_PLAYER',
  'OVER_BUDGET',
  'CAPTAIN_NOT_IN_SQUAD',
] as const;

export type CartolaSquadError = (typeof CARTOLA_SQUAD_ERRORS)[number];

/** Soma dos preços dos escalados; quem não tem preço no mercado fica de fora. */
export function squadCost(picks: TeamLineup, prices: CartolaPrices): number {
  return roundTo2(picks.reduce((sum, { playerId }) => sum + (prices.get(playerId) ?? 0), 0));
}

/** Lista todos os problemas da escalação (vazia se ela for válida). */
export function validateCartolaSquad(
  squad: CartolaSquad,
  { prices, budget = CARTOLA_INITIAL_BUDGET }: CartolaMarket,
): CartolaSquadError[] {
  const errors: CartolaSquadError[] = [];
  if (!matchesFormation(squad.picks)) errors.push('INVALID_FORMATION');
  if (squad.picks.some((s) => !prices.has(s.playerId))) errors.push('UNKNOWN_PLAYER');
  if (squadCost(squad.picks, prices) > budget) errors.push('OVER_BUDGET');
  if (!squad.picks.some((s) => s.playerId === squad.captainId)) errors.push('CAPTAIN_NOT_IN_SQUAD');
  return errors;
}

export function isValidCartolaSquad(squad: CartolaSquad, market: CartolaMarket): boolean {
  return validateCartolaSquad(squad, market).length === 0;
}

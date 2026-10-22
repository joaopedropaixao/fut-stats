import { matchesFormation, type TeamLineup } from '../core';
import { CARTOLA_INITIAL_BUDGET, roundTo2 } from './config';

/** Escalação de um participante no Cartola: 1-2-3-1 com jogadores dos dois times. */
export interface CartolaSquad {
  picks: TeamLineup;
  captainId: string;
}

export interface CartolaMarket {
  /** Preço atual de cada jogador disponível no mercado, por playerId. */
  prices: ReadonlyMap<string, number>;
  /** Patrimônio do participante; por padrão o orçamento inicial. */
  budget?: number;
}

export type CartolaSquadError =
  'INVALID_FORMATION' | 'UNKNOWN_PLAYER' | 'OVER_BUDGET' | 'CAPTAIN_NOT_IN_SQUAD';

export interface CartolaSquadValidation {
  valid: boolean;
  /** Soma dos preços dos jogadores conhecidos. */
  cost: number;
  errors: CartolaSquadError[];
}

export function validateCartolaSquad(
  squad: CartolaSquad,
  { prices, budget = CARTOLA_INITIAL_BUDGET }: CartolaMarket,
): CartolaSquadValidation {
  const errors: CartolaSquadError[] = [];

  if (!matchesFormation(squad.picks)) errors.push('INVALID_FORMATION');

  let cost = 0;
  let unknown = false;
  for (const { playerId } of squad.picks) {
    const price = prices.get(playerId);
    if (price === undefined) unknown = true;
    else cost += price;
  }
  cost = roundTo2(cost);

  if (unknown) errors.push('UNKNOWN_PLAYER');
  if (cost > budget) errors.push('OVER_BUDGET');
  if (!squad.picks.some((s) => s.playerId === squad.captainId)) errors.push('CAPTAIN_NOT_IN_SQUAD');

  return { valid: errors.length === 0, cost, errors };
}

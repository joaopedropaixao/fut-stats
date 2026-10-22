import { matchesFormation, type Player, type Position, type TeamLineup } from '../core';
import { CARTOLA_INITIAL_BUDGET, roundTo2 } from './config';

/** Escalação de um participante no Cartola: 1-2-3-1 com jogadores dos dois times. */
export interface CartolaSquad {
  picks: TeamLineup;
  captainId: string;
}

/** Jogador disponível no mercado: preço atual e as posições do cadastro (definidas pelo admin). */
export interface CartolaMarketPlayer extends Pick<
  Player,
  'primaryPosition' | 'secondaryPositions'
> {
  price: number;
}

/** Jogadores do mercado, por playerId. */
export type CartolaMarketPlayers = ReadonlyMap<string, CartolaMarketPlayer>;

export interface CartolaMarket {
  players: CartolaMarketPlayers;
  /** Patrimônio do participante; por padrão o orçamento inicial. */
  budget?: number;
}

/** Por que uma escalação é inválida. Textos de UI em `packages/shared` (`CARTOLA_SQUAD_ERROR_LABELS`). */
export const CARTOLA_SQUAD_ERRORS = [
  'INVALID_FORMATION',
  'UNKNOWN_PLAYER',
  'POSITION_NOT_ALLOWED',
  'OVER_BUDGET',
  'CAPTAIN_NOT_IN_SQUAD',
] as const;

export type CartolaSquadError = (typeof CARTOLA_SQUAD_ERRORS)[number];

/**
 * Se o jogador pode ocupar a vaga: posição principal ou uma secundária. Como no `balanceTeams`,
 * a vaga de goleiro é só de quem tem goleiro como principal, e goleiro não entra em vaga de linha.
 */
export function canPickForPosition(
  player: Pick<Player, 'primaryPosition' | 'secondaryPositions'>,
  position: Position,
): boolean {
  if (position === 'GOALKEEPER' || player.primaryPosition === 'GOALKEEPER') {
    return player.primaryPosition === position;
  }
  return player.primaryPosition === position || player.secondaryPositions.includes(position);
}

/** Soma dos preços dos escalados; quem não está no mercado fica de fora. */
export function squadCost(picks: TeamLineup, players: CartolaMarketPlayers): number {
  return roundTo2(
    picks.reduce((sum, { playerId }) => sum + (players.get(playerId)?.price ?? 0), 0),
  );
}

/** Lista todos os problemas da escalação (vazia se ela for válida). */
export function validateCartolaSquad(
  squad: CartolaSquad,
  { players, budget = CARTOLA_INITIAL_BUDGET }: CartolaMarket,
): CartolaSquadError[] {
  const errors: CartolaSquadError[] = [];
  if (!matchesFormation(squad.picks)) errors.push('INVALID_FORMATION');
  if (squad.picks.some((s) => !players.has(s.playerId))) errors.push('UNKNOWN_PLAYER');
  if (
    squad.picks.some((s) => {
      const player = players.get(s.playerId);
      return player !== undefined && !canPickForPosition(player, s.position);
    })
  ) {
    errors.push('POSITION_NOT_ALLOWED');
  }
  if (squadCost(squad.picks, players) > budget) errors.push('OVER_BUDGET');
  if (!squad.picks.some((s) => s.playerId === squad.captainId)) errors.push('CAPTAIN_NOT_IN_SQUAD');
  return errors;
}

export function isValidCartolaSquad(squad: CartolaSquad, market: CartolaMarket): boolean {
  return validateCartolaSquad(squad, market).length === 0;
}

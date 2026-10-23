import type { TeamLineup } from '../core';
import type { RoundState, RoundTeams } from './match';

/** Monta um time 1-2-3-1 com ids `${prefix}1`..`${prefix}7`. */
export function lineup(prefix: string): TeamLineup {
  return [
    { playerId: `${prefix}1`, position: 'GOALKEEPER' },
    { playerId: `${prefix}2`, position: 'DEFENDER' },
    { playerId: `${prefix}3`, position: 'DEFENDER' },
    { playerId: `${prefix}4`, position: 'WINGER' },
    { playerId: `${prefix}5`, position: 'WINGER' },
    { playerId: `${prefix}6`, position: 'MIDFIELDER' },
    { playerId: `${prefix}7`, position: 'FORWARD' },
  ];
}

/** Branco w1..w7 (reserva w8) x Preto b1..b7 (reserva b8). */
export const teams: RoundTeams = {
  WHITE: lineup('w'),
  BLACK: lineup('b'),
  reserves: { WHITE: ['w8'], BLACK: ['b8'] },
};

export function round(overrides: Partial<RoundState> = {}): RoundState {
  return { status: 'IN_PROGRESS', teams, score: null, events: [], ...overrides };
}

import { describe, expect, it } from 'vitest';
import { countByPosition, isValidRoundLineup, matchesFormation, type TeamLineup } from './lineup';

/** Monta um time 1-2-3-1 com ids `${prefix}1`..`${prefix}7`. */
function team(prefix: string): TeamLineup {
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

describe('countByPosition', () => {
  it('conta jogadores por posição, incluindo posições vazias', () => {
    expect(countByPosition(team('w'))).toEqual({
      GOALKEEPER: 1,
      DEFENDER: 2,
      WINGER: 2,
      MIDFIELDER: 1,
      FORWARD: 1,
    });
    expect(countByPosition([]).FORWARD).toBe(0);
  });
});

describe('matchesFormation', () => {
  it('aceita um time 1-2-3-1 completo', () => {
    expect(matchesFormation(team('w'))).toBe(true);
  });

  it('rejeita time com jogador a menos', () => {
    expect(matchesFormation(team('w').slice(1))).toBe(false);
  });

  it('rejeita dois goleiros no lugar de um atacante', () => {
    const lineup = team('w').map((s) =>
      s.position === 'FORWARD' ? { ...s, position: 'GOALKEEPER' as const } : s,
    );
    expect(matchesFormation(lineup)).toBe(false);
  });

  it('rejeita o mesmo jogador em duas posições', () => {
    const lineup = team('w').map((s) => (s.playerId === 'w7' ? { ...s, playerId: 'w6' } : s));
    expect(matchesFormation(lineup)).toBe(false);
  });
});

describe('isValidRoundLineup', () => {
  it('aceita Branco x Preto completos e sem jogador em comum', () => {
    expect(isValidRoundLineup({ WHITE: team('w'), BLACK: team('b') })).toBe(true);
  });

  it('rejeita jogador escalado nos dois times', () => {
    const black = team('b').map((s) => (s.playerId === 'b7' ? { ...s, playerId: 'w7' } : s));
    expect(isValidRoundLineup({ WHITE: team('w'), BLACK: black })).toBe(false);
  });

  it('rejeita quando um dos times está incompleto', () => {
    expect(isValidRoundLineup({ WHITE: team('w'), BLACK: team('b').slice(1) })).toBe(false);
  });
});

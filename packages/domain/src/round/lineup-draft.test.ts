import { describe, expect, it } from 'vitest';
import { validateLineupDraft } from './lineup-draft';
import { lineup, teams } from './fixtures.test-utils';
import type { RoundTeams } from './match';

const empty: RoundTeams = { WHITE: [], BLACK: [], reserves: { WHITE: [], BLACK: [] } };

describe('validateLineupDraft', () => {
  it('C4: aceita rascunho vazio, incompleto e completo', () => {
    expect(validateLineupDraft(empty)).toEqual([]);
    expect(
      validateLineupDraft({
        ...empty,
        WHITE: lineup('w').slice(0, 3),
        BLACK: lineup('b').slice(3),
      }),
    ).toEqual([]);
    expect(validateLineupDraft(teams)).toEqual([]);
  });

  it('C1: recusa jogador repetido: no mesmo time, nos dois times ou titular e reserva', () => {
    const twice = [...lineup('w').slice(0, 2), { playerId: 'w1', position: 'FORWARD' as const }];
    expect(validateLineupDraft({ ...empty, WHITE: twice })).toEqual(['DUPLICATE_PLAYER']);
    expect(
      validateLineupDraft({
        ...empty,
        WHITE: [{ playerId: 'x', position: 'FORWARD' }],
        BLACK: [{ playerId: 'x', position: 'FORWARD' }],
      }),
    ).toEqual(['DUPLICATE_PLAYER']);
    expect(
      validateLineupDraft({
        ...empty,
        WHITE: [{ playerId: 'x', position: 'FORWARD' }],
        reserves: { WHITE: ['x'], BLACK: [] },
      }),
    ).toEqual(['DUPLICATE_PLAYER']);
  });

  it('C2: recusa posição com mais gente que a formação (1-2-3-1)', () => {
    const twoKeepers = [
      { playerId: 'a', position: 'GOALKEEPER' as const },
      { playerId: 'b', position: 'GOALKEEPER' as const },
    ];
    expect(validateLineupDraft({ ...empty, BLACK: twoKeepers })).toEqual(['POSITION_FULL']);
  });

  it('C3: recusa mais reservas que o limite, que pode ser ajustado', () => {
    const reserves = { WHITE: ['r1', 'r2', 'r3'], BLACK: [] };
    expect(validateLineupDraft({ ...empty, reserves })).toEqual(['TOO_MANY_RESERVES']);
    expect(validateLineupDraft({ ...empty, reserves }, { maxReservesPerTeam: 3 })).toEqual([]);
  });

  it('junta os motivos sem repetir', () => {
    const bad: RoundTeams = {
      WHITE: [
        { playerId: 'a', position: 'GOALKEEPER' },
        { playerId: 'a', position: 'GOALKEEPER' },
      ],
      BLACK: [],
      reserves: { WHITE: ['r1', 'r2', 'r3'], BLACK: [] },
    };
    expect(validateLineupDraft(bad)).toEqual([
      'DUPLICATE_PLAYER',
      'POSITION_FULL',
      'TOO_MANY_RESERVES',
    ]);
  });
});

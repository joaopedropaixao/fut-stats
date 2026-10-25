import { describe, expect, it } from 'vitest';
import { lineup, round, teams } from './fixtures.test-utils';
import { roundPlayerIds, type MatchEvent } from './match';
import {
  canTransitionRound,
  isRoundDeletable,
  isRoundEditable,
  ROUND_STATUSES,
  validateRoundTeams,
  validateRoundTransition,
} from './status';

const goals = (white: number, black: number): MatchEvent[] => [
  ...Array.from({ length: white }, () => ({ playerId: 'w7', type: 'GOAL' as const })),
  ...Array.from({ length: black }, () => ({ playerId: 'b7', type: 'GOAL' as const })),
];

describe('validateRoundTeams', () => {
  it('aceita os dois times 1-2-3-1 com até 2 reservas cada', () => {
    expect(validateRoundTeams(teams)).toEqual([]);
    expect(validateRoundTeams({ ...teams, reserves: { WHITE: ['w8', 'w9'], BLACK: [] } })).toEqual(
      [],
    );
  });

  it('sem times montados é escalação inválida', () => {
    expect(validateRoundTeams(null)).toEqual(['INVALID_LINEUP']);
  });

  it('time fora da formação é escalação inválida', () => {
    expect(validateRoundTeams({ ...teams, WHITE: lineup('w').slice(1) })).toEqual([
      'INVALID_LINEUP',
    ]);
  });

  it('jogador nos dois times é escalação inválida', () => {
    const black = lineup('b').map((s, i) => (i === 6 ? { ...s, playerId: 'w7' } : s));
    expect(validateRoundTeams({ ...teams, BLACK: black })).toEqual(['INVALID_LINEUP']);
  });

  it('mais reservas que o limite', () => {
    const reserves = { WHITE: ['w8', 'w9', 'w10'], BLACK: [] };
    expect(validateRoundTeams({ ...teams, reserves })).toEqual(['INVALID_RESERVES']);
    expect(validateRoundTeams({ ...teams, reserves }, { maxReservesPerTeam: 3 })).toEqual([]);
  });

  it('reserva repetida, reserva que já é titular ou reserva nos dois times', () => {
    for (const reserves of [
      { WHITE: ['w8', 'w8'], BLACK: [] },
      { WHITE: ['b1'], BLACK: [] },
      { WHITE: ['x'], BLACK: ['x'] },
    ]) {
      expect(validateRoundTeams({ ...teams, reserves })).toEqual(['INVALID_RESERVES']);
    }
  });

  it('lista os dois problemas juntos', () => {
    expect(
      validateRoundTeams({ ...teams, WHITE: [], reserves: { WHITE: ['w8', 'w8'], BLACK: [] } }),
    ).toEqual(['INVALID_LINEUP', 'INVALID_RESERVES']);
  });
});

describe('validateRoundTransition', () => {
  it('mesmo status ou etapa pulada não é transição', () => {
    expect(validateRoundTransition(round({ status: 'SCHEDULED' }), 'SCHEDULED')).toEqual([
      'INVALID_TRANSITION',
    ]);
    expect(validateRoundTransition(round({ status: 'SCHEDULED' }), 'IN_PROGRESS')).toEqual([
      'INVALID_TRANSITION',
    ]);
    expect(validateRoundTransition(round({ status: 'TEAMS_PUBLISHED' }), 'VOTING')).toEqual([
      'INVALID_TRANSITION',
    ]);
  });

  it('só despublicar os times volta etapa', () => {
    expect(validateRoundTransition(round({ status: 'TEAMS_PUBLISHED' }), 'SCHEDULED')).toEqual([]);
    expect(validateRoundTransition(round({ status: 'IN_PROGRESS' }), 'TEAMS_PUBLISHED')).toEqual([
      'INVALID_TRANSITION',
    ]);
    expect(validateRoundTransition(round({ status: 'VOTING' }), 'IN_PROGRESS')).toEqual([
      'INVALID_TRANSITION',
    ]);
  });

  it('rodada encerrada não sai de CLOSED', () => {
    for (const to of ROUND_STATUSES) {
      expect(validateRoundTransition(round({ status: 'CLOSED' }), to)).toEqual([
        'INVALID_TRANSITION',
      ]);
    }
  });

  it('publicar times exige times válidos', () => {
    expect(validateRoundTransition(round({ status: 'SCHEDULED' }), 'TEAMS_PUBLISHED')).toEqual([]);
    expect(
      validateRoundTransition(round({ status: 'SCHEDULED', teams: null }), 'TEAMS_PUBLISHED'),
    ).toEqual(['INVALID_LINEUP']);
  });

  describe('ATTENDANCE_MISMATCH: confirmados = escalados', () => {
    const publish = (o: Parameters<typeof round>[0]) =>
      validateRoundTransition(round({ status: 'SCHEDULED', ...o }), 'TEAMS_PUBLISHED');

    it('C5: confirmado fora dos times', () => {
      expect(publish({ confirmedIds: [...roundPlayerIds(teams), 'x1'] })).toContain(
        'ATTENDANCE_MISMATCH',
      );
    });

    it('C6: escalado que não está confirmado, ao publicar e ao começar', () => {
      const confirmedIds = roundPlayerIds(teams).filter((id) => id !== 'w3');
      expect(publish({ confirmedIds })).toContain('ATTENDANCE_MISMATCH');
      expect(
        validateRoundTransition(round({ status: 'TEAMS_PUBLISHED', confirmedIds }), 'IN_PROGRESS'),
      ).toContain('ATTENDANCE_MISMATCH');
      expect(
        validateRoundTransition(
          round({ status: 'TEAMS_PUBLISHED', confirmedIds: [...roundPlayerIds(teams), 'x1'] }),
          'IN_PROGRESS',
        ),
      ).toContain('ATTENDANCE_MISMATCH');
    });

    it('C7: times válidos e confirmados = escalados (em qualquer ordem)', () => {
      expect(publish({})).toEqual([]);
      expect(publish({ confirmedIds: [...roundPlayerIds(teams)].reverse() })).toEqual([]);
    });

    it('C8: a checagem não vale para votação, encerrar nem despublicar', () => {
      const confirmedIds = ['outro'];
      const score = { WHITE: 0, BLACK: 0 };
      expect(
        validateRoundTransition(round({ status: 'VOTING', confirmedIds, score }), 'CLOSED'),
      ).not.toContain('ATTENDANCE_MISMATCH');
      expect(
        validateRoundTransition(round({ status: 'IN_PROGRESS', confirmedIds, score }), 'VOTING'),
      ).not.toContain('ATTENDANCE_MISMATCH');
      expect(
        validateRoundTransition(round({ status: 'TEAMS_PUBLISHED', confirmedIds }), 'SCHEDULED'),
      ).toEqual([]);
    });

    it('sem times montados só acusa INVALID_LINEUP', () => {
      expect(publish({ teams: null })).toEqual(['INVALID_LINEUP']);
    });
  });

  it('começar o jogo confere os times de novo', () => {
    expect(validateRoundTransition(round({ status: 'TEAMS_PUBLISHED' }), 'IN_PROGRESS')).toEqual(
      [],
    );
    expect(
      validateRoundTransition(
        round({ status: 'TEAMS_PUBLISHED', teams: { ...teams, WHITE: [] } }),
        'IN_PROGRESS',
      ),
    ).toEqual(['INVALID_LINEUP', 'ATTENDANCE_MISMATCH']);
  });

  describe('ir para a votação e encerrar exigem placar batendo com os gols', () => {
    for (const [from, to] of [
      ['IN_PROGRESS', 'VOTING'],
      ['VOTING', 'CLOSED'],
    ] as const) {
      it(`${from} → ${to}`, () => {
        const state = (o: Parameters<typeof round>[0]) => round({ status: from, ...o });

        expect(validateRoundTransition(state({ score: null }), to)).toEqual(['SCORE_MISSING']);
        expect(validateRoundTransition(state({ score: { WHITE: -1, BLACK: 0 } }), to)).toEqual([
          'INVALID_SCORE',
        ]);
        expect(
          validateRoundTransition(
            state({ score: { WHITE: 2, BLACK: 1 }, events: goals(2, 1) }),
            to,
          ),
        ).toEqual([]);
        expect(
          validateRoundTransition(
            state({ score: { WHITE: 2, BLACK: 1 }, events: goals(1, 1) }),
            to,
          ),
        ).toEqual(['GOALS_MISMATCH']);
      });
    }

    it('sem times montados não vai para a votação nem encerra', () => {
      for (const [status, to] of [
        ['IN_PROGRESS', 'VOTING'],
        ['VOTING', 'CLOSED'],
      ] as const) {
        expect(
          validateRoundTransition(
            round({ status, teams: null, score: { WHITE: 0, BLACK: 0 } }),
            to,
          ),
        ).toEqual(['INVALID_LINEUP']);
      }
    });

    it('0 x 0 sem lances bate', () => {
      expect(validateRoundTransition(round({ score: { WHITE: 0, BLACK: 0 } }), 'VOTING')).toEqual(
        [],
      );
    });

    it('gol contra conta para o adversário', () => {
      const events: MatchEvent[] = [
        { playerId: 'w7', type: 'GOAL' },
        { playerId: 'b2', type: 'OWN_GOAL' },
      ];
      expect(
        validateRoundTransition(round({ score: { WHITE: 2, BLACK: 0 }, events }), 'VOTING'),
      ).toEqual([]);
    });

    it('mais assistências que gols do time', () => {
      const events: MatchEvent[] = [
        ...goals(1, 0),
        { playerId: 'w6', type: 'ASSIST' },
        { playerId: 'w5', type: 'ASSIST' },
      ];
      expect(
        validateRoundTransition(round({ score: { WHITE: 1, BLACK: 0 }, events }), 'VOTING'),
      ).toEqual(['TOO_MANY_ASSISTS']);
    });
  });
});

describe('canTransitionRound', () => {
  it('é a versão sim/não de validateRoundTransition', () => {
    expect(canTransitionRound(round({ status: 'SCHEDULED' }), 'TEAMS_PUBLISHED')).toBe(true);
    expect(canTransitionRound(round({ status: 'IN_PROGRESS' }), 'VOTING')).toBe(false);
  });
});

describe('isRoundDeletable', () => {
  it('só antes do jogo', () => {
    expect(ROUND_STATUSES.filter(isRoundDeletable)).toEqual(['SCHEDULED', 'TEAMS_PUBLISHED']);
  });
});

describe('isRoundEditable', () => {
  it('data, hora e local só mudam antes do jogo', () => {
    expect(ROUND_STATUSES.filter(isRoundEditable)).toEqual(['SCHEDULED', 'TEAMS_PUBLISHED']);
  });
});

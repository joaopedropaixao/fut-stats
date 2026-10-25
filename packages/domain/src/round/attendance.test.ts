import { describe, expect, it } from 'vitest';
import { canChangeAttendance, validateAttendanceChange } from './attendance';
import type { RoundActor } from './events';
import { ROUND_STATUSES } from './status';

const player: RoundActor = { id: 'p1', isAdmin: false };
const admin: RoundActor = { id: 'a1', isAdmin: true };

describe('validateAttendanceChange', () => {
  it('jogador marca a própria presença com a rodada agendada', () => {
    expect(validateAttendanceChange('p1', player, 'SCHEDULED')).toEqual([]);
  });

  it('jogador não marca a presença de outro', () => {
    expect(validateAttendanceChange('p2', player, 'SCHEDULED')).toEqual(['NOT_OWN_ATTENDANCE']);
  });

  it('com os times publicados, o jogador não muda mais a própria presença', () => {
    expect(validateAttendanceChange('p1', player, 'TEAMS_PUBLISHED')).toEqual([
      'TEAMS_ALREADY_PUBLISHED',
    ]);
  });

  it('jogador mexendo na presença de outro com os times publicados: lista os dois', () => {
    expect(validateAttendanceChange('p2', player, 'TEAMS_PUBLISHED')).toEqual([
      'NOT_OWN_ATTENDANCE',
      'TEAMS_ALREADY_PUBLISHED',
    ]);
  });

  it('admin marca a de qualquer um (e a dele) até o jogo começar', () => {
    for (const status of ['SCHEDULED', 'TEAMS_PUBLISHED'] as const) {
      expect(validateAttendanceChange('p1', admin, status)).toEqual([]);
      expect(validateAttendanceChange('a1', admin, status)).toEqual([]);
    }
  });

  it('do jogo em diante, trava para todos; só esse motivo', () => {
    const open = ROUND_STATUSES.filter(
      (status) => validateAttendanceChange('p1', admin, status).length === 0,
    );
    expect(open).toEqual(['SCHEDULED', 'TEAMS_PUBLISHED']);
    for (const status of ['IN_PROGRESS', 'POST_MATCH', 'VOTING', 'CLOSED'] as const) {
      expect(validateAttendanceChange('p2', player, status)).toEqual(['ATTENDANCE_CLOSED']);
    }
  });
});

describe('C13: Resenha pós-jogo', () => {
  it('trava a presença, até para o admin', () => {
    expect(validateAttendanceChange('p1', { id: 'a1', isAdmin: true }, 'POST_MATCH')).toEqual([
      'ATTENDANCE_CLOSED',
    ]);
  });
});

describe('canChangeAttendance', () => {
  it('é a versão sim/não de validateAttendanceChange', () => {
    expect(canChangeAttendance('p1', player, 'SCHEDULED')).toBe(true);
    expect(canChangeAttendance('p1', player, 'TEAMS_PUBLISHED')).toBe(false);
  });
});

import type { RosterMember } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import { applyRosterChange, splitRoster } from './roster-state';

const member = (id: string, patch: Partial<RosterMember> = {}): RosterMember => ({
  id,
  nickname: id,
  photoUrl: null,
  role: 'PLAYER',
  primaryPosition: 'DEFENDER',
  secondaryPositions: [],
  isHiredGoalkeeper: false,
  avatar: DEFAULT_AVATAR,
  initialRating: 6,
  active: true,
  ...patch,
});

describe('applyRosterChange', () => {
  const roster = [member('a'), member('b'), member('c', { active: false })];

  it('troca só o papel do membro tocado', () => {
    const next = applyRosterChange(roster, 'b', { role: 'ADMIN' });
    expect(next.map((m) => m.role)).toEqual(['PLAYER', 'ADMIN', 'PLAYER']);
    expect(next[1]!.active).toBe(true);
  });

  it('desativar e reativar trocam só o ativo', () => {
    expect(applyRosterChange(roster, 'a', { active: false })[0]!.active).toBe(false);
    expect(applyRosterChange(roster, 'c', { active: true })[2]).toMatchObject({
      active: true,
      role: 'PLAYER',
    });
  });

  it('não mexe na lista original', () => {
    applyRosterChange(roster, 'a', { role: 'ADMIN' });
    expect(roster[0]!.role).toBe('PLAYER');
  });
});

describe('splitRoster', () => {
  it('separa ativos e inativos sem trocar a ordem', () => {
    const { active, inactive } = splitRoster([
      member('a'),
      member('x', { active: false }),
      member('b'),
      member('y', { active: false }),
    ]);
    expect(active.map((m) => m.id)).toEqual(['a', 'b']);
    expect(inactive.map((m) => m.id)).toEqual(['x', 'y']);
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import { memberChanges, type MemberFormValues } from './member-changes';

const initial: MemberFormValues = {
  nickname: 'Beto',
  avatar: DEFAULT_AVATAR,
  primaryPosition: 'DEFENDER',
  secondaryPositions: ['WINGER'],
  initialRating: 6,
  isHiredGoalkeeper: false,
  isAdmin: false,
};

const player = { adminFields: false, isMe: true };
const admin = { adminFields: true, isMe: false };

describe('memberChanges', () => {
  it('sem mudança, o corpo é vazio (e o Salvar fica apagado)', () => {
    expect(memberChanges(initial, { ...initial }, player)).toEqual({});
  });

  it('manda só o que mudou, com o apelido sem espaço nas pontas', () => {
    const current = { ...initial, nickname: '  Betão ' };
    expect(memberChanges(initial, current, player)).toEqual({ nickname: 'Betão' });
  });

  it('o bonequinho só vai se algum dos três mudou', () => {
    const avatar = { ...DEFAULT_AVATAR, hairColor: 'RED' } as const;
    expect(memberChanges(initial, { ...initial, avatar }, player)).toEqual({ avatar });
  });

  it('principal e secundárias vão juntas (a API valida o estado final)', () => {
    expect(
      memberChanges(initial, { ...initial, secondaryPositions: ['WINGER', 'MIDFIELDER'] }, player),
    ).toEqual({ primaryPosition: 'DEFENDER', secondaryPositions: ['WINGER', 'MIDFIELDER'] });
    expect(
      memberChanges(
        initial,
        { ...initial, primaryPosition: 'GOALKEEPER', secondaryPositions: [] },
        player,
      ),
    ).toEqual({
      primaryPosition: 'GOALKEEPER',
      secondaryPositions: [],
    });
  });

  it('a ordem das secundárias não conta como mudança', () => {
    const two = { ...initial, secondaryPositions: ['WINGER', 'MIDFIELDER'] } as const;
    const swapped = { ...two, secondaryPositions: ['MIDFIELDER', 'WINGER'] } as const;
    expect(memberChanges(two, swapped, player)).toEqual({});
  });

  it('jogador comum nunca manda os campos de admin, mesmo que o formulário mude', () => {
    const current = { ...initial, initialRating: 9, isHiredGoalkeeper: true, isAdmin: true };
    expect(memberChanges(initial, current, player)).toEqual({});
  });

  it('o admin manda nota, goleiro contratado e papel', () => {
    const current = { ...initial, initialRating: 7.5, isHiredGoalkeeper: true, isAdmin: true };
    expect(memberChanges(initial, current, admin)).toEqual({
      initialRating: 7.5,
      isHiredGoalkeeper: true,
      role: 'ADMIN',
    });
    expect(
      memberChanges({ ...initial, isAdmin: true }, { ...initial, isAdmin: false }, admin),
    ).toEqual({
      role: 'PLAYER',
    });
  });

  it('o admin editando a si mesmo nunca manda o papel (SELF_CHANGE)', () => {
    const current = { ...initial, isAdmin: true, initialRating: 8 };
    expect(memberChanges(initial, current, { adminFields: true, isMe: true })).toEqual({
      initialRating: 8,
    });
  });
});

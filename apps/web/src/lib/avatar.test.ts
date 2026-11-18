import { avatarSchema } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_SKINS,
  DEFAULT_AVATAR,
  randomAvatar,
  sameAvatar,
} from './avatar';

describe('listas do bonequinho', () => {
  it('são as do contrato: 5 peles, 6 cabelos e 5 cores', () => {
    expect(AVATAR_SKINS).toHaveLength(5);
    expect(AVATAR_HAIRS).toHaveLength(6);
    expect(AVATAR_HAIR_COLORS).toHaveLength(5);
  });

  it('o padrão é um bonequinho válido, tirado das listas', () => {
    expect(avatarSchema.safeParse(DEFAULT_AVATAR).success).toBe(true);
    expect(DEFAULT_AVATAR).toEqual({ skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' });
  });
});

describe('sameAvatar', () => {
  it('compara os três campos', () => {
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR })).toBe(true);
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, skin: 'DARK' })).toBe(false);
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, hair: 'BALD' })).toBe(false);
    expect(sameAvatar(DEFAULT_AVATAR, { ...DEFAULT_AVATAR, hairColor: 'GRAY' })).toBe(false);
  });
});

describe('randomAvatar (Sortear)', () => {
  it('sempre devolve um bonequinho válido, em qualquer ponto do sorteio', () => {
    for (const roll of [0, 0.2, 0.5, 0.99, 1]) {
      expect(avatarSchema.safeParse(randomAvatar(undefined, () => roll)).success).toBe(true);
    }
  });

  it('sorteia de novo quando sai o mesmo (sempre muda alguma coisa)', () => {
    // Os dois primeiros sorteios repetem o padrão; o seguinte muda a pele
    const rolls = [0.5, 0.0, 0.0, 0.5, 0.0, 0.0, 0.9, 0.0, 0.0];
    let i = 0;
    const next = randomAvatar(
      { skin: 'TAN', hair: 'BALD', hairColor: 'BLACK' },
      () => rolls[i++ % rolls.length]!,
    );
    expect(next).toEqual({ skin: 'DARK', hair: 'BALD', hairColor: 'BLACK' });
  });

  it('com a sorte presa no mesmo valor, desiste depois de algumas tentativas', () => {
    const only = randomAvatar({ skin: 'LIGHT', hair: 'BALD', hairColor: 'BLACK' }, () => 0);
    expect(only).toEqual({ skin: 'LIGHT', hair: 'BALD', hairColor: 'BLACK' });
  });
});

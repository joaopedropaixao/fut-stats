import { describe, expect, it } from 'vitest';
import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_SKINS,
  DEFAULT_AVATAR,
  isPlayerAvatar,
} from './avatar';

describe('isPlayerAvatar', () => {
  it('C1: aceita toda combinação das três listas', () => {
    for (const skin of AVATAR_SKINS) {
      for (const hair of AVATAR_HAIRS) {
        for (const hairColor of AVATAR_HAIR_COLORS) {
          expect(isPlayerAvatar({ skin, hair, hairColor })).toBe(true);
        }
      }
    }
  });

  it('C1: recusa valor fora da lista', () => {
    expect(isPlayerAvatar({ skin: 'GREEN', hair: 'SHORT', hairColor: 'BLACK' })).toBe(false);
    expect(isPlayerAvatar({ skin: 'TAN', hair: 'GREEN', hairColor: 'BLACK' })).toBe(false);
    expect(isPlayerAvatar({ skin: 'TAN', hair: 'SHORT', hairColor: 'GREEN' })).toBe(false);
    expect(isPlayerAvatar({ skin: 'tan', hair: 'SHORT', hairColor: 'BLACK' })).toBe(false);
  });

  it('C1: recusa campo faltando, tipo errado ou valor que não é objeto', () => {
    expect(isPlayerAvatar({ skin: 'TAN', hair: 'SHORT' })).toBe(false);
    expect(isPlayerAvatar({ hair: 'SHORT', hairColor: 'BLACK' })).toBe(false);
    expect(isPlayerAvatar({ skin: 1, hair: 'SHORT', hairColor: 'BLACK' })).toBe(false);
    expect(isPlayerAvatar({})).toBe(false);
    expect(isPlayerAvatar(null)).toBe(false);
    expect(isPlayerAvatar(undefined)).toBe(false);
    expect(isPlayerAvatar('TAN')).toBe(false);
    expect(isPlayerAvatar([])).toBe(false);
  });

  it('C1: ignora campo extra', () => {
    expect(isPlayerAvatar({ ...DEFAULT_AVATAR, extra: 1 })).toBe(true);
  });

  it('C2: o DEFAULT_AVATAR está nas três listas', () => {
    expect(isPlayerAvatar(DEFAULT_AVATAR)).toBe(true);
    expect(AVATAR_SKINS).toContain(DEFAULT_AVATAR.skin);
    expect(AVATAR_HAIRS).toContain(DEFAULT_AVATAR.hair);
    expect(AVATAR_HAIR_COLORS).toContain(DEFAULT_AVATAR.hairColor);
  });
});

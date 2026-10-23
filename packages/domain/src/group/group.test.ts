import { describe, expect, it } from 'vitest';
import {
  DEFAULT_INITIAL_RATING,
  GROUP_NAME_MAX_LENGTH,
  nextAvailableSlug,
  NICKNAME_MAX_LENGTH,
  toSlug,
  validateGroupName,
  validateJoinGroup,
  validateNickname,
} from './group';
import { isValidRating } from '../core';

describe('validateNickname', () => {
  it.each(['Zé', 'Baixinho', 'a'.repeat(NICKNAME_MAX_LENGTH), '  Tico  '])(
    'aceita "%s"',
    (value) => {
      expect(validateNickname(value)).toBeNull();
    },
  );

  it.each(['', '   '])('vazio "%s" → EMPTY', (value) => {
    expect(validateNickname(value)).toBe('EMPTY');
  });

  it('mais de 10 caracteres → TOO_LONG', () => {
    expect(validateNickname('a'.repeat(NICKNAME_MAX_LENGTH + 1))).toBe('TOO_LONG');
  });

  it('acento conta como um caractere', () => {
    expect(validateNickname('JoãoÁéíõú')).toBeNull();
    expect(validateNickname('ç'.repeat(NICKNAME_MAX_LENGTH))).toBeNull();
  });

  it('espaço nas pontas não conta', () => {
    expect(validateNickname(`  ${'a'.repeat(NICKNAME_MAX_LENGTH)}  `)).toBeNull();
  });
});

describe('validateGroupName', () => {
  it('aceita nome comum', () => {
    expect(validateGroupName('Pelada do Zé')).toBeNull();
  });

  it.each(['', '  '])('vazio "%s" → EMPTY', (value) => {
    expect(validateGroupName(value)).toBe('EMPTY');
  });

  it('acima do limite → TOO_LONG', () => {
    expect(validateGroupName('a'.repeat(GROUP_NAME_MAX_LENGTH))).toBeNull();
    expect(validateGroupName('a'.repeat(GROUP_NAME_MAX_LENGTH + 1))).toBe('TOO_LONG');
  });
});

describe('toSlug', () => {
  it.each([
    ['Pelada do Zé', 'pelada-do-ze'],
    ['  Fut   de   Quinta!!  ', 'fut-de-quinta'],
    ['Ação & Coração', 'acao-coracao'],
    ['Pelada 2026', 'pelada-2026'],
    ['--já--', 'ja'],
  ])('"%s" → "%s"', (name, slug) => {
    expect(toSlug(name)).toBe(slug);
  });

  it('nome sem letra nem número vira "pelada"', () => {
    expect(toSlug('⚽⚽')).toBe('pelada');
  });
});

describe('nextAvailableSlug', () => {
  it('base livre → a própria base', () => {
    expect(nextAvailableSlug('pelada', [])).toBe('pelada');
    expect(nextAvailableSlug('pelada', ['pelada-do-ze'])).toBe('pelada');
  });

  it('base ocupada → menor sufixo livre a partir de 2', () => {
    expect(nextAvailableSlug('pelada', ['pelada'])).toBe('pelada-2');
    expect(nextAvailableSlug('pelada', ['pelada', 'pelada-2', 'pelada-4'])).toBe('pelada-3');
  });
});

describe('validateJoinGroup', () => {
  it('sem participação → pode entrar', () => {
    expect(validateJoinGroup(null)).toBeNull();
  });

  it('membro ativo → pode (não duplica: reaproveita)', () => {
    expect(validateJoinGroup({ active: true })).toBeNull();
  });

  it('membro inativo → MEMBERSHIP_INACTIVE (só o admin reativa)', () => {
    expect(validateJoinGroup({ active: false })).toBe('MEMBERSHIP_INACTIVE');
  });
});

describe('DEFAULT_INITIAL_RATING', () => {
  it('é 6 e é uma nota válida', () => {
    expect(DEFAULT_INITIAL_RATING).toBe(6);
    expect(isValidRating(DEFAULT_INITIAL_RATING)).toBe(true);
  });
});

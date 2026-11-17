import { describe, expect, it } from 'vitest';
import {
  compareNicknames,
  DEFAULT_INITIAL_RATING,
  hasInvalidCharacters,
  splitCharacters,
  GROUP_NAME_MAX_LENGTH,
  nextAvailableSlug,
  NICKNAME_MAX_LENGTH,
  toSlug,
  validateGroupName,
  validateJoinGroup,
  validateMultilineText,
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

  it('conta o caractere visível: acento decomposto (NFD) e emoji com tom contam 1', () => {
    expect(validateNickname('Joãozinhoé'.normalize('NFD'))).toBeNull();
    expect(validateNickname('👍🏽'.repeat(NICKNAME_MAX_LENGTH))).toBeNull();
    expect(validateNickname('👍🏽'.repeat(NICKNAME_MAX_LENGTH + 1))).toBe('TOO_LONG');
  });

  it.each(['Z\u0000é', 'Z\né', 'a\tb', 'x\u007f'])(
    'caractere de controle → INVALID_CHARACTERS',
    (value) => {
      expect(validateNickname(value)).toBe('INVALID_CHARACTERS');
    },
  );
});

describe('validateNickname: invisível e tamanho real', () => {
  it.each([
    ['espaço de largura zero', '\u200B'],
    ['quebra de linha Unicode no meio', 'Zé\u2028Bob'],
    ['separador de parágrafo', 'a\u2029b'],
    ['NEL (controle C1)', 'a\u0085b'],
    ['inversão direita-esquerda', '\u202Eabc'],
    ['BOM', 'a\uFEFFb'],
    ['preenchedor Hangul (parece vazio)', '\u3164'],
  ])('%s → INVALID_CHARACTERS', (_case, value) => {
    expect(validateNickname(value)).toBe('INVALID_CHARACTERS');
  });

  it('emoji com ZWJ e bandeira com tags continuam valendo', () => {
    expect(validateNickname('👨\u200D👩\u200D👧\u200D👦')).toBeNull();
    expect(validateNickname('🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}')).toBeNull();
    expect(validateNickname('👨\u200D👩\u200D👧\u200D👦'.repeat(NICKNAME_MAX_LENGTH))).toBeNull();
  });

  it.each([
    ['ZWJ sozinho', '\u200D'],
    ['tags sem emoji base', '\u{E0041}\u{E0042}'],
    ['Braille em branco', '\u2800'],
    ['surrogate solto', '\uD800'],
    ['acento sem letra', '\u0301'],
  ])('%s → INVALID_CHARACTERS', (_case, value) => {
    expect(validateNickname(value)).toBe('INVALID_CHARACTERS');
  });

  it('acento empilhado dentro do limite total ainda é barrado por caractere', () => {
    expect(validateNickname(`a${'\u0301'.repeat(79)}`)).toBe('TOO_LONG');
  });

  it('emoji composto com tom de pele (família, 11 pontos de código) vale como 1', () => {
    const family = '👨🏽\u200D👩🏽\u200D👧🏽\u200D👦🏽';
    expect(validateNickname(family)).toBeNull();
    expect(validateNickname('Zé Bola')).toBeNull();
  });

  it('acento combinado empilhado ("Zalgo") não burla o limite → TOO_LONG', () => {
    expect(validateNickname(`a${'\u0301'.repeat(50_000)}`)).toBe('TOO_LONG');
    expect(validateGroupName(`a${'\u0301'.repeat(50_000)}`)).toBe('TOO_LONG');
  });
});

describe('validateNickname: texto escondido', () => {
  it.each([
    ['tags depois de letra', 'a\u{E0041}\u{E0042}b'],
    ['ZWJ entre letras', 'b\u200Dc'],
    ['seletor de variação depois de letra', 'a\uFE0F'],
    ['seletor de variação suplementar', 'a\u{E0100}'],
  ])('%s → INVALID_CHARACTERS', (_case, value) => {
    expect(validateNickname(value)).toBe('INVALID_CHARACTERS');
  });

  it('emoji com seletor de variação e tecla numérica continuam valendo', () => {
    expect(validateNickname('\u2764\uFE0F')).toBeNull();
    expect(validateNickname('1\uFE0F\u20E3')).toBeNull();
    expect(validateNickname('🇧🇷')).toBeNull();
  });
});

describe('hasInvalidCharacters', () => {
  it.each(['a\u0000', 'a\u0085', 'a\u200B', 'a\u2028'])('%j → true', (value) => {
    expect(hasInvalidCharacters(value)).toBe(true);
  });

  it.each(['Pelada do Zé', '⚽', '👨\u200D👩\u200D👧'])('%j → false', (value) => {
    expect(hasInvalidCharacters(value)).toBe(false);
  });
});

describe('compareNicknames', () => {
  it('ordem alfabética do português, sem ligar para maiúscula e acento', () => {
    const nicknames = ['Zé', 'alemão', 'Ávila', 'bola', 'Apelido'];
    expect([...nicknames].sort(compareNicknames)).toEqual([
      'alemão',
      'Apelido',
      'Ávila',
      'bola',
      'Zé',
    ]);
  });

  it('iguais (até no acento/maiúscula) → 0, para o sort estável manter a ordem de entrada', () => {
    expect(compareNicknames('Zé', 'ze')).toBe(0);
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

  it('caractere de controle → INVALID_CHARACTERS', () => {
    expect(validateGroupName('Pela\u0000da')).toBe('INVALID_CHARACTERS');
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

describe('validateMultilineText', () => {
  it('aceita quebra de linha e conta como um caractere', () => {
    expect(validateMultilineText('a\nb', 3)).toBeNull();
    expect(validateMultilineText('a\r\nb', 3)).toBeNull();
    expect(validateMultilineText('a\nbc', 3)).toBe('TOO_LONG');
  });

  it('só quebra de linha é vazio; controle solto é inválido', () => {
    expect(validateMultilineText('\n\n', 5)).toBe('EMPTY');
    expect(validateMultilineText('a\rb', 5)).toBe('INVALID_CHARACTERS');
    expect(validateMultilineText('a\tb', 5)).toBe('INVALID_CHARACTERS');
  });
});

describe('splitCharacters', () => {
  it('separa em caracteres visíveis: acento decomposto e emoji composto valem um', () => {
    expect(splitCharacters('Fogo')).toEqual(['F', 'o', 'g', 'o']);
    expect(splitCharacters('e\u0301')).toHaveLength(1);
    expect(splitCharacters('👨‍👩‍👧👍🏽')).toHaveLength(2);
    expect(splitCharacters('')).toEqual([]);
  });
});

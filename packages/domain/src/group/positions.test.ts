import { describe, expect, it } from 'vitest';
import type { Position } from '../core';
import { MAX_SECONDARY_POSITIONS, validatePlayerPositions } from './positions';

describe('validatePlayerPositions', () => {
  it.each<[readonly Position[]]>([[[]], [['WINGER']], [['WINGER', 'MIDFIELDER']]])(
    'C3: principal DEFENDER com secundárias %j é válida',
    (secondaries) => {
      expect(validatePlayerPositions('DEFENDER', secondaries)).toEqual([]);
    },
  );

  it('C3: o limite padrão é MAX_SECONDARY_POSITIONS (2)', () => {
    expect(MAX_SECONDARY_POSITIONS).toBe(2);
  });

  it('C4: secundária igual à principal', () => {
    expect(validatePlayerPositions('DEFENDER', ['DEFENDER'])).toEqual(['SECONDARY_IS_PRIMARY']);
  });

  it('C4: secundária repetida', () => {
    expect(validatePlayerPositions('DEFENDER', ['WINGER', 'WINGER'])).toEqual([
      'DUPLICATE_SECONDARY',
    ]);
  });

  it('C4: GOALKEEPER como secundária', () => {
    expect(validatePlayerPositions('DEFENDER', ['GOALKEEPER'])).toEqual([
      'GOALKEEPER_AS_SECONDARY',
    ]);
  });

  it('C4: três secundárias', () => {
    expect(validatePlayerPositions('DEFENDER', ['WINGER', 'MIDFIELDER', 'FORWARD'])).toEqual([
      'TOO_MANY_SECONDARIES',
    ]);
  });

  it('C4: vários problemas vêm todos na lista, sem repetir código', () => {
    const errors = validatePlayerPositions('DEFENDER', [
      'DEFENDER',
      'DEFENDER',
      'GOALKEEPER',
      'GOALKEEPER',
    ]);
    expect([...errors].sort()).toEqual(
      [
        'DUPLICATE_SECONDARY',
        'GOALKEEPER_AS_SECONDARY',
        'SECONDARY_IS_PRIMARY',
        'TOO_MANY_SECONDARIES',
      ].sort(),
    );
    expect(new Set(errors).size).toBe(errors.length);
  });

  it('C4: respeita maxSecondaries da opção', () => {
    expect(
      validatePlayerPositions('DEFENDER', ['WINGER', 'MIDFIELDER'], { maxSecondaries: 1 }),
    ).toEqual(['TOO_MANY_SECONDARIES']);
    expect(
      validatePlayerPositions('DEFENDER', ['WINGER', 'MIDFIELDER', 'FORWARD'], {
        maxSecondaries: 3,
      }),
    ).toEqual([]);
  });

  it('C5: goleiro com secundária', () => {
    expect(validatePlayerPositions('GOALKEEPER', ['DEFENDER'])).toEqual([
      'GOALKEEPER_HAS_SECONDARY',
    ]);
  });

  it('C5: goleiro sem secundária é válido', () => {
    expect(validatePlayerPositions('GOALKEEPER', [])).toEqual([]);
  });

  it('C5: goleiro com secundária GOALKEEPER acusa a secundária de goleiro e a que ele tem', () => {
    const errors = validatePlayerPositions('GOALKEEPER', ['GOALKEEPER']);
    expect(errors).toContain('GOALKEEPER_HAS_SECONDARY');
    expect(new Set(errors).size).toBe(errors.length);
  });
});

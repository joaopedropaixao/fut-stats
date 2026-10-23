import { describe, expect, it } from 'vitest';
import { formatMatchDay, formatMatchTime, formatScore, pluralize } from './format';

describe('formatação do histórico', () => {
  it('data e hora no estilo do app', () => {
    const date = new Date(2026, 9, 24, 9, 0).toISOString();
    expect(formatMatchDay(date)).toBe('SÁB, 24 OUT');
    expect(formatMatchTime(date)).toBe('9H');
    expect(formatMatchTime(new Date(2026, 9, 24, 20, 30).toISOString())).toBe('20H30');
    expect(formatMatchTime(new Date(2026, 9, 24, 20, 5).toISOString())).toBe('20H05');
  });

  it('placar com ×', () => {
    expect(formatScore({ white: 4, black: 3 })).toBe('4×3');
  });

  it('singular e plural', () => {
    expect(pluralize(1, 'GOL', 'GOLS')).toBe('1 GOL');
    expect(pluralize(2, 'GOL', 'GOLS')).toBe('2 GOLS');
  });
});

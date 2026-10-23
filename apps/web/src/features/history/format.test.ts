import { describe, expect, it } from 'vitest';
import { formatMatchDay, formatMatchTime, formatMonth, groupByMonth, pluralize } from './format';

describe('formatação do histórico', () => {
  it('data e hora no estilo do app', () => {
    const date = new Date(2026, 9, 24, 9, 0).toISOString();
    expect(formatMatchDay(date)).toBe('SÁB, 24 OUT');
    expect(formatMatchTime(date)).toBe('9H');
    expect(formatMatchTime(new Date(2026, 9, 24, 20, 30).toISOString())).toBe('20H30');
    expect(formatMatchTime(new Date(2026, 9, 24, 20, 5).toISOString())).toBe('20H05');
  });

  it('mês por extenso, com o ano', () => {
    expect(formatMonth(new Date(2026, 2, 5, 19).toISOString())).toBe('MARÇO 2026');
  });

  it('agrupa por mês sem mudar a ordem', () => {
    const at = (month: number, day: number) => ({
      scheduledAt: new Date(2026, month, day, 19).toISOString(),
    });
    const items = [at(9, 22), at(9, 1), at(8, 24), at(7, 30)];
    expect(groupByMonth(items).map((g) => [g.month, g.items.length])).toEqual([
      ['OUTUBRO 2026', 2],
      ['SETEMBRO 2026', 1],
      ['AGOSTO 2026', 1],
    ]);
    expect(groupByMonth([])).toEqual([]);
  });

  it('singular e plural', () => {
    expect(pluralize(1, 'GOL', 'GOLS')).toBe('1 GOL');
    expect(pluralize(2, 'GOL', 'GOLS')).toBe('2 GOLS');
  });
});

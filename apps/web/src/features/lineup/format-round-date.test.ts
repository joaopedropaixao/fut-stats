import { describe, expect, it } from 'vitest';
import { formatRoundDate } from './format-round-date';

describe('formatRoundDate', () => {
  it('escreve dia da semana, dia, mês e hora; minutos só quando existem', () => {
    // Fuso local do teste: monta a data sem depender dele.
    const nine = new Date(2026, 9, 24, 9, 0).toISOString();
    const half = new Date(2026, 9, 24, 20, 30).toISOString();
    expect(formatRoundDate(nine)).toBe('SÁB, 24 OUT · 9H');
    expect(formatRoundDate(half)).toBe('SÁB, 24 OUT · 20H30');
  });
});

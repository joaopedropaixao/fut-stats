import { describe, expect, it } from 'vitest';
import { formatRoundDay, formatRoundTime, formatRoundWhen } from './round-format';

// 24 de outubro de 2026 é sábado; as datas são montadas no fuso local para o teste valer em qualquer máquina
const saturdayNine = new Date(2026, 9, 24, 9, 0);

describe('formato de data e hora da rodada', () => {
  it('dia da semana, dia e mês em caixa alta', () => {
    expect(formatRoundDay(saturdayNine)).toBe('SÁB, 24 OUT');
    expect(formatRoundDay(new Date(2026, 0, 1))).toBe('QUI, 1 JAN');
  });

  it('hora cheia sem minutos; as outras com minutos de dois dígitos', () => {
    expect(formatRoundTime(saturdayNine)).toBe('9H');
    expect(formatRoundTime(new Date(2026, 9, 24, 20, 30))).toBe('20H30');
    expect(formatRoundTime(new Date(2026, 9, 24, 20, 5))).toBe('20H05');
    expect(formatRoundTime(new Date(2026, 9, 24, 0, 0))).toBe('0H');
  });

  it('junta os dois, e aceita a data em texto ISO', () => {
    expect(formatRoundWhen(saturdayNine)).toBe('SÁB, 24 OUT · 9H');
    expect(formatRoundWhen(saturdayNine.toISOString())).toBe('SÁB, 24 OUT · 9H');
  });
});

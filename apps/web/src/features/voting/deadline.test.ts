import { describe, expect, it } from 'vitest';
import {
  clockOffset,
  closesInLabel,
  countdownParts,
  formatDeadlineAt,
  remainingMs,
} from './deadline';

const MIN = 60_000;
const HOUR = 60 * MIN;

describe('prazo da votação', () => {
  it('conta no relógio da API, não no do aparelho', () => {
    // O aparelho está 5 min atrasado em relação à API
    const received = Date.UTC(2026, 10, 15, 12, 0);
    const offset = clockOffset(new Date(received + 5 * MIN).toISOString(), received);
    expect(offset).toBe(5 * MIN);
    const deadline = new Date(received + 5 * MIN + 2 * HOUR).toISOString();
    expect(remainingMs(deadline, offset, received)).toBe(2 * HOUR);
  });

  it('sem prazo, não há contagem', () => {
    expect(remainingMs(null, 0)).toBeNull();
  });

  it('"fecha em": horas cheias, depois minutos, depois o fim', () => {
    expect(closesInLabel(5 * HOUR + 40 * MIN)).toBe('Fecha em 5 h');
    expect(closesInLabel(HOUR)).toBe('Fecha em 1 h');
    expect(closesInLabel(59 * MIN)).toBe('Fecha em 59 min');
    expect(closesInLabel(10_000)).toBe('Fecha em 1 min');
    expect(closesInLabel(0)).toBe('Prazo acabando');
    expect(closesInLabel(-5)).toBe('Prazo acabando');
  });

  it('contagem com dois dígitos e sem negativo', () => {
    expect(countdownParts(2 * HOUR + 14 * MIN + 30_000)).toEqual({ hours: '02', minutes: '14' });
    expect(countdownParts(24 * HOUR)).toEqual({ hours: '24', minutes: '00' });
    expect(countdownParts(-1)).toEqual({ hours: '00', minutes: '00' });
  });

  it('o dia do prazo é o dia real, em minúsculas', () => {
    expect(formatDeadlineAt(new Date(2026, 9, 24, 21, 0))).toBe('sáb às 21h');
    expect(formatDeadlineAt(new Date(2026, 9, 25, 9, 30))).toBe('dom às 9h30');
  });
});

import { describe, expect, it } from 'vitest';
import { suggestNextRoundDate } from './schedule';

const now = new Date('2026-10-24T15:00:00Z');

describe('suggestNextRoundDate', () => {
  it('sem rodada anterior não sugere', () => {
    expect(suggestNextRoundDate(null, now)).toBeNull();
  });

  it('mesmo dia da semana e horário da última, na próxima data que ainda não passou', () => {
    const last = new Date('2026-10-22T23:00:00Z');
    expect(suggestNextRoundDate(last, now)).toEqual(new Date('2026-10-29T23:00:00Z'));
  });

  it('última bem antiga: pula as semanas que já passaram', () => {
    const last = new Date('2026-09-03T23:00:00Z');
    expect(suggestNextRoundDate(last, now)).toEqual(new Date('2026-10-29T23:00:00Z'));
  });

  it('última ainda no futuro: a sugestão é a semana seguinte a ela', () => {
    const last = new Date('2026-10-29T23:00:00Z');
    expect(suggestNextRoundDate(last, now)).toEqual(new Date('2026-11-05T23:00:00Z'));
  });

  it('o intervalo é configurável (pelada a cada 14 dias)', () => {
    const last = new Date('2026-10-22T23:00:00Z');
    expect(suggestNextRoundDate(last, now, { intervalDays: 14 })).toEqual(
      new Date('2026-11-05T23:00:00Z'),
    );
  });
});

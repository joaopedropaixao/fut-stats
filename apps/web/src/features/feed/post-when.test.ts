import { describe, expect, it } from 'vitest';
import { postWhen } from './post-when';

// Datas locais (o app mostra no fuso do aparelho): o teste não depende do fuso da máquina
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min);

describe('quando saiu a resenha (C35)', () => {
  const now = at(2026, 11, 15, 22, 10);

  it('hoje e ontem trazem a hora', () => {
    expect(postWhen(at(2026, 11, 15, 21), now)).toBe('HOJE, 21H');
    expect(postWhen(at(2026, 11, 15, 9, 30), now)).toBe('HOJE, 9H30');
    expect(postWhen(at(2026, 11, 14, 21), now)).toBe('ONTEM, 21H');
  });

  it('antes de ontem vira a data no formato do app, com o dia da semana tirado da data', () => {
    expect(postWhen(at(2026, 10, 17, 17), now)).toBe('SÁB, 17 OUT');
    expect(postWhen(at(2026, 11, 13, 23, 59), now)).toBe('SEX, 13 NOV');
  });

  it('a virada do dia conta pelo calendário, não por 24 h', () => {
    const early = at(2026, 11, 15, 0, 5);
    expect(postWhen(at(2026, 11, 14, 23, 50), early)).toBe('ONTEM, 23H50');
    expect(postWhen(at(2026, 11, 14, 0, 1), at(2026, 11, 15, 23, 59))).toBe('ONTEM, 0H01');
  });

  it('aceita o texto ISO que a API manda', () => {
    const iso = at(2026, 11, 15, 21).toISOString();
    expect(postWhen(iso, now)).toBe('HOJE, 21H');
  });

  it('dia 1 do mês: ontem é o último do mês anterior', () => {
    expect(postWhen(at(2026, 10, 31, 20), at(2026, 11, 1, 10))).toBe('ONTEM, 20H');
  });
});

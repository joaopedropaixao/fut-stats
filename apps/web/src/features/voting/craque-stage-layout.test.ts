import { describe, expect, it } from 'vitest';
import { CRAQUE_ROW, craqueColumn } from './craque-stage-layout';

describe('largura do Craque no palco do resultado (C25)', () => {
  it('a linha das cartas tem largura real: sem ela a coluna encolhe ao conteúdo e o banner e a tecla ficam estreitos', () => {
    expect(CRAQUE_ROW.split(' ')).toContain('w-full');
  });

  it('o Craque sozinho alarga a coluna (banner e tecla) até 320 px a partir de 360 px; abaixo, 240 px', () => {
    const solo = craqueColumn(false).split(' ');
    expect(solo).toEqual(
      expect.arrayContaining(['w-60', 'min-[360px]:w-full', 'min-[360px]:max-w-xs']),
    );
  });

  it('o empate segue com uma coluna de 240 px por Craque', () => {
    const tie = craqueColumn(true).split(' ');
    expect(tie).toContain('w-60');
    expect(tie).not.toContain('min-[360px]:w-full');
  });
});

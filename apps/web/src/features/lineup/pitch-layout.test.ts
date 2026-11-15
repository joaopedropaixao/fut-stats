import { describe, expect, it } from 'vitest';
import { SLOTS } from './lineup-draft';
import { PITCH_HEIGHT, PITCH_HEIGHT_ME, SLOT_BLOCK_MAX, SLOT_POSITION } from './pitch-layout';

const tops = (keys: readonly (keyof typeof SLOT_POSITION)[]) => SLOT_POSITION[keys[0]!].top;

describe('layout do campo (C27, 320 px)', () => {
  it('cada linha do 1-2-3-1 começa depois que o bloco mais alto da linha de cima termina', () => {
    // Nome de 10 letras + etiqueta VOCÊ + "Sem presença" ocupam o bloco inteiro: nada se sobrepõe nem encosta
    const rows = [['FWD'], ['WING1', 'WING2'], ['MID'], ['DEF1', 'DEF2'], ['GK']] as const;
    rows.forEach((row, i) => {
      for (const key of row) expect(SLOT_POSITION[key].top).toBe(tops(row));
      const next = rows[i + 1];
      if (next) expect(tops(row) + SLOT_BLOCK_MAX).toBeLessThanOrEqual(tops(next));
    });
  });

  it('o goleiro com "VOCÊ" ainda cabe dentro do campo', () => {
    expect(SLOT_POSITION.GK.top + SLOT_BLOCK_MAX).toBeLessThanOrEqual(PITCH_HEIGHT_ME);
    expect(PITCH_HEIGHT_ME).toBeGreaterThan(PITCH_HEIGHT);
  });

  it('toda vaga do 1-2-3-1 tem posição', () => {
    for (const { key } of SLOTS) expect(SLOT_POSITION[key]).toBeDefined();
  });
});

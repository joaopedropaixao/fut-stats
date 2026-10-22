import { describe, expect, it } from 'vitest';
import { seededRandom } from './random';

describe('seededRandom', () => {
  it('gera a mesma sequência para o mesmo seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('gera números em [0, 1)', () => {
    const random = seededRandom(123);
    for (let i = 0; i < 1000; i += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { roundHasPack } from './pack';

describe('roundHasPack', () => {
  it('tem pacote com um Craque com nota', () => {
    expect(
      roundHasPack([
        { isMvp: false, score: 6.5 },
        { isMvp: true, score: 8.2 },
      ]),
    ).toBe(true);
  });

  it('não tem pacote sem Craque, com Craque sem nota ou sem jogadores', () => {
    expect(roundHasPack([{ isMvp: false, score: 7 }])).toBe(false);
    expect(roundHasPack([{ isMvp: true, score: null }])).toBe(false);
    expect(roundHasPack([])).toBe(false);
  });
});

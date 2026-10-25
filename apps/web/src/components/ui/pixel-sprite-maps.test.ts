import { describe, expect, it } from 'vitest';
import { PLAYER_SPRITE, spritePaths, teamPalette } from './pixel-sprite-maps';

describe('spritePaths', () => {
  it('junta pixels vizinhos da mesma cor num retângulo só', () => {
    expect(spritePaths(['.aa.', 'b..b'], { a: '#111', b: '#222' })).toEqual({
      '#111': 'M1 0h2v1h-2z',
      '#222': 'M0 1h1v1h-1zM3 1h1v1h-1z',
    });
  });

  it('ignora o que não está na paleta', () => {
    expect(spritePaths(['.x.'], { a: '#111' })).toEqual({});
  });

  it('o bonequinho tem 12 linhas de 8 colunas e as duas camisas diferem', () => {
    expect(PLAYER_SPRITE).toHaveLength(12);
    expect(PLAYER_SPRITE.every((row) => row.length === 8)).toBe(true);
    expect(teamPalette('white').T).not.toBe(teamPalette('black').T);
  });
});

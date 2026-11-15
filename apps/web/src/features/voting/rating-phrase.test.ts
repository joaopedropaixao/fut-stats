import { describe, expect, it } from 'vitest';
import { ratingPhrase } from './rating-phrase';

describe('frase da nota', () => {
  it.each([
    [0, 'Dia pra esquecer'],
    [3, 'Dia pra esquecer'],
    [3.5, 'Ficou devendo'],
    [5, 'Ficou devendo'],
    [5.5, 'Fez o seu'],
    [6, 'Fez o seu'],
    [6.5, 'Fez o seu'],
    [7, 'Jogou muito'],
    [8, 'Jogou muito'],
    [8.5, 'Monstro'],
    [9.5, 'Monstro'],
    [10, 'Lendário'],
  ])('nota %s: %s', (value, phrase) => {
    expect(ratingPhrase(value)).toBe(phrase);
  });
});

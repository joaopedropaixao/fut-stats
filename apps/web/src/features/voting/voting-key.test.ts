import { describe, expect, it } from 'vitest';
import { votingKeyLabel } from './voting-key';

describe('tecla do aviso grande da votação (sempre amarela)', () => {
  it('joguei e não votei: dar as notas', () => {
    expect(votingKeyLabel(true, false)).toBe('Dar minhas notas');
  });
  it('já votei: ver meus votos', () => {
    expect(votingKeyLabel(true, true)).toBe('Ver meus votos');
  });
  it('não joguei: ver a votação (a tela explica que só quem jogou vota)', () => {
    expect(votingKeyLabel(false, false)).toBe('Ver votação');
  });
});

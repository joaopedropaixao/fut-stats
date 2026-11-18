import { describe, expect, it } from 'vitest';
import { FLOP_PHRASES, flopPhrase, impactPhrase } from './impact-phrase';

const line = { goals: 0, assists: 0, position: 'MIDFIELDER' } as const;
const lost = { won: false };
const won = { won: true };

describe('impactPhrase', () => {
  it('V1a: 3 ou mais gols é hat-trick', () => {
    expect(impactPhrase({ ...line, goals: 3 }, lost)).toBe('Hat-trick!');
    expect(impactPhrase({ ...line, goals: 4, assists: 2 }, lost)).toBe('Hat-trick!');
  });

  it('V1a: gol e assistência é dono do jogo', () => {
    expect(impactPhrase({ ...line, goals: 1, assists: 1 }, lost)).toBe('Dono do jogo');
    // 2 gols com assistência ainda é "dono do jogo": vem antes de "decidiu a partida"
    expect(impactPhrase({ ...line, goals: 2, assists: 1 }, lost)).toBe('Dono do jogo');
  });

  it('V1a: 2 gols decidem a partida', () => {
    expect(impactPhrase({ ...line, goals: 2 }, lost)).toBe('Decidiu a partida');
  });

  it('V1a: 2 ou mais assistências é garçom da noite', () => {
    expect(impactPhrase({ ...line, assists: 2 }, lost)).toBe('Garçom da noite');
    expect(impactPhrase({ ...line, assists: 3 }, lost)).toBe('Garçom da noite');
  });

  it('V1a: goleiro sem gol nem 2 assistências é paredão no gol', () => {
    expect(impactPhrase({ ...line, position: 'GOALKEEPER' }, lost)).toBe('Paredão no gol');
    expect(impactPhrase({ ...line, position: 'GOALKEEPER', assists: 1 }, lost)).toBe(
      'Paredão no gol',
    );
  });

  it('V1a: goleiro que fez gol e assistência ainda é dono do jogo (a ordem manda)', () => {
    expect(impactPhrase({ goals: 1, assists: 1, position: 'GOALKEEPER' }, lost)).toBe(
      'Dono do jogo',
    );
  });

  it('V1a: 1 gol balança a rede', () => {
    expect(impactPhrase({ ...line, goals: 1 }, lost)).toBe('Balançou a rede');
  });

  it('C4: 1 assistência (sem gol), de linha, é "Deu o passe"', () => {
    expect(impactPhrase({ ...line, assists: 1 }, lost)).toBe('Deu o passe');
    expect(impactPhrase({ ...line, position: 'WINGER', assists: 1 }, lost)).toBe('Deu o passe');
  });

  it('C4: 1 assistência com a vitória soma "e ainda levou a vitória"', () => {
    expect(impactPhrase({ ...line, assists: 1 }, won)).toBe('Deu o passe e ainda levou a vitória');
  });

  it('C4: 1 assistência vem depois das regras mais fortes e antes de 1 gol', () => {
    // 2 assistências e gol com assistência continuam nas frases de antes
    expect(impactPhrase({ ...line, assists: 2 }, lost)).toBe('Garçom da noite');
    expect(impactPhrase({ ...line, goals: 1, assists: 1 }, lost)).toBe('Dono do jogo');
    // 1 gol (sem assistência) continua "Balançou a rede"
    expect(impactPhrase({ ...line, goals: 1 }, lost)).toBe('Balançou a rede');
  });

  it('C5: goleiro com 1 assistência continua paredão no gol (goleiro vem antes)', () => {
    expect(impactPhrase({ ...line, position: 'GOALKEEPER', assists: 1 }, won)).toBe(
      'Paredão no gol e ainda levou a vitória',
    );
  });

  it('C6: sem gol nem assistência, jogou demais', () => {
    expect(impactPhrase(line, lost)).toBe('Jogou demais');
    expect(impactPhrase(line, won)).toBe('Jogou demais e ainda levou a vitória');
  });

  it('V1a: time vencedor soma "e ainda levou a vitória", em qualquer regra', () => {
    expect(impactPhrase({ ...line, goals: 3 }, won)).toBe('Hat-trick e ainda levou a vitória');
    expect(impactPhrase({ ...line, goals: 1, assists: 1 }, won)).toBe(
      'Dono do jogo e ainda levou a vitória',
    );
    expect(impactPhrase(line, won)).toBe('Jogou demais e ainda levou a vitória');
  });
});

describe('flopPhrase', () => {
  it('V1b: é uma das três frases', () => {
    expect(FLOP_PHRASES).toHaveLength(3);
    for (const id of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      expect(FLOP_PHRASES).toContain(flopPhrase('rodada-9', id));
    }
  });

  it('V1b: é estável: a mesma rodada e o mesmo jogador dão sempre a mesma frase', () => {
    const first = flopPhrase('rodada-9', 'dede');
    for (let i = 0; i < 20; i += 1) expect(flopPhrase('rodada-9', 'dede')).toBe(first);
  });

  it('V1b: varia entre jogadores e rodadas (não é sempre a mesma)', () => {
    const phrases = new Set<string>();
    for (let i = 0; i < 30; i += 1) phrases.add(flopPhrase(`rodada-${i}`, `jogador-${i * 7}`));
    expect(phrases.size).toBe(3);
  });
});

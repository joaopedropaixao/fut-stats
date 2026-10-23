import type { HistoryPlayer } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import { placeOnPitch, playerSummary, resultLabel } from './match-view';

const player = (nickname: string, position: HistoryPlayer['position'], goals = 0, assists = 0) => ({
  membershipId: nickname,
  nickname,
  photoUrl: null,
  position,
  isHiredGoalkeeper: false,
  goals,
  assists,
});

describe('resultado por escrito', () => {
  it('diz quem venceu, empate, em jogo ou sem placar', () => {
    expect(resultLabel({ winner: 'WHITE', status: 'CLOSED' })).toBe('Branco venceu');
    expect(resultLabel({ winner: 'BLACK', status: 'VOTING' })).toBe('Preto venceu');
    expect(resultLabel({ winner: 'DRAW', status: 'CLOSED' })).toBe('Empate');
    expect(resultLabel({ winner: null, status: 'IN_PROGRESS' })).toBe('Em jogo');
    expect(resultLabel({ winner: null, status: 'CLOSED' })).toBe('Sem placar');
  });
});

describe('campo 1-2-3-1', () => {
  it('põe cada titular numa vaga da posição dele', () => {
    const starters = [
      player('Gol', 'GOALKEEPER'),
      player('Zag1', 'DEFENDER'),
      player('Zag2', 'DEFENDER'),
      player('Ala1', 'WINGER'),
      player('Ala2', 'WINGER'),
      player('Meia', 'MIDFIELDER'),
      player('Ata', 'FORWARD'),
    ];
    const { placed, leftover } = placeOnPitch(starters);
    expect(placed).toHaveLength(7);
    expect(leftover).toEqual([]);
    const spots = new Set(placed.map((p) => `${p.left}/${p.top}`));
    expect(spots.size).toBe(7);
  });

  it('quem não cabe na formação sobra (vai para o banco), sem sumir', () => {
    const { placed, leftover } = placeOnPitch([
      player('Ata1', 'FORWARD'),
      player('Ata2', 'FORWARD'),
    ]);
    expect(placed.map((p) => p.player.nickname)).toEqual(['Ata1']);
    expect(leftover.map((p) => p.nickname)).toEqual(['Ata2']);
  });

  it('resume a vaga para o leitor de tela', () => {
    expect(playerSummary(player('Nico', 'FORWARD', 3, 1))).toBe(
      'Atacante: Nico, 3 gols e 1 assistência',
    );
    expect(playerSummary(player('Paredão', 'GOALKEEPER'))).toBe('Goleiro: Paredão');
  });
});

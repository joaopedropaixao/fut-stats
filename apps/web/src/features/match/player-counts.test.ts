import { describe, expect, it } from 'vitest';
import { lastRemovable, ownGoalLabel, ownGoalsFor, playerCounts } from './player-counts';

const events = [
  { id: 'a', membershipId: 'm1', type: 'GOAL', canRemove: true },
  { id: 'b', membershipId: 'm2', type: 'GOAL', canRemove: true },
  { id: 'c', membershipId: 'm1', type: 'ASSIST', canRemove: true },
  { id: 'd', membershipId: 'm1', type: 'GOAL', canRemove: true },
  { id: 'e', membershipId: 'm1', type: 'OWN_GOAL', canRemove: false },
] as const;

describe('playerCounts', () => {
  it('conta os lances de cada tipo só do jogador', () => {
    expect(playerCounts(events, 'm1')).toEqual({ GOAL: 2, ASSIST: 1, OWN_GOAL: 1 });
    expect(playerCounts(events, 'm2')).toEqual({ GOAL: 1, ASSIST: 0, OWN_GOAL: 0 });
  });

  it('jogador sem lances fica zerado', () => {
    expect(playerCounts(events, 'm9')).toEqual({ GOAL: 0, ASSIST: 0, OWN_GOAL: 0 });
  });
});

describe('lastRemovable', () => {
  it('devolve o último lance daquele tipo do jogador', () => {
    expect(lastRemovable(events, 'm1', 'GOAL')?.id).toBe('d');
    expect(lastRemovable(events, 'm1', 'ASSIST')?.id).toBe('c');
  });

  it('pula o que quem vê não pode apagar e devolve nada quando não sobra lance', () => {
    expect(lastRemovable(events, 'm1', 'OWN_GOAL')).toBeUndefined();
    expect(lastRemovable(events, 'm2', 'ASSIST')).toBeUndefined();
  });
});

describe('ownGoalsFor', () => {
  const lances = [
    { id: 'a', type: 'GOAL', team: 'WHITE', playerTeam: 'WHITE', nickname: 'Luquinha' },
    { id: 'b', type: 'OWN_GOAL', team: 'BLACK', playerTeam: 'WHITE', nickname: 'Diegão' },
    { id: 'c', type: 'OWN_GOAL', team: 'WHITE', playerTeam: 'BLACK', nickname: 'Nico' },
  ] as const;

  it('traz os gols contra que contam para o time, não os que ele fez', () => {
    expect(ownGoalsFor(lances, 'BLACK').map((l) => l.id)).toEqual(['b']);
    expect(ownGoalsFor(lances, 'WHITE').map((l) => l.id)).toEqual(['c']);
  });

  it('o rótulo diz quem fez e de que time', () => {
    expect(ownGoalLabel('Diegão', 'Branco')).toBe('Gol contra de Diegão (Branco)');
  });
});

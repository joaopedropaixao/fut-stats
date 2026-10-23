import type { Lineup } from '@fut-stats/shared';
import { describe, expect, it } from 'vitest';
import {
  countStarters,
  draftFromLineup,
  emptyDraft,
  locate,
  placeInReserve,
  placeInSlot,
  sendToBench,
  toSaveInput,
} from './lineup-draft';

const player = (
  membershipId: string,
  position: Lineup['teams']['WHITE']['starters'][number]['position'],
) => ({
  membershipId,
  nickname: membershipId,
  photoUrl: null,
  primaryPosition: position,
  isHiredGoalkeeper: false,
  position,
});

describe('placeInSlot', () => {
  it('põe do banco na vaga e o antigo dono volta para o banco', () => {
    const a = placeInSlot(emptyDraft(), 'WHITE', 'GK', 'a');
    const b = placeInSlot(a, 'WHITE', 'GK', 'b');
    expect(b.WHITE.slots.GK).toBe('b');
    expect(locate(b, 'a')).toBeNull();
  });

  it('vindo de outra vaga, troca de lugar com o dono', () => {
    let d = placeInSlot(emptyDraft(), 'WHITE', 'DEF1', 'a');
    d = placeInSlot(d, 'WHITE', 'DEF2', 'b');
    d = placeInSlot(d, 'WHITE', 'DEF2', 'a');
    expect(d.WHITE.slots.DEF1).toBe('b');
    expect(d.WHITE.slots.DEF2).toBe('a');
  });

  it('mover de um time para o outro libera a vaga antiga', () => {
    let d = placeInSlot(emptyDraft(), 'WHITE', 'FWD', 'a');
    d = placeInSlot(d, 'BLACK', 'FWD', 'a');
    expect(d.WHITE.slots.FWD).toBeNull();
    expect(locate(d, 'a')).toEqual({ team: 'BLACK', kind: 'slot', key: 'FWD' });
  });

  it('não muda nada ao pôr o jogador onde ele já está', () => {
    const d = placeInSlot(emptyDraft(), 'WHITE', 'MID', 'a');
    expect(placeInSlot(d, 'WHITE', 'MID', 'a')).toBe(d);
  });
});

describe('reservas', () => {
  it('aceita até 2 por time e ignora a terceira', () => {
    let d = placeInReserve(emptyDraft(), 'WHITE', 'a');
    d = placeInReserve(d, 'WHITE', 'b');
    const third = placeInReserve(d, 'WHITE', 'c');
    expect(third).toBe(d);
    expect(third.WHITE.reserves).toEqual(['a', 'b']);
  });

  it('titular que vira reserva libera a vaga; trocar um titular por um reserva manda o reserva para a vaga', () => {
    let d = placeInSlot(emptyDraft(), 'WHITE', 'GK', 'a');
    d = placeInReserve(d, 'WHITE', 'a');
    expect(d.WHITE.slots.GK).toBeNull();

    d = placeInSlot(d, 'WHITE', 'GK', 'b');
    d = placeInSlot(d, 'WHITE', 'GK', 'a');
    expect(d.WHITE.slots.GK).toBe('a');
    expect(d.WHITE.reserves).toEqual(['b']);
  });
});

describe('reserva cheia: tocar numa caixa ocupada troca', () => {
  it('quem vem do banco entra na caixa e o dono volta para o banco', () => {
    let d = placeInReserve(emptyDraft(), 'BLACK', 'a');
    d = placeInReserve(d, 'BLACK', 'b');
    d = placeInReserve(d, 'BLACK', 'c', 0);
    expect(d.BLACK.reserves).toEqual(['c', 'b']);
    expect(locate(d, 'a')).toBeNull();
  });

  it('quem vem de uma vaga troca de lugar com o reserva', () => {
    let d = placeInSlot(emptyDraft(), 'WHITE', 'MID', 'm');
    d = placeInReserve(d, 'WHITE', 'a');
    d = placeInReserve(d, 'WHITE', 'b');
    d = placeInReserve(d, 'WHITE', 'm', 1);
    expect(d.WHITE.reserves).toEqual(['a', 'm']);
    expect(d.WHITE.slots.MID).toBe('b');
  });

  it('dois reservas do mesmo time trocam de caixa', () => {
    let d = placeInReserve(emptyDraft(), 'WHITE', 'a');
    d = placeInReserve(d, 'WHITE', 'b');
    expect(placeInReserve(d, 'WHITE', 'a', 1).WHITE.reserves).toEqual(['b', 'a']);
  });

  it('caixa livre continua indo para o fim da fila', () => {
    const d = placeInReserve(emptyDraft(), 'WHITE', 'a', 1);
    expect(d.WHITE.reserves).toEqual(['a']);
  });
});

describe('sendToBench', () => {
  it('tira o jogador da vaga ou da reserva', () => {
    let d = placeInSlot(emptyDraft(), 'BLACK', 'GK', 'a');
    d = placeInReserve(d, 'BLACK', 'b');
    d = sendToBench(sendToBench(d, 'a'), 'b');
    expect(locate(d, 'a')).toBeNull();
    expect(locate(d, 'b')).toBeNull();
    expect(countStarters(d, 'BLACK')).toBe(0);
  });
});

describe('API ↔ rascunho', () => {
  it('ida e volta mantém titulares na posição e reservas', () => {
    const lineup: Lineup = {
      published: false,
      errors: [],
      unassigned: [],
      teams: {
        WHITE: {
          starters: [player('a', 'GOALKEEPER'), player('b', 'DEFENDER'), player('c', 'DEFENDER')],
          reserves: [player('r', 'FORWARD')],
        },
        BLACK: { starters: [], reserves: [] },
      },
    };
    const draft = draftFromLineup(lineup);
    expect(draft.WHITE.slots).toMatchObject({ GK: 'a', DEF1: 'b', DEF2: 'c' });
    expect(toSaveInput(draft)).toEqual({
      WHITE: {
        starters: [
          { membershipId: 'a', position: 'GOALKEEPER' },
          { membershipId: 'b', position: 'DEFENDER' },
          { membershipId: 'c', position: 'DEFENDER' },
        ],
        reserves: ['r'],
      },
      BLACK: { starters: [], reserves: [] },
    });
  });
});

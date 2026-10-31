import { teamBalance } from '@fut-stats/domain';
import { describe, expect, it } from 'vitest';
import { draftBalance, type BalanceMember } from './lineup';
import type { SaveLineupInput } from './lineup';

const member = (
  membershipId: string,
  primaryPosition: BalanceMember['primaryPosition'],
  rating: number,
): BalanceMember => ({ membershipId, primaryPosition, rating });

describe('draftBalance', () => {
  const members = [
    member('g1', 'GOALKEEPER', 8),
    member('d1', 'DEFENDER', 6),
    member('w1', 'WINGER', 10),
    member('r1', 'DEFENDER', 7),
    member('g2', 'GOALKEEPER', 5),
    member('f1', 'FORWARD', 5),
  ];
  const draft: SaveLineupInput = {
    WHITE: {
      starters: [
        { membershipId: 'g1', position: 'GOALKEEPER' },
        { membershipId: 'd1', position: 'DEFENDER' },
        { membershipId: 'w1', position: 'DEFENDER' },
      ],
      reserves: ['r1'],
    },
    BLACK: {
      starters: [
        { membershipId: 'g2', position: 'GOALKEEPER' },
        { membershipId: 'f1', position: 'FORWARD' },
        { membershipId: 'nobody', position: 'DEFENDER' },
      ],
      reserves: [],
    },
  };

  it('C12: dá o mesmo resultado do teamBalance com o rascunho convertido', () => {
    const expected = teamBalance(
      {
        WHITE: [
          { playerId: 'g1', position: 'GOALKEEPER' },
          { playerId: 'd1', position: 'DEFENDER' },
          { playerId: 'w1', position: 'DEFENDER' },
        ],
        BLACK: [
          { playerId: 'g2', position: 'GOALKEEPER' },
          { playerId: 'f1', position: 'FORWARD' },
          { playerId: 'nobody', position: 'DEFENDER' },
        ],
        reserves: { WHITE: ['r1'], BLACK: [] },
      },
      members.map((m) => ({
        id: m.membershipId,
        primaryPosition: m.primaryPosition,
        rating: m.rating,
      })),
    );

    const result = draftBalance(draft, members);

    expect(result).toEqual(expected);
    // Branco: (8 + 6 + 9 + 7) / 4 = 7,5; Preto: (5 + 5) / 2 = 5 (quem não é membro é ignorado)
    expect(result.average).toEqual({ WHITE: 7.5, BLACK: 5 });
  });

  it('C12: rascunho vazio não compara', () => {
    const empty: SaveLineupInput = {
      WHITE: { starters: [], reserves: [] },
      BLACK: { starters: [], reserves: [] },
    };
    expect(draftBalance(empty, members).balanced).toBeNull();
  });
});

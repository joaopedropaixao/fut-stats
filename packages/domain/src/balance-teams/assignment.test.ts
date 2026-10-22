import { describe, expect, it } from 'vitest';
import { solveAssignment } from './assignment';

function total(cost: number[][], columns: number[]): number {
  return columns.reduce((sum, col, row) => sum + cost[row]![col]!, 0);
}

describe('solveAssignment', () => {
  it('acha a atribuição de menor custo', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2],
    ];
    const columns = solveAssignment(cost);

    expect(new Set(columns).size).toBe(3);
    expect(total(cost, columns)).toBe(5);
  });

  it('não cai na escolha gulosa', () => {
    // Guloso daria linha 0 -> coluna 0 (custo 0) e forçaria 100 na linha 1.
    const cost = [
      [0, 1],
      [2, 100],
    ];
    expect(solveAssignment(cost)).toEqual([1, 0]);
  });

  it('aceita matriz vazia', () => {
    expect(solveAssignment([])).toEqual([]);
  });
});

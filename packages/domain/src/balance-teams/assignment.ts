/**
 * Problema de atribuição (algoritmo húngaro, O(n³)): dada uma matriz quadrada
 * `cost[linha][coluna]`, escolhe uma coluna diferente para cada linha com a menor soma.
 * Devolve a coluna escolhida para cada linha.
 */
export function solveAssignment(cost: readonly (readonly number[])[]): number[] {
  const n = cost.length;
  // Potenciais (u, v) e casamento coluna -> linha (p), indexados a partir de 1.
  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(n + 1).fill(0);
  const p = new Array<number>(n + 1).fill(0);
  const way = new Array<number>(n + 1).fill(0);

  for (let row = 1; row <= n; row += 1) {
    p[0] = row;
    let j0 = 0;
    const minv = new Array<number>(n + 1).fill(Infinity);
    const used = new Array<boolean>(n + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0]!;
      let delta = Infinity;
      let j1 = 0;
      for (let j = 1; j <= n; j += 1) {
        if (used[j]) continue;
        const reduced = cost[i0 - 1]![j - 1]! - u[i0]! - v[j]!;
        if (reduced < minv[j]!) {
          minv[j] = reduced;
          way[j] = j0;
        }
        if (minv[j]! < delta) {
          delta = minv[j]!;
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j += 1) {
        if (used[j]) {
          u[p[j]!]! += delta;
          v[j]! -= delta;
        } else {
          minv[j]! -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0]!;
      p[j0] = p[j1]!;
      j0 = j1;
    } while (j0 !== 0);
  }

  const columnOf = new Array<number>(n).fill(-1);
  for (let col = 1; col <= n; col += 1) columnOf[p[col]! - 1] = col - 1;
  return columnOf;
}

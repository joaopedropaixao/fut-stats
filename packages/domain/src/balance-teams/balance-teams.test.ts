import { describe, expect, it } from 'vitest';
import { isValidRoundLineup, type LineupSlot, type Player, type Position } from '../core';
import type { MatchScore } from '../round/match';
import {
  balanceTeams,
  type BalancedRound,
  type BalanceTeamsConfig,
  type BalanceTeamsResult,
  type PastRound,
} from './balance-teams';
import { seededRandom } from './random';

function player(
  id: string,
  primaryPosition: Position,
  rating = 5,
  secondaryPositions: Position[] = [],
): Player {
  return { id, primaryPosition, secondaryPositions, rating };
}

/** 14 jogadores, todos na posição principal: 2 GOL, 4 ZAG, 4 ALA, 2 MEI, 2 ATA. */
function fourteen(rating = 5): Player[] {
  return [
    player('g1', 'GOALKEEPER', rating),
    player('g2', 'GOALKEEPER', rating),
    player('d1', 'DEFENDER', rating),
    player('d2', 'DEFENDER', rating),
    player('d3', 'DEFENDER', rating),
    player('d4', 'DEFENDER', rating),
    player('w1', 'WINGER', rating),
    player('w2', 'WINGER', rating),
    player('w3', 'WINGER', rating),
    player('w4', 'WINGER', rating),
    player('m1', 'MIDFIELDER', rating),
    player('m2', 'MIDFIELDER', rating),
    player('f1', 'FORWARD', rating),
    player('f2', 'FORWARD', rating),
  ];
}

function extras(count: number, rating = 5): Player[] {
  return Array.from({ length: count }, (_, i) => player(`x${i + 1}`, 'WINGER', rating));
}

function expectOk(result: BalanceTeamsResult): Extract<BalanceTeamsResult, { ok: true }> {
  if (!result.ok) throw new Error(`esperava sucesso, veio ${result.error}`);
  return result;
}

function allIds(round: BalancedRound): string[] {
  return [
    ...round.WHITE.map((s) => s.playerId),
    ...round.BLACK.map((s) => s.playerId),
    ...round.reserves.WHITE,
    ...round.reserves.BLACK,
  ];
}

function slotOf(round: BalancedRound, playerId: string) {
  return [...round.WHITE, ...round.BLACK].find((s) => s.playerId === playerId);
}

/** Id de quem não está entre os confirmados dos testes: só enche a rodada do histórico. */
const old = (n: number) => `old-${n}`;

/**
 * Rodada do histórico. `white`/`black` são os jogadores de linha (os goleiros entram por `gks`); o resto da
 * rodada é completado com ids "old-N" até 6 de linha por time, para a chance de cair junto ser sempre 5/11.
 */
function past(
  white: string[],
  black: string[],
  score?: MatchScore | null,
  gks: [string, string] = ['old-g1', 'old-g2'],
): PastRound {
  const fill = (ids: string[], from: number) => [
    ...ids,
    ...Array.from({ length: 6 - ids.length }, (_, i) => old(from + i)),
  ];
  const slots = (gk: string, ids: string[]): LineupSlot[] => [
    { playerId: gk, position: 'GOALKEEPER' },
    ...ids.map((playerId) => ({ playerId, position: 'DEFENDER' as const })),
  ];
  return {
    WHITE: slots(gks[0], fill(white, 0)),
    BLACK: slots(gks[1], fill(black, 100)),
    ...(score === undefined ? {} : { score }),
  };
}

/** Rodada sem nenhum dos confirmados: só ocupa um lugar na janela de recência. */
const filler = (): PastRound => past([], []);

function teamOf(round: BalancedRound, id: string): 'WHITE' | 'BLACK' {
  const white = round.WHITE.some((s) => s.playerId === id) || round.reserves.WHITE.includes(id);
  return white ? 'WHITE' : 'BLACK';
}

/** Em quantos seeds (1 a `seeds`) os dois caem no mesmo time. */
function seedsTogether(
  a: string,
  b: string,
  history: PastRound[],
  config: Partial<BalanceTeamsConfig>,
  players = fourteen(),
  seeds = 30,
): number {
  let count = 0;
  for (let seed = 1; seed <= seeds; seed += 1) {
    const { round } = expectOk(
      balanceTeams(players, history, { tolerance: 0, ...config, random: seededRandom(seed) }),
    );
    if (teamOf(round, a) === teamOf(round, b)) count += 1;
  }
  return count;
}

/** Quem está com quem, ignorando lado e posição. */
function divisionKey(round: BalancedRound): string {
  const side = (team: 'WHITE' | 'BLACK') =>
    [...round[team].map((s) => s.playerId), ...round.reserves[team]].sort().join(',');
  return [side('WHITE'), side('BLACK')].sort().join('|');
}

/** Notas 1, 2, 4, 8...: cada divisão tem uma diferença única, então o melhor é um só. */
function powersOfTwo(): Player[] {
  return fourteen().map((p, i) => ({ ...p, rating: 2 ** i }));
}

describe('C1 balanceTeams: escalação', () => {
  it('gera Branco x Preto 1-2-3-1 válidos com 14 confirmados, sem reservas', () => {
    const result = expectOk(
      balanceTeams(fourteen(), [], { tolerance: 0, random: seededRandom(1) }),
    );

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect(result.round.reserves).toEqual({ WHITE: [], BLACK: [] });
    expect(allIds(result.round).sort()).toEqual(
      fourteen()
        .map((p) => p.id)
        .sort(),
    );
  });

  it('coloca um goleiro de verdade em cada time', () => {
    const result = expectOk(
      balanceTeams(fourteen(), [], { tolerance: 0, random: seededRandom(1) }),
    );

    const goalkeepers = [result.round.WHITE, result.round.BLACK].map(
      (team) => team.find((s) => s.position === 'GOALKEEPER')?.playerId,
    );
    expect(goalkeepers.sort()).toEqual(['g1', 'g2']);
  });

  it('usa a posição secundária quando falta gente na principal', () => {
    // 3 zagueiros e 5 alas: o ala que também joga de zagueiro completa a zaga.
    const players = fourteen().map((p) =>
      p.id === 'd4' ? player('w5', 'WINGER', 5, ['DEFENDER']) : p,
    );
    const result = expectOk(balanceTeams(players, [], { tolerance: 0, random: seededRandom(1) }));

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect(slotOf(result.round, 'w5')?.position).toBe('DEFENDER');
  });

  it('resolve trocas em cadeia de posição secundária', () => {
    // 3 ZAG, 4 ALA, 3 MEI: um ala desce para a zaga e um meia abre na ala.
    const players = [
      ...fourteen().filter((p) => !['d4', 'w4', 'm2', 'm1'].includes(p.id)),
      player('w5', 'WINGER', 5, ['DEFENDER']),
      player('m3', 'MIDFIELDER', 5, ['WINGER']),
      player('m4', 'MIDFIELDER', 5),
      player('m5', 'MIDFIELDER', 5),
    ];
    const result = expectOk(balanceTeams(players, [], { tolerance: 0, random: seededRandom(1) }));

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect(slotOf(result.round, 'w5')?.position).toBe('DEFENDER');
    expect(slotOf(result.round, 'm3')?.position).toBe('WINGER');
  });

  it('prefere quem joga na posição principal a quem tem ela como secundária', () => {
    const players = fourteen().map((p) =>
      p.id === 'f1' ? player('f1', 'FORWARD', 5, ['DEFENDER']) : p,
    );
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = expectOk(
        balanceTeams(players, [], { tolerance: 0, random: seededRandom(seed) }),
      );
      expect(slotOf(result.round, 'f1')?.position).toBe('FORWARD');
    }
  });
});

describe('C1 balanceTeams: equilíbrio', () => {
  it('acha a divisão com diferença de força zero quando ela existe', () => {
    const ratings: Record<string, number> = {
      g1: 6,
      g2: 6,
      d1: 10,
      d2: 8,
      d3: 6,
      d4: 4,
      w1: 9,
      w2: 3,
      w3: 7,
      w4: 5,
      m1: 8,
      m2: 4,
      f1: 7,
      f2: 3,
    };
    const players = fourteen().map((p) => ({ ...p, rating: ratings[p.id] ?? 0 }));
    const result = expectOk(balanceTeams(players, [], { tolerance: 0, random: seededRandom(3) }));

    // Total 86 -> 43 de cada lado.
    expect(result.strength).toEqual({ WHITE: 43, BLACK: 43 });
  });

  it('dá o goleiro bom para o time com a linha mais fraca', () => {
    const players = fourteen().map((p) => {
      if (p.id === 'g1') return { ...p, rating: 10 };
      if (p.id === 'g2') return { ...p, rating: 2 };
      if (p.id === 'd1') return { ...p, rating: 9 };
      if (p.id === 'd2') return { ...p, rating: 1 };
      return p;
    });
    const result = expectOk(balanceTeams(players, [], { tolerance: 0, random: seededRandom(1) }));
    const team = result.round.WHITE.some((s) => s.playerId === 'g1') ? 'WHITE' : 'BLACK';
    const ids = result.round[team].map((s) => s.playerId);

    // g1 (10) fica com d2 (1); d1 (9) fica com g2 (2): ninguém ganha com folga.
    expect(ids).toContain('d2');
    expect(ids).not.toContain('d1');
  });

  it('aplica o desconto de quem joga fora da posição principal', () => {
    // Todos nota 10; o ala que vira zagueiro vale 10 * 0.8 = 8.
    const players = fourteen(10).map((p) =>
      p.id === 'd4' ? player('w5', 'WINGER', 10, ['DEFENDER']) : p,
    );
    const result = expectOk(
      balanceTeams(players, [], { tolerance: 0, random: seededRandom(1), offPositionFactor: 0.8 }),
    );

    expect([result.strength.WHITE, result.strength.BLACK].sort()).toEqual([68, 70]);
  });

  it('conta o reserva igual a titular e normaliza a força para 7 jogadores', () => {
    const result = expectOk(
      balanceTeams([...fourteen(6), ...extras(1, 6)], [], {
        tolerance: 0,
        random: seededRandom(1),
      }),
    );

    expect(result.strength).toEqual({ WHITE: 42, BLACK: 42 });
  });
});

describe('C1 balanceTeams: reservas', () => {
  it.each([
    [15, [0, 1]],
    [16, [1, 1]],
    [17, [1, 2]],
    [18, [2, 2]],
  ])('com %i confirmados divide os reservas %j', (total, expected) => {
    const players = [...fourteen(), ...extras(total - 14)];
    const result = expectOk(balanceTeams(players, [], { tolerance: 0, random: seededRandom(1) }));
    const { reserves } = result.round;

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect([reserves.WHITE.length, reserves.BLACK.length].sort()).toEqual(expected);
    expect(allIds(result.round).sort()).toEqual(players.map((p) => p.id).sort());
  });

  it('respeita o limite de reservas por time da config', () => {
    const players = [...fourteen(), ...extras(3)];
    const result = balanceTeams(players, [], { maxReservesPerTeam: 1 });

    expect(result).toEqual({ ok: false, error: 'TOO_MANY_PLAYERS' });
  });
});

describe('C2 balanceTeams: tolerância', () => {
  const players = fourteen().map((p, i) => ({ ...p, rating: 4 + (i % 3) }));
  const diffOf = (r: Extract<BalanceTeamsResult, { ok: true }>) =>
    Math.abs(r.strength.WHITE - r.strength.BLACK) / 7;

  it('C2: toda divisão devolvida fica até a tolerância do melhor custo, e há mais de uma', () => {
    const best = diffOf(expectOk(balanceTeams(players, [], { tolerance: 0 })));
    const tolerance = 0.1;
    const keys = new Set<string>();
    for (let seed = 1; seed <= 40; seed += 1) {
      const result = expectOk(balanceTeams(players, [], { tolerance, random: seededRandom(seed) }));
      // strength vem arredondado em 2 casas: sobra um respiro de 0,01
      expect(diffOf(result)).toBeLessThanOrEqual(best + tolerance + 0.01);
      keys.add(divisionKey(result.round));
    }
    expect(keys.size).toBeGreaterThan(1);
  });

  it('C2: tolerância 0 só devolve divisões de custo mínimo', () => {
    const best = diffOf(expectOk(balanceTeams(players, [], { tolerance: 0 })));
    for (let seed = 1; seed <= 20; seed += 1) {
      const result = expectOk(
        balanceTeams(players, [], { tolerance: 0, random: seededRandom(seed) }),
      );
      expect(diffOf(result)).toBeCloseTo(best, 1);
    }
  });
});

describe('C3 balanceTeams: evitar a divisão anterior', () => {
  it('C3: devolve outra divisão (mesmo com os lados trocados) quando há outra dentro da folga', () => {
    const players = fourteen();
    const first = expectOk(balanceTeams(players, [], { random: seededRandom(1) }));
    const swapped = {
      WHITE: first.round.BLACK,
      BLACK: first.round.WHITE,
      reserves: { WHITE: first.round.reserves.BLACK, BLACK: first.round.reserves.WHITE },
    };
    for (const avoid of [first.round, swapped]) {
      for (let seed = 1; seed <= 20; seed += 1) {
        const next = expectOk(balanceTeams(players, [], { random: seededRandom(seed) }, { avoid }));
        expect(divisionKey(next.round)).not.toBe(divisionKey(first.round));
      }
    }
  });

  it('C3: compara só quem está com quem, ignorando a posição', () => {
    const players = powersOfTwo();
    const only = expectOk(balanceTeams(players, [], { tolerance: 0 }));
    const reshuffled = {
      WHITE: only.round.WHITE.map((s) => ({ ...s, position: 'FORWARD' as const })),
      BLACK: only.round.BLACK.map((s) => ({ ...s, position: 'FORWARD' as const })),
    };
    const wide = expectOk(
      balanceTeams(players, [], { tolerance: 1e9, random: seededRandom(1) }, { avoid: reshuffled }),
    );
    expect(divisionKey(wide.round)).not.toBe(divisionKey(only.round));
  });

  it('C3: se só existe a divisão a evitar, devolve ela mesma', () => {
    const players = powersOfTwo();
    const only = expectOk(balanceTeams(players, [], { tolerance: 0 }));
    const again = expectOk(balanceTeams(players, [], { tolerance: 0 }, { avoid: only.round }));
    expect(divisionKey(again.round)).toBe(divisionKey(only.round));
  });
});

describe('C4 balanceTeams: duplas repetidas', () => {
  // d1 + um parceiro de zaga; cada parceiro foi companheiro de d1 em uma rodada diferente.
  const history = [
    past(['d1', 'd3'], []), // 4ª mais recente (peso 0,25)
    filler(),
    past(['d1', 'd4'], []), // 2ª (peso 0,75)
    past(['d1', 'd2'], []), // mais recente (peso 1)
  ];

  it('C4: separa primeiro a dupla da rodada mais recente (parceiro com peso menor)', () => {
    for (let seed = 1; seed <= 15; seed += 1) {
      const { round } = expectOk(
        balanceTeams(fourteen(), history, { tolerance: 0, random: seededRandom(seed) }),
      );
      const withD1 = round[teamOf(round, 'd1')]
        .filter((s) => s.position === 'DEFENDER')
        .map((s) => s.playerId)
        .sort();
      expect(withD1).toEqual(['d1', 'd3']);
    }
  });

  it('C4: dupla junta há 5 rodadas não pesa; há 4, pesa', () => {
    const five = [past(['d1', 'd2'], []), filler(), filler(), filler(), filler()];
    const four = [past(['d1', 'd2'], []), filler(), filler(), filler()];

    expect(seedsTogether('d1', 'd2', five, {})).toBeGreaterThan(0);
    expect(seedsTogether('d1', 'd2', four, {})).toBe(0);
  });

  it('C4: repeatedPairs é a contagem crua das duplas do mesmo time na janela', () => {
    const result = expectOk(
      balanceTeams(fourteen(), [past(['d1', 'd2'], ['d3', 'd4'])], {
        tolerance: 0,
        random: seededRandom(1),
      }),
    );
    expect(result.repeatedPairs).toBe(0);
  });

  it('C4: conta reservas da rodada como companheiros de time', () => {
    const withReserves: PastRound = {
      ...past([], []),
      reserves: { WHITE: ['d1', 'd2'], BLACK: [] },
    };
    expect(seedsTogether('d1', 'd2', [withReserves], {})).toBe(0);
  });

  it('C4: λ maior troca equilíbrio por dupla nova', () => {
    // m1 + f1 foram companheiros; só juntando os dois a força empata (m1 7 + f1 3 x m2 3 + f2 7).
    const ratings: Record<string, number> = { m1: 7, m2: 3, f1: 3, f2: 7 };
    const players = fourteen().map((p) => ({ ...p, rating: ratings[p.id] ?? p.rating }));
    const history1 = [past(['m1', 'f1'], [])];

    const light = expectOk(
      balanceTeams(players, history1, { tolerance: 0, random: seededRandom(1) }),
    );
    expect(light.repeatedPairs).toBe(1);
    expect(light.strength.WHITE).toBe(light.strength.BLACK);

    const heavy = expectOk(
      balanceTeams(players, history1, {
        tolerance: 0,
        random: seededRandom(1),
        repeatedPairWeight: 10,
      }),
    );
    expect(heavy.repeatedPairs).toBe(0);
    expect(Math.abs(heavy.strength.WHITE - heavy.strength.BLACK)).toBe(8);
  });
});

describe('C5 balanceTeams: excesso sobre o acaso', () => {
  it('C5: dupla que ficou junta menos vezes que o acaso não é penalizada nem atraída', () => {
    // 3 rodadas com os dois: separados, juntos (0,75), separados. Esperado ao acaso: 2,25 · 5/11 > 0,75.
    const history = [past(['d2'], ['d1']), past(['d1', 'd2'], []), past(['d1'], ['d2'])];
    const together = seedsTogether('d1', 'd2', history, {});
    expect(together).toBeGreaterThan(0);
    expect(together).toBeLessThan(30);
  });
});

describe('C6 balanceTeams: panelinha', () => {
  const noRepeat = { repeatedPairWeight: 0 };

  it('C6: dupla que venceu junto por 4 a 0 fica em times diferentes (notas empatadas)', () => {
    const history = [past(['d1', 'd2'], [], { WHITE: 4, BLACK: 0 })];
    expect(seedsTogether('d1', 'd2', history, noRepeat)).toBe(0);
  });

  it('C6: a vitória do Preto também conta', () => {
    const history = [past([], ['d1', 'd2'], { WHITE: 0, BLACK: 4 })];
    expect(seedsTogether('d1', 'd2', history, noRepeat)).toBe(0);
  });

  it('C6: dupla que perdeu junta não é separada', () => {
    const history = [past(['d1', 'd2'], [], { WHITE: 0, BLACK: 4 })];
    expect(seedsTogether('d1', 'd2', history, noRepeat)).toBeGreaterThan(0);
  });

  it('C6: vitória de 1 gol pesa um quarto da goleada', () => {
    // Juntos d1 (7) e d2 (3) equilibram com d3 + d4 (5 + 5); separados, a diferença de média é 4/7.
    const ratings: Record<string, number> = { d1: 7, d2: 3 };
    const players = fourteen().map((p) => ({ ...p, rating: ratings[p.id] ?? p.rating }));
    const config = { ...noRepeat, cliqueWeight: 1 };
    // Custo de juntar: 1 · margem/4 = 0,25 (1 gol, abaixo de 0,57) ou 1 (4 gols, acima).
    const narrow = [past(['d1', 'd2'], [], { WHITE: 1, BLACK: 0 })];
    const big = [past(['d1', 'd2'], [], { WHITE: 4, BLACK: 0 })];

    expect(seedsTogether('d1', 'd2', narrow, config, players)).toBe(30);
    expect(seedsTogether('d1', 'd2', big, config, players)).toBe(0);
  });
});

describe('C7 balanceTeams: saldo da panelinha', () => {
  const config = { repeatedPairWeight: 0, cliqueWeight: 10, cliqueRecencyWeights: [1, 1] };
  const win = (diff: number) => past(['d1', 'd2'], [], { WHITE: diff, BLACK: 0 });
  const loss = (diff: number) => past(['d1', 'd2'], [], { WHITE: 0, BLACK: diff });

  it('C7: vitória e derrota juntas da mesma diferença se cancelam', () => {
    expect(seedsTogether('d1', 'd2', [win(2), loss(2)], config)).toBeGreaterThan(0);
  });

  it('C7: só a vitória separa', () => {
    expect(seedsTogether('d1', 'd2', [win(2)], config)).toBe(0);
  });

  it('C7: empate vale 0', () => {
    const draw = past(['d1', 'd2'], [], { WHITE: 2, BLACK: 2 });
    expect(seedsTogether('d1', 'd2', [draw], config)).toBeGreaterThan(0);
  });

  it('C7: rodada sem placar não conta', () => {
    expect(seedsTogether('d1', 'd2', [past(['d1', 'd2'], [], null)], config)).toBeGreaterThan(0);
    expect(seedsTogether('d1', 'd2', [past(['d1', 'd2'], [])], config)).toBeGreaterThan(0);
  });

  it('C7: goleada de 6 a 0 vale como 4 a 0', () => {
    expect(seedsTogether('d1', 'd2', [win(6), loss(4)], config)).toBeGreaterThan(0);
  });

  it('C7: a dupla em times opostos na rodada não forma panelinha', () => {
    const apart = [past(['d1'], ['d2'], { WHITE: 4, BLACK: 0 })];
    expect(seedsTogether('d1', 'd2', apart, config)).toBeGreaterThan(0);
  });

  it('C7: rodada sem placar não ocupa lugar na janela da panelinha', () => {
    const history = [win(4), ...Array.from({ length: 10 }, () => filler())];
    const heavy = { repeatedPairWeight: 0, cliqueWeight: 10 };
    expect(seedsTogether('d1', 'd2', history, heavy)).toBe(0);
  });

  it('C7: o peso cai com a recência (derrota antiga não cancela a vitória recente)', () => {
    const decaying = { ...config, cliqueRecencyWeights: [1, 0.5] };
    expect(seedsTogether('d1', 'd2', [loss(4), win(4)], decaying)).toBe(0);
  });
});

describe('C8 balanceTeams: goleiro fora das duplas e da panelinha', () => {
  const heavy = { repeatedPairWeight: 10, cliqueWeight: 10 };

  it('C8: goleiro sempre com o mesmo companheiro no histórico não pesa', () => {
    const history = [
      past(['d1'], [], { WHITE: 4, BLACK: 0 }, ['g1', 'g2']),
      past(['d1'], [], { WHITE: 4, BLACK: 0 }, ['g1', 'g2']),
    ];
    expect(seedsTogether('g1', 'd1', history, heavy)).toBeGreaterThan(0);
  });
});

describe('C9 balanceTeams: erros', () => {
  it('pede ao menos 14 confirmados', () => {
    expect(balanceTeams(fourteen().slice(0, 13))).toEqual({
      ok: false,
      error: 'NOT_ENOUGH_PLAYERS',
    });
  });

  it('aceita no máximo 18 confirmados (2 reservas por time)', () => {
    expect(balanceTeams([...fourteen(), ...extras(5)])).toEqual({
      ok: false,
      error: 'TOO_MANY_PLAYERS',
    });
  });

  it('exige 2 goleiros de posição principal (secundária não vale)', () => {
    const players = fourteen().map((p) =>
      p.id === 'g2' ? player('w5', 'WINGER', 5, ['GOALKEEPER']) : p,
    );
    expect(balanceTeams(players)).toEqual({ ok: false, error: 'NOT_ENOUGH_GOALKEEPERS' });
  });

  it('não aceita um 3º goleiro', () => {
    expect(balanceTeams([...fourteen(), player('g3', 'GOALKEEPER')])).toEqual({
      ok: false,
      error: 'TOO_MANY_GOALKEEPERS',
    });
  });

  it('avisa quando nem as posições secundárias fecham a formação', () => {
    const players = fourteen().map((p) => (p.id === 'd4' ? player('w5', 'WINGER') : p));
    expect(balanceTeams(players)).toEqual({ ok: false, error: 'POSITIONS_UNFILLABLE' });
  });

  it('rejeita jogador repetido', () => {
    const players = fourteen();
    players[13] = player('f1', 'FORWARD');
    expect(balanceTeams(players)).toEqual({ ok: false, error: 'DUPLICATE_PLAYER' });
  });
});

describe('balanceTeams: determinismo', () => {
  it('com o mesmo seed gera sempre o mesmo resultado', () => {
    const a = balanceTeams(fourteen(), [], { tolerance: 0, random: seededRandom(42) });
    const b = balanceTeams(fourteen(), [], { tolerance: 0, random: seededRandom(42) });
    expect(a).toEqual(b);
  });

  it('com seeds diferentes varia entre as opções empatadas', () => {
    const lineups = new Set(
      Array.from({ length: 10 }, (_, i) =>
        JSON.stringify(
          expectOk(balanceTeams(fourteen(), [], { tolerance: 0, random: seededRandom(i) })).round,
        ),
      ),
    );
    expect(lineups.size).toBeGreaterThan(1);
  });
});

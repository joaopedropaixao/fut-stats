import { describe, expect, it } from 'vitest';
import { isValidRoundLineup, type Player, type Position, type RoundLineup } from '../core';
import { balanceTeams, type BalancedRound, type BalanceTeamsResult } from './balance-teams';
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

/** Rodada anterior: Branco com os "1" e "2" de cada posição, Preto com os "3" e "4". */
const previousRound: RoundLineup = {
  WHITE: [
    { playerId: 'g1', position: 'GOALKEEPER' },
    { playerId: 'd1', position: 'DEFENDER' },
    { playerId: 'd2', position: 'DEFENDER' },
    { playerId: 'w1', position: 'WINGER' },
    { playerId: 'w2', position: 'WINGER' },
    { playerId: 'm1', position: 'MIDFIELDER' },
    { playerId: 'f1', position: 'FORWARD' },
  ],
  BLACK: [
    { playerId: 'g2', position: 'GOALKEEPER' },
    { playerId: 'd3', position: 'DEFENDER' },
    { playerId: 'd4', position: 'DEFENDER' },
    { playerId: 'w3', position: 'WINGER' },
    { playerId: 'w4', position: 'WINGER' },
    { playerId: 'm2', position: 'MIDFIELDER' },
    { playerId: 'f2', position: 'FORWARD' },
  ],
};

/** Rodada com outros jogadores (ninguém dos confirmados): não gera dupla repetida. */
const unrelatedRound: RoundLineup = {
  WHITE: previousRound.WHITE.map((s) => ({ ...s, playerId: `old-${s.playerId}` })),
  BLACK: previousRound.BLACK.map((s) => ({ ...s, playerId: `old-${s.playerId}` })),
};

describe('balanceTeams: escalação', () => {
  it('gera Branco x Preto 1-2-3-1 válidos com 14 confirmados, sem reservas', () => {
    const result = expectOk(balanceTeams(fourteen(), [], { random: seededRandom(1) }));

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect(result.round.reserves).toEqual({ WHITE: [], BLACK: [] });
    expect(allIds(result.round).sort()).toEqual(
      fourteen()
        .map((p) => p.id)
        .sort(),
    );
  });

  it('coloca um goleiro de verdade em cada time', () => {
    const result = expectOk(balanceTeams(fourteen(), [], { random: seededRandom(1) }));

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
    const result = expectOk(balanceTeams(players, [], { random: seededRandom(1) }));

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
    const result = expectOk(balanceTeams(players, [], { random: seededRandom(1) }));

    expect(isValidRoundLineup(result.round)).toBe(true);
    expect(slotOf(result.round, 'w5')?.position).toBe('DEFENDER');
    expect(slotOf(result.round, 'm3')?.position).toBe('WINGER');
  });

  it('prefere quem joga na posição principal a quem tem ela como secundária', () => {
    const players = fourteen().map((p) =>
      p.id === 'f1' ? player('f1', 'FORWARD', 5, ['DEFENDER']) : p,
    );
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = expectOk(balanceTeams(players, [], { random: seededRandom(seed) }));
      expect(slotOf(result.round, 'f1')?.position).toBe('FORWARD');
    }
  });
});

describe('balanceTeams: equilíbrio', () => {
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
    const result = expectOk(balanceTeams(players, [], { random: seededRandom(3) }));

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
    const result = expectOk(balanceTeams(players, [], { random: seededRandom(1) }));
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
      balanceTeams(players, [], { random: seededRandom(1), offPositionFactor: 0.8 }),
    );

    expect([result.strength.WHITE, result.strength.BLACK].sort()).toEqual([68, 70]);
  });

  it('conta o reserva igual a titular e normaliza a força para 7 jogadores', () => {
    const result = expectOk(
      balanceTeams([...fourteen(6), ...extras(1, 6)], [], { random: seededRandom(1) }),
    );

    expect(result.strength).toEqual({ WHITE: 42, BLACK: 42 });
  });
});

describe('balanceTeams: reservas', () => {
  it.each([
    [15, [0, 1]],
    [16, [1, 1]],
    [17, [1, 2]],
    [18, [2, 2]],
  ])('com %i confirmados divide os reservas %j', (total, expected) => {
    const players = [...fourteen(), ...extras(total - 14)];
    const result = expectOk(balanceTeams(players, [], { random: seededRandom(1) }));
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

describe('balanceTeams: duplas repetidas', () => {
  it('separa quem jogou junto na última rodada quando a força empata', () => {
    const result = expectOk(balanceTeams(fourteen(), [previousRound], { random: seededRandom(1) }));

    // Cada time tem 6 de linha; o mínimo é 3 de cada time antigo: 3 + 3 duplas por time.
    expect(result.repeatedPairs).toBe(12);
  });

  it('ignora rodadas mais antigas que lookbackRounds', () => {
    const history = [previousRound, unrelatedRound];

    const short = expectOk(balanceTeams(fourteen(), history, { lookbackRounds: 1 }));
    const long = expectOk(balanceTeams(fourteen(), history, { lookbackRounds: 2 }));

    expect(short.repeatedPairs).toBe(0);
    expect(long.repeatedPairs).toBe(12);
  });

  it('conta reservas da rodada anterior como companheiros de time', () => {
    const withReserves = {
      ...unrelatedRound,
      reserves: { WHITE: ['d1', 'd2'], BLACK: [] },
    };
    // Sem diferença de força, d1 e d2 nunca deveriam cair juntos.
    for (let seed = 1; seed <= 10; seed += 1) {
      const result = expectOk(
        balanceTeams(fourteen(), [withReserves], { random: seededRandom(seed) }),
      );
      expect(result.repeatedPairs).toBe(0);
    }
  });

  it('não conta o goleiro nas duplas', () => {
    const result = expectOk(
      balanceTeams(fourteen(), [previousRound], { random: seededRandom(1), lookbackRounds: 1 }),
    );
    const teams = [result.round.WHITE, result.round.BLACK];
    // Mesmo que o goleiro caia com os mesmos companheiros, o total segue 12.
    expect(teams.every((t) => t.some((s) => s.position === 'GOALKEEPER'))).toBe(true);
    expect(result.repeatedPairs).toBe(12);
  });

  it('troca equilíbrio por duplas novas conforme o peso λ', () => {
    // Única dupla repetida: m1 + f1. E só juntando os dois a força empata.
    const history: RoundLineup[] = [
      {
        ...unrelatedRound,
        WHITE: unrelatedRound.WHITE.map((s) =>
          s.playerId === 'old-m1' || s.playerId === 'old-f1'
            ? { ...s, playerId: s.playerId.slice(4) }
            : s,
        ),
      },
    ];
    const ratings: Record<string, number> = { m1: 7, m2: 3, f1: 3, f2: 7 };
    const players = fourteen().map((p) => ({ ...p, rating: ratings[p.id] ?? p.rating }));

    const byDefault = expectOk(balanceTeams(players, history, { random: seededRandom(1) }));
    expect(byDefault.repeatedPairs).toBe(1);
    expect(byDefault.strength.WHITE).toBe(byDefault.strength.BLACK);

    // Separar custa 8 de diferença; com λ = 10 compensa.
    const heavy = expectOk(
      balanceTeams(players, history, { random: seededRandom(1), repeatedPairWeight: 10 }),
    );
    expect(heavy.repeatedPairs).toBe(0);
    expect(Math.abs(heavy.strength.WHITE - heavy.strength.BLACK)).toBe(8);
  });
});

describe('balanceTeams: erros', () => {
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
    const a = balanceTeams(fourteen(), [], { random: seededRandom(42) });
    const b = balanceTeams(fourteen(), [], { random: seededRandom(42) });
    expect(a).toEqual(b);
  });

  it('com seeds diferentes varia entre as opções empatadas', () => {
    const lineups = new Set(
      Array.from({ length: 10 }, (_, i) =>
        JSON.stringify(expectOk(balanceTeams(fourteen(), [], { random: seededRandom(i) })).round),
      ),
    );
    expect(lineups.size).toBeGreaterThan(1);
  });
});

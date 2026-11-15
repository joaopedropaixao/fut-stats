import { describe, expect, it } from 'vitest';
import { roundResults } from './results';
import type { RoundVote } from './vote';

const played = Array.from({ length: 16 }, (_, i) => `p${i + 1}`);

/** Voto completo: a mesma nota para todos os outros (ou a nota de cada alvo em `values`). */
function vote(
  voterId: string,
  mvpId: string,
  flopId: string,
  values: Record<string, number> = {},
  fallback = 6,
  ids: readonly string[] = played,
): RoundVote {
  return {
    voterId,
    mvpId,
    flopId,
    ratings: ids
      .filter((id) => id !== voterId)
      .map((targetId) => ({ targetId, value: values[targetId] ?? fallback })),
  };
}

describe('roundResults', () => {
  it('C1: nota de cada um é a média aparada das notas recebidas (4+ notas), com a contagem', () => {
    // p1 recebe 10, 2, 6, 7, 8, 5 dos seis votantes: aparada (tira 2 e 10) = (5+6+7+8)/4 = 6,5
    const votes = [
      vote('p2', 'p1', 'p9', { p1: 10 }),
      vote('p3', 'p1', 'p9', { p1: 2 }),
      vote('p4', 'p1', 'p9', { p1: 6 }),
      vote('p5', 'p1', 'p9', { p1: 7 }),
      vote('p6', 'p1', 'p9', { p1: 8 }),
      vote('p7', 'p1', 'p9', { p1: 5 }),
    ];
    const result = roundResults(votes, played);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.players.p1).toEqual({ score: 6.5, ratingsCount: 6 });
    // p9 recebe 6 de todos os seis: 6
    expect(result.value.players.p9).toEqual({ score: 6, ratingsCount: 6 });
    // p2 não recebe nota de si mesmo: 5 notas
    expect(result.value.players.p2?.ratingsCount).toBe(5);
    // quem não votou também recebe nota
    expect(result.value.players.p16).toEqual({ score: 6, ratingsCount: 6 });
    expect(Object.keys(result.value.players)).toHaveLength(16);
    // Craque e Perna de Pau pelos votos
    expect(result.value.mvpIds).toEqual(['p1']);
    expect(result.value.flopIds).toEqual(['p9']);
  });

  it('C2: com 3 votos a média é simples, sem aparar', () => {
    const votes = [
      vote('p2', 'p1', 'p9', { p1: 10 }),
      vote('p3', 'p1', 'p9', { p1: 2 }),
      vote('p4', 'p1', 'p9', { p1: 6 }),
    ];
    const result = roundResults(votes, played);
    expect(result.ok && result.value.players.p1).toEqual({ score: 6, ratingsCount: 3 });
  });

  it('C3: sem voto nenhum, todos sem nota e sem prêmio', () => {
    const result = roundResults([], played);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    for (const id of played) {
      expect(result.value.players[id]).toEqual({ score: null, ratingsCount: 0 });
    }
    expect(result.value.mvpIds).toEqual([]);
    expect(result.value.flopIds).toEqual([]);
  });

  it('C4: empate de votos no Craque vai para a maior nota da rodada', () => {
    // 2 votos para p1 e 2 para p2; p2 tem a nota maior
    const votes = [
      vote('p3', 'p1', 'p9', { p1: 6, p2: 9 }),
      vote('p4', 'p1', 'p9', { p1: 6, p2: 9 }),
      vote('p5', 'p2', 'p9', { p1: 6, p2: 9 }),
      vote('p6', 'p2', 'p9', { p1: 6, p2: 9 }),
    ];
    const result = roundResults(votes, played);
    expect(result.ok && result.value.mvpIds).toEqual(['p2']);
  });

  it('C4: empate de votos e de nota, os dois levam (Craque e Perna de Pau)', () => {
    const votes = [
      vote('p3', 'p1', 'p9'),
      vote('p4', 'p1', 'p9'),
      vote('p5', 'p2', 'p10'),
      vote('p6', 'p2', 'p10'),
    ];
    // p1/p2 e p9/p10 recebem as mesmas notas: nota empatada
    const result = roundResults(votes, played);
    expect(result.ok && result.value.mvpIds).toEqual(['p1', 'p2']);
    expect(result.ok && result.value.flopIds).toEqual(['p10', 'p9']);
  });

  it('C4: empate no Perna de Pau vai para a menor nota', () => {
    const votes = [
      vote('p3', 'p1', 'p9', { p9: 3, p10: 8 }),
      vote('p4', 'p1', 'p9', { p9: 3, p10: 8 }),
      vote('p5', 'p2', 'p10', { p9: 3, p10: 8 }),
      vote('p6', 'p2', 'p10', { p9: 3, p10: 8 }),
    ];
    const result = roundResults(votes, played);
    expect(result.ok && result.value.flopIds).toEqual(['p9']);
  });

  it('o desempate pode ser trocado: SHARE leva todos os empatados', () => {
    const votes = [vote('p3', 'p1', 'p9', { p2: 9 }), vote('p4', 'p2', 'p9', { p2: 9 })];
    const result = roundResults(votes, played, { tieBreak: 'SHARE' });
    expect(result.ok && result.value.mvpIds).toEqual(['p1', 'p2']);
    const none = roundResults(votes, played, { tieBreak: 'NONE' });
    expect(none.ok && none.value.mvpIds).toEqual([]);
  });

  it('as opções da nota da rodada passam adiante (casas decimais)', () => {
    const votes = [
      vote('p2', 'p1', 'p9', { p1: 7 }),
      vote('p3', 'p1', 'p9', { p1: 7.5 }),
      vote('p4', 'p1', 'p9', { p1: 7.5 }),
    ];
    const result = roundResults(votes, played, { decimals: 2 });
    expect(result.ok && result.value.players.p1?.score).toBe(7.33);
  });

  it('C5: nota faltando devolve o problema e não calcula pela metade', () => {
    const broken: RoundVote = {
      ...vote('p3', 'p1', 'p9'),
      ratings: vote('p3', 'p1', 'p9').ratings.slice(1),
    };
    const result = roundResults([vote('p2', 'p1', 'p9'), broken], played);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual([
      { voterId: 'p3', kind: 'RATING', targetId: 'p1', code: 'MISSING_RATING' },
    ]);
  });

  it('C5: voto em si mesmo, nota fora do passo e prêmio repetido são todos listados', () => {
    const good = vote('p3', 'p1', 'p9');
    const selfRating: RoundVote = {
      ...good,
      ratings: [...good.ratings.filter((r) => r.targetId !== 'p4'), { targetId: 'p3', value: 6 }],
    };
    const badStep: RoundVote = {
      ...vote('p5', 'p1', 'p1'),
      ratings: vote('p5', 'p1', 'p1').ratings.map((r) =>
        r.targetId === 'p6' ? { ...r, value: 7.3 } : r,
      ),
    };
    const result = roundResults([selfRating, badStep], played);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(
      expect.arrayContaining([
        { voterId: 'p3', kind: 'RATING', targetId: 'p3', code: 'SELF_VOTE' },
        { voterId: 'p3', kind: 'RATING', targetId: 'p4', code: 'MISSING_RATING' },
        { voterId: 'p5', kind: 'RATING', targetId: 'p6', code: 'INVALID_STEP' },
        { voterId: 'p5', kind: 'AWARD', field: 'flopId', code: 'SAME_PLAYER_BOTH' },
      ]),
    );
  });

  it('C5: quem não jogou e o mesmo votante duas vezes são recusados', () => {
    const ghost = vote('fantasma', 'p1', 'p9');
    const twice = [vote('p2', 'p1', 'p9'), vote('p2', 'p1', 'p9')];
    const a = roundResults([ghost], played);
    expect(a.ok).toBe(false);
    if (!a.ok) {
      expect(a.errors).toEqual([
        { voterId: 'fantasma', kind: 'RATING', targetId: 'fantasma', code: 'VOTER_DID_NOT_PLAY' },
      ]);
    }
    const b = roundResults(twice, played);
    expect(b.ok).toBe(false);
    if (!b.ok) {
      expect(b.errors).toEqual([
        { voterId: 'p2', kind: 'AWARD', field: 'voterId', code: 'DUPLICATE_VOTER' },
      ]);
    }
  });

  it('não altera os votos recebidos', () => {
    const votes = [vote('p2', 'p1', 'p9'), vote('p3', 'p1', 'p9')];
    const copy = structuredClone(votes);
    roundResults(votes, played);
    expect(votes).toEqual(copy);
  });
});

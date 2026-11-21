import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PackCard } from './deck';
import { player } from './fixtures';
import { drawLegendCard } from './share-legend';

/**
 * O Vitest do web roda sem DOM: o canvas é um registrador de chamadas. Cada chamada vira uma linha de texto com o
 * `fillStyle` do momento, para comparar o que a carta do Craque desenha em cada faixa.
 */
function recorder() {
  const log: string[] = [];
  const state = { fillStyle: '', strokeStyle: '', font: '', lineWidth: 1 };
  const grad = (kind: string, args: unknown[]) => ({
    addColorStop: (o: number, c: string) =>
      log.push(`${kind}${JSON.stringify(args)}.stop(${o},${c})`),
  });
  const calls: Record<string, (...a: unknown[]) => unknown> = {
    createLinearGradient: (...a) => grad('linear', a),
    createRadialGradient: (...a) => grad('radial', a),
    measureText: (t) => ({
      width: String(t).length * 16,
      actualBoundingBoxAscent: 12,
      actualBoundingBoxDescent: 0,
    }),
  };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key as keyof typeof target];
      return (...args: unknown[]) => {
        log.push(`${key}${JSON.stringify(args)} @${state.fillStyle}|${state.strokeStyle}`);
        return calls[key]?.(...args);
      };
    },
    set(target, key: string, value) {
      (target as Record<string, unknown>)[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, log };
}

const craque = (score: number, tier: PackCard['tier'], you = false): PackCard => ({
  kind: 'craque',
  player: { ...player('c', 'Felipinho', score), goals: 2, assists: 1 },
  score,
  tier,
  you,
  rank: null,
  phrase: 'Jogou demais',
});

function render(card: PackCard) {
  const { ctx, log } = recorder();
  drawLegendCard(ctx, card, 8);
  return log;
}

/** O selo é o último desenho: tudo a partir da última `measureText` (a medida do rótulo dele) é dele. */
const split = (log: string[]) => {
  const at = log.map((l) => l.startsWith('measureText')).lastIndexOf(true);
  return { before: log.slice(0, at), seal: log.slice(at) };
};

describe('o PNG do Compartilhar do Craque (moldura Lenda)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'Path2D',
      class {
        constructor(public d?: string) {}
        moveTo() {}
        lineTo() {}
        closePath() {}
      },
    );
    vi.stubGlobal('document', { documentElement: {} });
    vi.stubGlobal('getComputedStyle', () => ({
      getPropertyValue: (name: string) => `#${name.length.toString(16).padStart(6, '0')}`,
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('a moldura, o fundo e o conteúdo são os mesmos em qualquer faixa; só o selo muda', () => {
    const bronze = split(render(craque(5.8, 'bronze')));
    const silver = split(render(craque(5.8, 'silver')));
    const gold = split(render(craque(5.8, 'gold')));
    expect(bronze.before.length).toBeGreaterThan(50);
    expect(silver.before).toEqual(bronze.before);
    expect(gold.before).toEqual(bronze.before);
    expect(bronze.seal.join('\n')).not.toEqual(gold.seal.join('\n'));
  });

  it('o selo escreve a faixa por extenso e a faixa nunca aparece no canto como nas cartas comuns', () => {
    for (const [tier, label] of [
      ['bronze', 'BRONZE'],
      ['silver', 'PRATA'],
      ['gold', 'OURO'],
    ] as const) {
      const log = render(craque(7.2, tier));
      const written = log
        .filter((l) => l.startsWith('fillText'))
        .map((l) => /\["([^"]*)"/.exec(l)![1]);
      expect(written.filter((t) => t === label)).toHaveLength(1);
      expect(written).toContain('FELIPINHO');
      expect(written).toContain('CRAQUE');
    }
  });

  it('o fundo é o ouro metálico (nenhum gradiente da faixa bronze, prata ou ouro comum)', () => {
    const stops = render(craque(9.1, 'gold')).filter((l) => l.includes('.stop('));
    expect(stops.some((l) => l.includes('#ffe27a'))).toBe(true);
    expect(stops.some((l) => /#efbf93|#f4f7fa|#f6d77a/.test(l))).toBe(false);
  });

  it('o Craque sou eu: o contorno creme da carta especial e o VOCÊ na tira, com o selo mais abaixo', () => {
    const me = render(craque(9.1, 'gold', true));
    const other = render(craque(9.1, 'gold', false));
    expect(me.some((l) => l.includes('#f3ead3'))).toBe(true);
    expect(other.some((l) => l.includes('#f3ead3'))).toBe(false);
    const written = me
      .filter((l) => l.startsWith('fillText'))
      .map((l) => /\["([^"]*)"/.exec(l)![1]);
    expect(written).toContain('VOCÊ');
    const sealY = (log: string[]) => {
      const t = log.filter((l) => l.startsWith('translate'));
      return JSON.parse(t[t.length - 1]!.slice('translate'.length).split(' @')[0]!)[1] as number;
    };
    expect(sealY(me)).toBeGreaterThan(sealY(other));
  });
});

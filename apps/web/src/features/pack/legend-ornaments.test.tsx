import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LegendOrnaments } from './legend-frame';

describe('enfeites da moldura Lenda em 320 px (C30)', () => {
  it('as faíscas que passam da lateral direita somem abaixo de 360 px: a página não ganha rolagem horizontal', () => {
    const out = renderToString(<LegendOrnaments />);
    const sparks = [...out.matchAll(/class="([^"]*animate-star-twinkle[^"]*)"/g)].map((m) => m[1]!);
    const right = sparks.filter((c) => /-right-\d|right-8/.test(c));
    expect(right.length).toBe(2);
    for (const c of right) expect(c).toContain('max-[359px]:hidden');
    // o resto (troféu, asas, ponteiras e as outras faíscas) segue sempre à mostra
    expect(out.match(/max-\[359px\]:hidden/g)).toHaveLength(2);
  });
});

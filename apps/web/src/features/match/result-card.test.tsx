import type { PlayerAvatar } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ResultCard } from './result-card';

const ME: PlayerAvatar = { skin: 'DARK', hair: 'MOHAWK', hairColor: 'RED' };
const score = { WHITE: 3, BLACK: 2 };

function render(result: 'WIN' | 'LOSS' | 'DRAW') {
  return renderToString(
    <ResultCard roundId="r1" result={result} score={score} myTeam="WHITE" avatar={ME} />,
  );
}

/** O bonequinho de corpo inteiro é o único `svg` de 8 x 12 do card. */
const sprites = (html: string) => html.match(/viewBox="0 0 8 12"/g) ?? [];

describe('ResultCard (C48)', () => {
  it.each(['WIN', 'LOSS', 'DRAW'] as const)(
    'C48: %s mostra um único bonequinho, com a pele e o cabelo de quem vê',
    (result) => {
      const html = render(result);
      // Antes eram 7 cópias do meu boneco, e os colegas ficavam com o meu rosto
      expect(sprites(html)).toHaveLength(1);
      expect(html).toContain('var(--color-skin-5)');
      expect(html).toContain('var(--color-hair-red)');
    },
  );

  it('C48: a etiqueta VOCÊ acompanha o bonequinho', () => {
    // a classe é a da etiqueta YouTag (a do placar "Você" é só texto)
    expect(render('WIN')).toContain('bg-text px-1.5 text-team-black');
  });
});

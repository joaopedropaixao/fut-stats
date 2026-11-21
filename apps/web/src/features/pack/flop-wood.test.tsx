import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FlopCard } from '../voting/flop-card';
import { FlopPackCard } from './pack-cards';
import { player } from './fixtures';

const tira = (html: string) => /<span[^>]*overflow-hidden[^>]*>/.exec(html)?.[0];

describe('moldura de madeira do Perna de Pau', () => {
  it('a rachadura de cima fica só na madeira: cortada rente ao miolo, sem passar por cima do texto da tira do time', () => {
    // BRANCO é a palavra mais comprida da tira; o time do fixture é o Branco
    const out = renderToString(
      <FlopPackCard player={player('m1', 'Tavinho', 5.5)} tier="bronze" phrase="O pé tava torto" />,
    );
    expect(out).toContain('Branco');
    // a madeira de cima tem 16 px (p-4): a rachadura não passa disso
    expect(tira(out)).toContain('height:16px');
    expect(tira(out)).toContain('pointer-events-none');
  });

  it('o card do resultado também só deixa a ponta da rachadura na madeira (12 px)', () => {
    const out = renderToString(
      <FlopCard player={player('m1', 'Tavinho', 5.5)} phrase="O pé tava torto" />,
    );
    expect(tira(out)).toContain('height:12px');
  });

  it('o pacote do Perna de Pau mantém o selo da faixa por escrito e a moldura só como decoração', () => {
    const out = renderToString(
      <FlopPackCard player={player('m1', 'Tavinho', 6.5)} tier="silver" phrase={null} />,
    );
    expect(out).toContain('data-wood');
    expect(out).toContain('Prata');
  });
});

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PlayerCard } from './player-card';

const avatar = { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' } as const;

describe('PlayerCard (ouro e amarelo)', () => {
  it('admin líder: o ADMIN é neutro, sem amarelo, e o ouro fica para o líder', () => {
    const html = renderToString(
      <PlayerCard
        nickname="Rafa"
        avatar={avatar}
        position="DEFENDER"
        isAdmin
        ranking={{ rank: 1, average: 8.8 }}
      />,
    );
    expect(html).toContain('text-gold');
    expect(html).not.toContain('text-accent');
    expect(html).not.toContain('bg-accent');
    expect(html).not.toContain('border-accent');
    expect(html).not.toContain('var(--color-accent)');
  });

  it('o ADMIN é neutro também sem ouro', () => {
    const html = renderToString(
      <PlayerCard nickname="Rafa" avatar={avatar} position="DEFENDER" isAdmin />,
    );
    expect(html).not.toContain('accent');
  });
});

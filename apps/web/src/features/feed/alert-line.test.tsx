import type { FeedAlert } from '@fut-stats/shared';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AlertLine } from './alert-line';

const alert = (type: FeedAlert['type'], me: FeedAlert['me'] = {}): FeedAlert => ({
  type,
  roundId: 'r8',
  roundNumber: 8,
  scheduledAt: '2026-11-14T21:00:00.000Z',
  me,
});

const render = (node: React.ReactElement) => renderToString(<MemoryRouter>{node}</MemoryRouter>);

describe('linha de aviso (C27, C28, C33)', () => {
  it('é um link para a tela do tipo, com o tipo escrito e a situação, e o nome acessível inteiro', () => {
    const html = render(<AlertLine alert={alert('VOTING', { played: true, voted: false })} />);
    expect(html).toContain('href="/rodadas/r8/votar"');
    expect(html).toContain('aria-label="Votação aberta, rodada 8, falta o seu voto"');
    expect(html).toContain('Rodada 8 · falta o seu voto');
    expect(html).toContain('min-h-14'); // 56 px
  });

  it('o resultado já aberto vira "Resultado" com a rodada e leva ao mesmo lugar', () => {
    const html = render(<AlertLine alert={alert('RESULT')} resultOpened />);
    expect(html).toContain('href="/rodadas/r8/resultado"');
    expect(html).toContain('aria-label="Resultado, rodada 8"');
  });

  it('jogo ao vivo ganha o ponto piscando; o resto, o ícone do tipo', () => {
    expect(render(<AlertLine alert={alert('IN_PROGRESS')} />)).toContain('animate-live-blink');
    expect(render(<AlertLine alert={alert('PRESENCE')} />)).not.toContain('animate-live-blink');
  });

  it('contorno neutro, faixa à esquerda e ícone na cor do tipo, sem amarelo', () => {
    const html = render(<AlertLine alert={alert('RESULT')} />);
    expect(html).toContain('inset 0 0 0 2px var(--color-border-strong)');
    expect(html).toContain('background:var(--color-gold)');
    expect(html).toContain('text-gold');
    expect(html).not.toContain('accent');
    expect(render(<AlertLine alert={alert('VOTING')} />)).toContain('background:var(--color-vote)');
    expect(render(<AlertLine alert={alert('POST_MATCH')} />)).toContain(
      'background:var(--color-warning)',
    );
  });

  it('o jogo ao vivo é vermelho; os times saíram em branco e preto com o corte', () => {
    expect(render(<AlertLine alert={alert('IN_PROGRESS')} />)).toContain('bg-danger');
    const teams = render(<AlertLine alert={alert('TEAMS_PUBLISHED')} />);
    expect(teams).toContain('linear-gradient(160deg');
  });

  it('cada linha entra com atraso próprio (escalonado pela posição)', () => {
    expect(render(<AlertLine alert={alert('PRESENCE')} index={2} />)).toContain(
      '--moment-delay:160ms',
    );
  });
});

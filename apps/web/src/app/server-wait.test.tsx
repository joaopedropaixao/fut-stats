import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { REACTION_SPRITES } from '../components/ui/pixel-sprite-maps';
import { ServerNotResponding, ServerStarting } from './server-wait';
import {
  SERVER_WAIT,
  SERVER_WAIT_BALL,
  serverWaitView,
  type ServerWaitView,
} from './server-wait-view';

const base = { failed: false, gaveUp: false, startingElapsed: false, retried: false };
const view = (over: Partial<typeof base>): ServerWaitView => serverWaitView({ ...base, ...over });

describe('limiares da espera do /me (C15 a C19)', () => {
  it('os limiares combinados: 3 s a tela, 10 s o aviso, 90 s desiste', () => {
    expect(SERVER_WAIT).toEqual({ startingAfter: 3000, noticeAfter: 10000, giveUpAfter: 90000 });
  });

  it('antes dos 3 s fica o esqueleto de hoje (resposta rápida não pisca)', () => {
    expect(view({})).toBe('skeleton');
  });

  it('depois dos 3 s entra a tela "Servidor iniciando"', () => {
    expect(view({ startingElapsed: true })).toBe('starting');
  });

  it('passou de 90 s sem resposta: erro, mesmo que o pedido ainda esteja pendente', () => {
    expect(view({ startingElapsed: true, gaveUp: true })).toBe('error');
  });

  it('o pedido falhou (depois das retentativas): erro, em qualquer instante', () => {
    expect(view({ failed: true })).toBe('error');
    expect(view({ failed: true, startingElapsed: true })).toBe('error');
  });

  it('"Tentar de novo" volta direto para "Servidor iniciando", sem esperar os 3 s de novo', () => {
    expect(view({ retried: true })).toBe('starting');
  });

  it('depois de tentar de novo, uma nova falha ou os 90 s levam ao erro outra vez', () => {
    expect(view({ retried: true, failed: true })).toBe('error');
    expect(view({ retried: true, gaveUp: true })).toBe('error');
  });
});

describe('tela "Servidor iniciando" (C16, C17, C20)', () => {
  it('é role="status", tem o título, a frase de calma e a bola; sem a barra de abas', () => {
    const out = renderToString(<ServerStarting notice={false} />);
    expect(out).toContain('role="status"');
    // o landmark <main> fica sem role: só a região interna é o status
    expect(out).toMatch(/<main(?![^>]*role=)/);
    expect(out).toContain('Servidor iniciando...');
    expect(out).toContain('Já já a pelada abre.');
    expect(out).toContain('animate-ball-bounce');
    expect(out).not.toContain('aria-label="Principal"');
  });

  it('Reduzir movimento: a bola e a sombra têm a variante parada', () => {
    const out = renderToString(<ServerStarting notice={false} />);
    expect(out).toContain('motion-reduce:animate-none');
  });

  it('o aviso do 1 min só entra com `notice`, dentro da região aria-live que já existe', () => {
    const sem = renderToString(<ServerStarting notice={false} />);
    expect(sem).toContain('aria-live="polite"');
    expect(sem).not.toContain('Pode levar até 1 min na primeira vez');
    const com = renderToString(<ServerStarting notice />);
    expect(com).toContain('Pode levar até 1 min na primeira vez');
  });
});

describe('estado de erro "O servidor não respondeu" (C19)', () => {
  it('traz o título, a explicação e a tecla "Tentar de novo"', () => {
    const out = renderToString(<ServerNotResponding onRetry={() => {}} />);
    expect(out).toContain('O servidor não respondeu');
    expect(out).toContain(
      'Pode ser a internet ou o servidor ainda acordando. Tente de novo em instantes.',
    );
    expect(out).toContain('Tentar de novo');
  });
});

describe('bola da tela de servidor', () => {
  it('é a mesma grade da bola das reações (copiada para não pesar o pedaço inicial)', () => {
    expect([...SERVER_WAIT_BALL]).toEqual([...REACTION_SPRITES.BALL]);
  });
});

describe('tela igual ao desenho do Paper (itens 3, 3b e 3c)', () => {
  it('o título é uma linha só (sem quebra) e muda para 16 px abaixo de 360 px, no peso regular do desenho', () => {
    const out = renderToString(<ServerStarting notice={false} />);
    expect(out).toContain('whitespace-nowrap');
    expect(out).toContain('max-[359px]:text-pixel-sm');
    expect(out).toContain('font-weight:400');
  });

  it('o erro é o cartão do desenho: borda de 3 px danger, role=alert, tecla creme sem ícone e a bola parada', () => {
    const out = renderToString(<ServerNotResponding onRetry={() => {}} />);
    expect(out).toContain('role="alert"');
    expect(out).toContain('border-danger');
    expect(out).toContain('bg-text');
    expect(out).toContain('Tentar de novo');
    expect(out).not.toContain('animate-ball-bounce');
  });
});

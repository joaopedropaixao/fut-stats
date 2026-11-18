import type { RouteObject } from 'react-router';
import { describe, expect, it } from 'vitest';
import { appRoutes } from '../app-routes';
import { scrubPath } from './monitoring';

/** As telas de `/resenhas/*` (uma rota só no roteador; `post-screen.ts` decide a tela). */
const POST_SCREENS = ['resenhas/nova', 'resenhas/:postId/editar'];

/** Todos os caminhos do app, juntando as rotas aninhadas como o roteador faz. */
function allPaths(routes: RouteObject[], parent = ''): string[] {
  return routes.flatMap((route) => {
    const own = route.path ?? '';
    const full = own.startsWith('/') ? own : [parent, own].filter(Boolean).join('/');
    const here =
      own === 'resenhas/*'
        ? POST_SCREENS.map((screen) => `/${screen}`)
        : route.path && own !== '*'
          ? [full.startsWith('/') ? full : `/${full}`]
          : [];
    return [...here, ...allPaths(route.children ?? [], route.path ? full : parent)];
  });
}

/** Um endereço de verdade para o padrão: cada `:param` vira um id no formato do banco (ou um código de convite). */
const sample = (pattern: string) =>
  pattern.replace(/:(\w+)/g, (_, name: string) =>
    name === 'code' ? 'AB12CD' : 'cmwm8ss5i000btdssx58c2lih',
  );

describe('scrubPath contra as rotas reais do app (app-routes.tsx)', () => {
  const paths = allPaths(appRoutes);

  it('acha as rotas do app (a lista não está vazia nem incompleta)', () => {
    for (const expected of [
      '/rodadas/:roundId/votar',
      '/rodadas/:roundId/resultado',
      '/jogadores/:membershipId',
      '/historico/:roundId',
      '/resenhas/:postId/editar',
      '/convite/:code',
    ]) {
      expect(paths).toContain(expected);
    }
  });

  it('todo endereço de tela vira o padrão da rota: nenhum id fica e nenhuma parte fixa vira :id', () => {
    for (const pattern of paths) {
      expect(scrubPath(`https://futstats-app.com.br${sample(pattern)}?grupo=x#y`)).toBe(pattern);
    }
  });
});

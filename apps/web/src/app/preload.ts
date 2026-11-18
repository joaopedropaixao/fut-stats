import type { DataRouter, RouteObject } from 'react-router';

/**
 * Os pedaços de cada área são os mesmos que o router carrega sob demanda: o `lazy` de cada rota. Depois da primeira
 * tela pronta, o preload chama o `lazy` das rotas ainda não carregadas (o mesmo `import()` vira o mesmo arquivo) e
 * eles vão para o cache do navegador em segundo plano: trocar de aba não espera a rede. Sem lista paralela: rota
 * nova com `lazy` entra sozinha, e nenhum `import()` a mais vai para o JS inicial.
 */
export function lazyLoaders(routes: readonly RouteObject[]): (() => Promise<unknown>)[] {
  return routes.flatMap(({ lazy, children = [] }) => [
    ...(typeof lazy === 'function' ? [lazy as () => Promise<unknown>] : []),
    ...lazyLoaders(children),
  ]);
}

/** Com "economizar dados" ligado, não gasta rede com o que ninguém pediu. */
function saveDataOn() {
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}

/** Espera 1 s com a tela parada (os dados da primeira tela têm a rede na frente) e então o navegador ficar ocioso. */
const SETTLE_MS = 1000;

function whenIdle(task: () => void) {
  setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 800 });
    else task();
  }, SETTLE_MS);
}

export function preloadAreas(router: Pick<DataRouter, 'routes'>) {
  if (saveDataOn()) return;
  whenIdle(() => {
    for (const load of lazyLoaders(router.routes)) {
      // Erro de rede aqui não importa: a tela tenta de novo quando for aberta
      load().catch(() => undefined);
    }
  });
}

/** Espera o router ter a primeira tela pronta (o pedaço dela já chegou) e só então pré-carrega o resto. */
export function preloadWhenReady(router: Pick<DataRouter, 'state' | 'subscribe' | 'routes'>) {
  if (router.state.initialized) return preloadAreas(router);
  const unsubscribe = router.subscribe((state) => {
    if (!state.initialized) return;
    unsubscribe();
    preloadAreas(router);
  });
}

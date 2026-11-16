import type { DataRouter } from 'react-router';

/**
 * Os pedaços de cada área, os mesmos que o router carrega sob demanda (o mesmo `import()` vira o mesmo arquivo).
 * Depois da primeira tela pronta, vão para o cache do navegador em segundo plano: trocar de aba não espera a rede.
 */
const AREAS = [
  () => import('../pages/feed/feed-area'),
  () => import('../pages/times/times-area'),
  () => import('../pages/rounds/rounds-area'),
  () => import('../pages/match/match-page'),
  () => import('../pages/perfil/perfil-area'),
  () => import('../pages/elenco/elenco-area'),
  () => import('../pages/historico/historico-area'),
  () => import('../pages/ranking/ranking-area'),
  () => import('../pages/voting/voting-area'),
  () => import('../pages/entrar-e-grupo/start-area'),
];

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

export function preloadAreas() {
  if (saveDataOn()) return;
  whenIdle(() => {
    for (const load of AREAS) load().catch(() => undefined);
  });
}

/** Espera o router ter a primeira tela pronta (o pedaço dela já chegou) e só então pré-carrega o resto. */
export function preloadWhenReady(router: Pick<DataRouter, 'state' | 'subscribe'>) {
  if (router.state.initialized) return preloadAreas();
  const unsubscribe = router.subscribe((state) => {
    if (!state.initialized) return;
    unsubscribe();
    preloadAreas();
  });
}

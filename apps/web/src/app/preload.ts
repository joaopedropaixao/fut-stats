import type { DataRouter } from 'react-router';

/**
 * Os pedaços de cada área, os mesmos que o router carrega sob demanda (o mesmo `import()` vira o mesmo arquivo).
 * Depois da primeira tela pronta, vão para o cache do navegador em segundo plano: trocar de aba não espera a rede.
 */
const AREAS = [
  () => import('../pages/rounds/home'),
  () => import('../pages/times/times-area'),
  () => import('../pages/rounds/rounds-area'),
  () => import('../pages/match/match-page'),
  () => import('../pages/entrar-e-grupo/profile-page'),
  () => import('../pages/entrar-e-grupo/start-area'),
];

/** Com "economizar dados" ligado, não gasta rede com o que ninguém pediu. */
function saveDataOn() {
  return (
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
  );
}

function whenIdle(task: () => void) {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 1500 });
  else setTimeout(task, 200);
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

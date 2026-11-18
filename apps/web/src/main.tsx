import '@fontsource/chakra-petch/latin-400.css';
import '@fontsource/chakra-petch/latin-500.css';
import '@fontsource/chakra-petch/latin-600.css';
import '@fontsource/silkscreen/latin-700.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import { clearReloadMark, reloadOnPreloadError } from './app/chunk-reload';
import { ErrorBoundary } from './app/error-boundary';
import { startMonitoring } from './app/monitoring';
import { preloadWhenReady } from './app/preload';
import { monitorSession } from './features/session/monitor-session';
import { captureInstallPrompt } from './features/pwa/install-prompt';
import { createQueryClient } from './lib/query-client';
import { applyBackground } from './lib/theme';
import { router } from './router';

applyBackground();
// O navegador oferece a instalação uma vez, logo ao abrir: guarda para o card do Perfil e a linha do Feed
captureInstallPrompt();
const queryClient = createQueryClient();
// O Sentry sabe quem está logado (só o id) em qualquer tela
monitorSession(queryClient);

// Pedaço que sumiu: recarrega uma vez, já na tela pedida (a navegação em andamento, se houver)
reloadOnPreloadError(() => {
  const pending = router.state.navigation.location;
  return pending ? `${pending.pathname}${pending.search}${pending.hash}` : undefined;
});

// Uma navegação deu certo (tela nova, sem erro de rota): a marca da recarga sai e o próximo pedaço que sumir
// ganha uma nova recarga. A carga inicial não conta: a pré-carga logo depois dela pode falhar de novo.
const firstLocation = router.state.location;
router.subscribe((state) => {
  if (state.navigation.state === 'idle' && !state.errors && state.location !== firstLocation) {
    clearReloadMark();
  }
});
// Com a primeira tela pronta, os pedaços das outras áreas chegam em segundo plano
preloadWhenReady(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
);

// O Sentry (só com VITE_SENTRY_DSN) entra depois da primeira renderização e fora do JS inicial
requestAnimationFrame(() => setTimeout(startMonitoring, 0));

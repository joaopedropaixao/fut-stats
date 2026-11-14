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
import { preloadWhenReady } from './app/preload';
import { createQueryClient } from './lib/query-client';
import { applyBackground } from './lib/theme';
import { router } from './router';

applyBackground();
reloadOnPreloadError();
const queryClient = createQueryClient();

// Uma navegação deu certo (sem erro de rota): se a página foi recarregada por um pedaço que sumiu, a marca sai
function clearMarkWhenHealthy({ state }: Pick<typeof router, 'state'>) {
  if (state.initialized && state.navigation.state === 'idle' && !state.errors) clearReloadMark();
}
clearMarkWhenHealthy(router);
router.subscribe((state) => clearMarkWhenHealthy({ state }));
// Com a primeira tela pronta, os pedaços das outras áreas chegam em segundo plano
preloadWhenReady(router);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

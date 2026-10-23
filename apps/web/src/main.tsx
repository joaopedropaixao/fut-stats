import '@fontsource-variable/inter/wght.css';
import '@fontsource/silkscreen/latin-700.css';
import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import './index.css';
import { createQueryClient } from './lib/query-client';
import { applyBackground } from './lib/theme';
import { router } from './router';

applyBackground();
const queryClient = createQueryClient();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

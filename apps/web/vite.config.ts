import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Cores do manifesto = fundo Gramado (--color-bg em docs/design/tokens.css)
const THEME_COLOR = '#0d2717';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'Fut Stats',
          short_name: 'Fut Stats',
          description: 'Times, notas, ranking e o craque de cada rodada da pelada.',
          lang: 'pt-BR',
          start_url: '/',
          display: 'standalone',
          orientation: 'portrait',
          theme_color: THEME_COLOR,
          background_color: THEME_COLOR,
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Os ícones do manifesto o plugin já inclui. Das fontes, só o alfabeto latino entra no pacote
          // offline; os outros recortes baixam se precisar
          globPatterns: ['**/*.{js,css,html,svg}', 'apple-touch-icon-*.png', '**/*-latin-*.woff2'],
          globIgnores: ['**/*-latin-ext-*.woff2'],
          // /api/* nunca cai no index.html do service worker (o login com Google é navegação para a API)
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      port: 5173,
      // Em dev, /api/* vai para a API local com o mesmo caminho (a API já serve sob /api)
      proxy: {
        '/api/': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Cores do manifesto = fundo Gramado (--color-bg em docs/design/tokens.css)
const THEME_COLOR = '#0d2717';

// Os arquivos de ambiente ficam na raiz do repositório, junto dos da API.
const ENV_DIR = '../..';

export default defineConfig(({ mode }) => {
  // O .env.equipe (portas de um worktree em modo paralelo) não é um dos nomes que o loadEnv conhece: entra pelo
  // process.env, que o loadEnv deixa por cima dos arquivos, e o .env da raiz só completa o que faltar.
  try {
    process.loadEnvFile(`${import.meta.dirname}/${ENV_DIR}/.env.equipe`);
  } catch {
    // sem o arquivo
  }
  const env = loadEnv(mode, `${import.meta.dirname}/${ENV_DIR}`, '');
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000';
  const webPort = Number(env.WEB_PORT);

  return {
    envDir: ENV_DIR,
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
      // Em modo paralelo a porta vem do WEB_PORT e não pode cair em outra: o APP_URL e o proxy contam com ela
      port: webPort || 5173,
      strictPort: Boolean(webPort),
      // Em dev, /api/* vai para a API local com o mesmo caminho (a API já serve sob /api)
      proxy: {
        '/api/': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

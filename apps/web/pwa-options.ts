import type { VitePWAOptions } from 'vite-plugin-pwa';

// Cores do manifesto = fundo Gramado (--color-bg em docs/design/tokens.css)
const THEME_COLOR = '#0d2717';

/**
 * Opções do VitePWA, num módulo à parte para o Vitest conferir (scripts/pwa-options.test.ts).
 *
 * `devOptions.enabled`: sem ele o `pnpm dev` não registra service worker nem serve o manifesto, então os avisos
 * push (que esperam `navigator.serviceWorker.ready`) e o convite de instalar (`beforeinstallprompt`) não
 * funcionam em desenvolvimento. O SW de dev sai em `dev-dist/` (fora do git) com o `importScripts` e o
 * `navigateFallbackDenylist` do `workbox` abaixo, os mesmos do build.
 */
export const pwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  devOptions: {
    enabled: true,
    type: 'classic',
  },
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
    globIgnores: ['**/*-latin-ext-*.woff2', 'push-sw.js'],
    // Os avisos push (público/push-sw.js) entram no service worker gerado por importScripts: a lógica fica
    // num arquivo que o Vitest testa, e o cache e a atualização continuam os do Workbox. O arquivo não
    // vai para o pré-cache (o navegador o baixa e o compara com o sw.js a cada verificação de atualização)
    importScripts: ['push-sw.js'],
    // /api/* nunca cai no index.html do service worker (o login com Google é navegação para a API)
    navigateFallbackDenylist: [/^\/api\//],
  },
};

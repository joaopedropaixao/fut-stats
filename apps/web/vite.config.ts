import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { pwaOptions } from './pwa-options';

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
    // O manifesto diz o que cada entrada importa (estático x dinâmico): scripts/check-build.mjs mede o JS inicial com ele
    build: {
      manifest: true,
      rolldownOptions: {
        output: {
          // zod + shared + domain (~30 kB gzip) ficam num pedaço só, de fora do inicial: sem o grupo, o rolldown
          // junta nele módulos do shell (como o pixel-glyphs) e o index.html volta a importá-lo
          codeSplitting: {
            groups: [{ name: 'contracts', test: /zod|packages[\\/](shared|domain)/ }],
          },
        },
      },
    },
    plugins: [react(), tailwindcss(), VitePWA(pwaOptions)],
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

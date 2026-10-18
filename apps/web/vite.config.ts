import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, '');
  const apiTarget = env.API_PROXY_TARGET || 'http://localhost:3000';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // Em dev, /api/* vai para a API local com o mesmo caminho (a API já serve sob /api)
      proxy: {
        '/api/': { target: apiTarget, changeOrigin: true },
      },
    },
  };
});

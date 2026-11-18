import react from '@fut-stats/eslint-config/react';

// `dev-dist/` é o service worker de dev que o vite-plugin-pwa gera (fora do git)
export default [{ ignores: ['dev-dist/**'] }, ...react];

// Só o que o app usa do Sentry. Este arquivo é o único que o `import()` de `monitoring.ts` carrega: importar o
// `@sentry/react` inteiro pelo `import()` leva o pacote todo (~144 kB gzip) para o pedaço; com as exportações
// nomeadas aqui, o bundler tira o resto (tracing, replay, feedback...).
export { captureException, init, setUser } from '@sentry/react';

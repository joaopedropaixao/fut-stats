import { TEST_DATABASE_URL } from './database-url';

// Roda antes de cada arquivo de teste. Variável de ambiente vence o .env, então a app de teste
// nunca aponta para o banco de desenvolvimento.
process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-dos-testes-com-mais-de-32-caracteres';
// Valores falsos: o Google de verdade nunca é chamado nos testes (ver FakeGoogleOAuthClient).
process.env.GOOGLE_CLIENT_ID = 'client-id-dos-testes.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'segredo-do-google-dos-testes';
process.env.APP_URL = 'http://localhost:5173';
// O relógio que fecha votações vencidas fica desligado: os testes chamam o fechamento direto, com a hora que querem.
process.env.VOTING_CLOSER_INTERVAL_MS = '0';
// Pulso do canal ao vivo curto, para o teste não esperar 20 s (os leitores do fluxo ignoram comentários).
process.env.STREAM_HEARTBEAT_MS = '300';
// Push desligado por padrão: as chaves VAPID do arquivo de ambiente local (o dono liga o push no dev) não podem vazar
// para os testes. Vazio, e não apagado: o ambiente vence o arquivo; os testes de push ligam com `enableVapid()`.
for (const key of ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']) process.env[key] = '';
// Idem para o Sentry e o despertador: o que o arquivo de ambiente local tiver não pode ligá-los nos testes. Os testes
// que precisam deles trocam o transporte do Sentry e importam o `InternalModule.forEnvironment(segredo)`.
for (const key of ['SENTRY_DSN', 'SENTRY_ENVIRONMENT', 'TICK_SECRET']) process.env[key] = '';

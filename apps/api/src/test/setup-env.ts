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

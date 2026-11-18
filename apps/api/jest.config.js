/** @type {import('jest').Config} */
module.exports = {
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': 'ts-jest' },
  // O client gerado pelo Prisma importa com extensão .js (ex.: './enums.js'), que aqui é .ts.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  moduleFileExtensions: ['ts', 'js', 'json'],
  testEnvironment: 'node',
  globalSetup: '<rootDir>/test/global-setup.ts',
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // Os testes de integração dividem o mesmo banco: um arquivo por vez evita um apagar os dados do outro.
  maxWorkers: 1,
};

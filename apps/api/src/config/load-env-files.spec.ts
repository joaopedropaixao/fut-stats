import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InternalModule } from '../internal/internal.module';
import { monitoringOptionsFromEnv } from '../common/monitoring';
import { loadEnvFiles, repositoryRoot } from './load-env-files';

/**
 * Ambiente dos arquivos antes do Nest: `TICK_SECRET` e `SENTRY_DSN` do arquivo local precisam valer na hora em que o
 * `AppModule` é montado e o Sentry liga (antes, só o `ConfigModule` lia os arquivos, tarde demais).
 */
describe('loadEnvFiles: arquivos de ambiente antes do AppModule', () => {
  let root: string;
  const TEAM = '.env.equipe';
  const ROOT_FILE = '.env';

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'fut-env-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('o segredo e o DSN do arquivo local ligam o despertador e o Sentry, como no Render', () => {
    const secret = 'segredo-local-do-despertador-0123456789';
    writeFileSync(
      join(root, ROOT_FILE),
      `TICK_SECRET=${secret}\nSENTRY_DSN=https://publica@o0.ingest.sentry.io/1\n`,
    );
    const env: NodeJS.ProcessEnv = {};

    loadEnvFiles(root, env);

    expect(InternalModule.forEnvironment(env.TICK_SECRET).controllers).toHaveLength(1);
    expect(monitoringOptionsFromEnv(env).dsn).toBe('https://publica@o0.ingest.sentry.io/1');
  });

  it('não sobrescreve o que já está no ambiente (o painel do Render vence o arquivo)', () => {
    writeFileSync(join(root, ROOT_FILE), 'PORT=1111\nAPP_URL=http://arquivo\n');
    const env: NodeJS.ProcessEnv = { PORT: '3000' };

    loadEnvFiles(root, env);

    expect(env.PORT).toBe('3000');
    expect(env.APP_URL).toBe('http://arquivo');
  });

  it('o arquivo da equipe vence o da raiz; sem arquivo nenhum, nada muda', () => {
    writeFileSync(join(root, TEAM), 'PORT=3100\n');
    writeFileSync(join(root, ROOT_FILE), 'PORT=3000\nJWT_SECRET=da-raiz\n');
    const env: NodeJS.ProcessEnv = {};
    loadEnvFiles(root, env);
    expect(env).toEqual({ PORT: '3100', JWT_SECRET: 'da-raiz' });

    const empty: NodeJS.ProcessEnv = {};
    loadEnvFiles(mkdtempSync(join(tmpdir(), 'fut-env-vazio-')), empty);
    expect(empty).toEqual({});
  });

  it('a raiz é dois níveis acima de apps/api, a mesma do AppModule', () => {
    expect(repositoryRoot('/repo/apps/api')).toBe('/repo');
  });
});

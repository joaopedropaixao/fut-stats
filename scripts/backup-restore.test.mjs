// Testes de integração do backup e da restauração (C11, C12, C13) contra o Postgres de teste (docker compose, porta 5433;
// service container no CI). Cada teste cria os seus bancos e os apaga no fim. Roda com `node --test scripts/`.
//
// Precisa de pg_dump e psql. Sem eles no PATH (a máquina do dev só tem o Docker), usa um atalho que chama os do
// container do Postgres de teste. Sem os dois, os testes são pulados com o motivo.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = join(ROOT, 'apps/api');
const BACKUP = join(ROOT, 'scripts/backup-db.sh');
const RESTORE = join(ROOT, 'scripts/restore-db.sh');
const PASSPHRASE = 'senha-de-teste-do-backup-0123456789';

const ambiente = process.env;
const adminUrl = new URL(
  ambiente.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/postgres',
);
const urlFor = (database) => {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
};

const has = (command) => spawnSync('sh', ['-c', `command -v ${command}`]).status === 0;

/** Pasta com `pg_dump` e `psql` que falam com o cliente de dentro do container do Postgres de teste. */
function dockerShims(dir) {
  const found = spawnSync(
    'docker',
    ['ps', '--filter', `publish=${adminUrl.port || 5432}`, '--format', '{{.Names}}'],
    { encoding: 'utf8' },
  );
  const container = found.status === 0 ? found.stdout.split('\n')[0]?.trim() : '';
  if (!container) return null;
  const shim = (name) => `#!/bin/sh
# Atalho de teste: ${name} do container ${container}, com a porta do host trocada pela de dentro dele.
i=0
n=$#
while [ "$i" -lt "$n" ]; do
  a="$1"; shift
  a="$(printf '%s' "$a" | sed 's#:${adminUrl.port}/#:5432/#')"
  set -- "$@" "$a"
  i=$((i + 1))
done
exec docker exec -i ${container} ${name} "$@"
`;
  for (const name of ['pg_dump', 'psql']) {
    writeFileSync(join(dir, name), shim(name));
    chmodSync(join(dir, name), 0o755);
  }
  return dir;
}

let work;
let pathEnv;
let skipReason = null;
const created = [];

// A decisão de pular precisa existir antes de o `describe` abaixo ser registrado.
{
  work = mkdtempSync(join(tmpdir(), 'fut-stats-backup-'));
  const shims = join(work, 'bin');
  mkdirSync(shims);
  if (has('pg_dump') && has('psql')) {
    pathEnv = ambiente.PATH;
  } else if (has('docker') && dockerShims(shims)) {
    pathEnv = `${shims}:${ambiente.PATH}`;
  } else {
    skipReason = 'sem pg_dump/psql no PATH e sem o container do Postgres de teste';
  }
  if (!has('gpg')) skipReason = 'sem gpg no PATH';
}

after(() => {
  if (!skipReason) {
    for (const database of created) {
      spawnSync(
        'psql',
        [urlFor('postgres'), '-c', `DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`],
        { env: { PATH: pathEnv, HOME: ambiente.HOME } },
      );
    }
  }
  rmSync(work, { recursive: true, force: true });
});

const run = (command, args, vars = {}, input) =>
  spawnSync(command, args, {
    encoding: 'utf8',
    input,
    env: { PATH: pathEnv, HOME: ambiente.HOME, ...vars },
  });

const psql = (url, sql) => {
  const result = run('psql', [url, '--no-psqlrc', '-At', '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  assert.equal(result.status, 0, `psql falhou: ${result.stderr}`);
  return result.stdout.trim();
};

let counter = 0;
/** Cria um banco novo (vazio) e devolve o nome e a URL. */
function newDatabase(label) {
  counter += 1;
  const name = `fut_stats_${label}_${process.pid}_${counter}_test`;
  psql(urlFor('postgres'), `CREATE DATABASE "${name}"`);
  created.push(name);
  return { name, url: urlFor(name) };
}

/** O banco com o schema das migrations e o seed de desenvolvimento (o "banco local" do spec). */
let seeded;
function seededDatabase() {
  if (seeded) return seeded;
  seeded = newDatabase('backup_origem');
  const migrations = join(API, 'prisma/migrations');
  for (const dir of readdirSync(migrations).sort()) {
    if (dir.endsWith('.toml')) continue;
    const sql = readFileSync(join(migrations, dir, 'migration.sql'), 'utf8');
    const result = run('psql', [seeded.url, '--no-psqlrc', '-q', '-v', 'ON_ERROR_STOP=1'], {}, sql);
    assert.equal(result.status, 0, `migration ${dir} falhou: ${result.stderr}`);
  }
  const seed = spawnSync(join(API, 'node_modules/.bin/tsx'), ['prisma/seed.ts'], {
    cwd: API,
    encoding: 'utf8',
    env: { ...ambiente, NODE_ENV: 'test', DATABASE_URL: seeded.url },
    timeout: 120_000,
  });
  assert.equal(seed.status, 0, `seed falhou: ${seed.stderr}`);
  return seeded;
}

/** Contagem de linhas por tabela do schema public. */
function countsOf(url) {
  const tables = psql(
    url,
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY 1",
  )
    .split('\n')
    .filter(Boolean);
  const counts = {};
  for (const table of tables) {
    counts[table] = Number(psql(url, `SELECT count(*) FROM "public"."${table}"`));
  }
  return counts;
}

const backupOf = (url, dir, vars = {}) =>
  run('sh', [BACKUP], { DIRECT_URL: url, BACKUP_PASSPHRASE: PASSPHRASE, BACKUP_DIR: dir, ...vars });

/** As linhas "tabela<TAB>n" que o script imprime depois do título, como objeto. */
function manifestOf(stderr, title) {
  const lines = stderr.split('\n');
  const start = lines.findIndex((line) => line.startsWith(title));
  assert.notEqual(start, -1, `faltou o bloco "${title}" na saída`);
  const counts = {};
  for (const line of lines.slice(start + 1)) {
    const match = /^(\S+)\t(\d+)$/.exec(line);
    if (!match) break;
    counts[match[1]] = Number(match[2]);
  }
  return counts;
}

const restoreOf = (file, vars) => run('sh', [RESTORE, ...file], vars);

describe('backup e restauração do banco', { skip: skipReason ?? false }, () => {
  it('C11: backup-db.sh gera fut-stats-<data>.sql.gz.gpg e o arquivo não tem texto legível', () => {
    const origin = seededDatabase();
    const dir = mkdtempSync(join(work, 'saida-'));

    const result = backupOf(origin.url, dir);

    assert.equal(result.status, 0, result.stderr);
    const files = readdirSync(dir);
    assert.equal(files.length, 1);
    assert.match(files[0], /^fut-stats-\d{4}-\d{2}-\d{2}\.sql\.gz\.gpg$/);
    assert.equal(result.stdout.trim(), join(dir, files[0]));
    const bytes = readFileSync(join(dir, files[0]));
    assert.ok(bytes.length > 1000, 'o backup não deveria estar vazio');
    const text = bytes.toString('latin1');
    for (const word of [
      'CREATE TABLE',
      'COPY ',
      'Membership',
      'Pelada',
      'INSERT',
      'PostgreSQL database dump',
    ]) {
      assert.ok(!text.includes(word), `o arquivo cifrado não deveria conter "${word}"`);
    }
    if (has('strings')) {
      const strings = execFileSync('strings', [join(dir, files[0])], { encoding: 'utf8' });
      assert.doesNotMatch(strings, /Membership|AuditLog|PushSubscription/);
    }
    // A senha não vai para a saída nem para as mensagens.
    assert.ok(!result.stderr.includes(PASSPHRASE) && !result.stdout.includes(PASSPHRASE));
  });

  it('C12: restore-db.sh num banco vazio devolve as mesmas contagens por tabela', () => {
    const origin = seededDatabase();
    const dir = mkdtempSync(join(work, 'saida-'));
    const backup = backupOf(origin.url, dir);
    assert.equal(backup.status, 0, backup.stderr);
    const target = newDatabase('backup_destino');

    const restored = restoreOf([backup.stdout.trim()], {
      RESTORE_DATABASE_URL: target.url,
      BACKUP_PASSPHRASE: PASSPHRASE,
    });

    assert.equal(restored.status, 0, restored.stderr);
    const expected = countsOf(origin.url);
    assert.ok(Object.keys(expected).length >= 10, 'o seed deveria povoar várias tabelas');
    assert.ok(expected.Membership > 0 && expected.Round > 0);
    assert.deepEqual(countsOf(target.url), expected);
    // A conferência que o dono faz: a lista impressa no backup (contada no próprio dump) e a impressa na restauração
    // são iguais, e batem com o banco de origem.
    const noBackup = manifestOf(backup.stderr, 'Linhas por tabela neste backup:');
    const noDestino = manifestOf(restored.stderr, 'Linhas por tabela no destino restaurado:');
    assert.deepEqual(noBackup, expected);
    assert.deepEqual(noDestino, noBackup);
  });

  describe('C13: falhas com mensagem clara e código diferente de zero', () => {
    let file;
    before(() => {
      const dir = mkdtempSync(join(work, 'saida-'));
      const backup = backupOf(seededDatabase().url, dir);
      assert.equal(backup.status, 0, backup.stderr);
      file = backup.stdout.trim();
    });

    it('C13: senha errada falha ao decifrar e não toca no destino', () => {
      const target = newDatabase('backup_senha');

      const result = restoreOf([file], {
        RESTORE_DATABASE_URL: target.url,
        BACKUP_PASSPHRASE: 'senha-errada',
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Erro: não consegui decifrar o backup: a senha/);
      assert.deepEqual(countsOf(target.url), {});
    });

    it('C13: destino com tabelas é recusado sem --force e fica intacto', () => {
      const target = newDatabase('backup_cheio');
      psql(target.url, 'CREATE TABLE ja_existia (id int); INSERT INTO ja_existia VALUES (1)');

      const result = restoreOf([file], {
        RESTORE_DATABASE_URL: target.url,
        BACKUP_PASSPHRASE: PASSPHRASE,
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /já tem 1 tabela\(s\)/);
      assert.match(result.stderr, /--force/);
      assert.equal(psql(target.url, 'SELECT count(*) FROM ja_existia'), '1');
    });

    it('C13: com --force o destino com tabelas é apagado e restaurado', () => {
      const target = newDatabase('backup_forca');
      psql(target.url, 'CREATE TABLE ja_existia (id int)');

      const result = restoreOf(['--force', file], {
        RESTORE_DATABASE_URL: target.url,
        BACKUP_PASSPHRASE: PASSPHRASE,
      });

      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(countsOf(target.url), countsOf(seededDatabase().url));
      assert.equal(psql(target.url, "SELECT to_regclass('public.ja_existia') IS NULL"), 't');
      assert.match(result.stderr, /--force, apagando tudo do schema public/);
    });

    it('C13: variável faltando em cada script diz qual é', () => {
      const origin = seededDatabase();
      const dir = mkdtempSync(join(work, 'saida-'));

      const semUrl = run('sh', [BACKUP], { BACKUP_PASSPHRASE: PASSPHRASE, BACKUP_DIR: dir });
      assert.notEqual(semUrl.status, 0);
      assert.match(semUrl.stderr, /falta a variável DIRECT_URL/);

      const semSenha = run('sh', [BACKUP], { DIRECT_URL: origin.url, BACKUP_DIR: dir });
      assert.notEqual(semSenha.status, 0);
      assert.match(semSenha.stderr, /falta a variável BACKUP_PASSPHRASE/);
      assert.deepEqual(readdirSync(dir), []);

      const restoreSemUrl = restoreOf([file], { BACKUP_PASSPHRASE: PASSPHRASE });
      assert.notEqual(restoreSemUrl.status, 0);
      assert.match(restoreSemUrl.stderr, /falta a variável RESTORE_DATABASE_URL/);

      const restoreSemSenha = restoreOf([file], { RESTORE_DATABASE_URL: origin.url });
      assert.notEqual(restoreSemSenha.status, 0);
      assert.match(restoreSemSenha.stderr, /falta a variável BACKUP_PASSPHRASE/);

      const semArquivo = restoreOf([], {
        RESTORE_DATABASE_URL: origin.url,
        BACKUP_PASSPHRASE: PASSPHRASE,
      });
      assert.notEqual(semArquivo.status, 0);
      assert.match(semArquivo.stderr, /informe o arquivo do backup/);
    });

    it('C13: banco de origem que não existe faz o backup falhar com mensagem e sem deixar arquivo', () => {
      const dir = mkdtempSync(join(work, 'saida-'));

      const result = backupOf(urlFor('banco_que_nao_existe'), dir);

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Erro: o pg_dump falhou/);
      assert.ok(!result.stderr.includes(PASSPHRASE));
      assert.deepEqual(readdirSync(dir), []);
    });

    it('C13: arquivo corrompido falha ao decifrar', () => {
      const broken = join(mkdtempSync(join(work, 'saida-')), 'fut-stats-ruim.sql.gz.gpg');
      writeFileSync(broken, 'isto não é um backup');
      const target = newDatabase('backup_ruim');

      const result = restoreOf([broken], {
        RESTORE_DATABASE_URL: target.url,
        BACKUP_PASSPHRASE: PASSPHRASE,
      });

      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /não consegui decifrar o backup/);
    });
  });
});

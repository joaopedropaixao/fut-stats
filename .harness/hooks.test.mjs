import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const script = resolve('.claude/hooks/dev-termina-verde.sh');
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Fixture',
  GIT_COMMITTER_NAME: 'Fixture',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'harness hooks '));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const main = join(dir, 'main');
  mkdirSync(main);
  function git(cwd, ...args) {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  }
  git(main, 'init', '-b', 'develop');
  git(main, 'commit', '--allow-empty', '-m', 'fixture');
  function wt(name) {
    const p = join(dir, name);
    git(main, 'worktree', 'add', '-b', 'feature/' + name, p);
    return p;
  }
  const a = wt('a'),
    ab = wt('a-back'),
    b = wt('b'),
    bb = wt('b-back');
  function check(cwd, side, cmd = 'false', extra = {}) {
    return spawnSync('sh', [script, side], {
      cwd,
      env: { ...env, TMPDIR: dir, DEV_CHECK_CMD: cmd },
      encoding: 'utf8',
      input: JSON.stringify({ cwd, session_id: 'same', agent_id: 'same', ...extra }),
    });
  }
  return { a, ab, b, bb, check };
}
test('a segunda equipe valida seu próprio back, mesmo com outro par anterior', (t) => {
  const f = fixture(t);
  const r = f.check(f.b, 'back', 'test "$PWD" = "$EXPECTED"');
  // Comando de saída deixa inequívoco o diretório realmente verificado.
  const actual = f.check(f.b, 'back', 'pwd; false');
  assert.match(actual.stdout, new RegExp(f.bb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(actual.stdout, new RegExp(f.ab.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.equal(r.status, 0);
});
test('cwd de um DEV já é o alvo; não busca outro worktree', (t) => {
  const f = fixture(t);
  const r = f.check(f.bb, 'back', 'pwd; false');
  assert.ok(r.stdout.includes(f.bb));
  assert.ok(!r.stdout.includes(f.ab));
});
test('contadores iguais de sessão em worktrees distintos não se contaminam', (t) => {
  const f = fixture(t);
  assert.ok(f.check(f.a, 'back').stdout.includes('(1/3)'));
  assert.ok(f.check(f.b, 'back').stdout.includes('(1/3)'));
});
test('papel inválido não executa checagem de back por engano', (t) => {
  const f = fixture(t);
  const r = f.check(f.b, 'qa', 'true');
  assert.equal(r.status, 2);
});

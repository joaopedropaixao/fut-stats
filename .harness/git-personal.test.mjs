import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const script = resolve('.claude/scripts/git-pessoal.sh');
test('wrapper pessoal não publica branch protegida e mantém push de feature', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'personal-git-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo'),
    remote = join(root, 'remote.git'),
    bin = join(root, 'bin');
  mkdirSync(repo);
  mkdirSync(bin);
  // Apenas a autenticação externa é substituída: o Git e o remoto bare são reais e locais.
  writeFileSync(
    join(bin, 'gh'),
    '#!/bin/sh\n[ "$*" = "auth token --user joaopedropaixao" ] || exit 7\nprintf fixture-token\n',
    { mode: 0o755 },
  );
  const env = { ...process.env, PATH: bin + ':' + process.env.PATH };
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: repo, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout;
  };
  git('init', '--bare', remote);
  git('init', '-b', 'develop');
  git(
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '--allow-empty',
    '-m',
    'init',
  );
  git('remote', 'add', 'origin', remote);
  const run = (...args) => spawnSync('sh', [script, ...args], { cwd: repo, env, encoding: 'utf8' });
  assert.notEqual(run('push', 'origin', 'develop').status, 0);
  git('checkout', '-b', 'feature/test');
  assert.notEqual(run('push', 'origin', 'HEAD:develop').status, 0);
  assert.notEqual(run('push', '--all', 'origin').status, 0);
  assert.notEqual(run('push', 'origin', 'HEAD:refs/heads/main').status, 0);
  const result = run('push', '-u', 'origin', 'feature/test');
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    git('--git-dir=' + remote, 'show-ref', '--verify', 'refs/heads/feature/test')
      .trim()
      .split(' ')[1],
    'refs/heads/feature/test',
  );
});

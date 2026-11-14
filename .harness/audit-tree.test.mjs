import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
const cli = resolve('.harness/audit-tree.mjs');
test('QA aceita prints, mas detecta código alterado, arquivo novo e alteração de HEAD', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'qa-audit-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repo = join(root, 'repo');
  mkdirSync(repo);
  const baseline = join(root, 'before.json');
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  };
  git('init', '-b', 'develop');
  writeFileSync(join(repo, 'code.ts'), 'original\n');
  git('add', '.');
  git('-c', 'user.name=Fixture', '-c', 'user.email=test@example.invalid', 'commit', '-m', 'init');
  const run = (mode) =>
    spawnSync(process.execPath, [cli, mode, repo, baseline, 'teste'], { encoding: 'utf8' });
  assert.equal(run('capture').status, 0);
  mkdirSync(join(repo, 'docs/design/prints/teste'), { recursive: true });
  writeFileSync(join(repo, 'docs/design/prints/teste/c1.png'), 'fake fixture');
  assert.equal(run('check').status, 0);
  writeFileSync(join(repo, 'code.ts'), 'changed\n');
  assert.equal(run('check').status, 2);
  writeFileSync(join(repo, 'code.ts'), 'original\n');
  writeFileSync(join(repo, 'new.ts'), 'new');
  assert.equal(run('check').status, 2);
  rmSync(join(repo, 'new.ts'));
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=test@example.invalid',
    'commit',
    '--allow-empty',
    '-m',
    'unexpected',
  );
  assert.equal(run('check').status, 2);
});

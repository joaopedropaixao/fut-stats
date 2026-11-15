import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
const cli = resolve('.harness/team.mjs');
const env = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Test',
  GIT_COMMITTER_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_EMAIL: 'test@example.invalid',
};
function fixture(t) {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'team harness ')));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const main = join(dir, 'main');
  mkdirSync(main);
  function git(cwd, ...args) {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    return r.stdout.trim();
  }
  git(main, 'init', '-b', 'develop');
  git(main, 'commit', '--allow-empty', '-m', 'init');
  function wt(name) {
    const p = join(dir, name);
    git(main, 'worktree', 'add', '-b', 'feature/' + name, p);
    return p;
  }
  function run(...args) {
    const r = spawnSync(process.execPath, [cli, ...args], { cwd: main, env, encoding: 'utf8' });
    return { ...r, data: r.status === 0 ? JSON.parse(r.stdout) : null };
  }
  const brief = join(dir, 'input.md');
  writeFileSync(brief, 'Entrega: tarefa de teste, não executar produto.');
  return { dir, main, git, wt, run, brief };
}
test('reserva conjunta inclui equipe legada e impede quarta equipe', (t) => {
  const f = fixture(t);
  const old = f.wt('legada');
  mkdirSync(join(f.main, '.claude'));
  writeFileSync(
    join(f.main, '.claude/quadro-v1.local.tsv'),
    `legada\tImplement\tbase\t0\tok\tapps/web\t\t0\t${old}\n`,
  );
  for (const [team, agent, slot] of [
    ['nova', 'codex', 1],
    ['outra', 'claude', 2],
  ]) {
    const w = f.wt(team);
    const r = f.run('reserve', '--team', team, '--agent', agent, '--worktree', w);
    assert.equal(r.status, 0, r.stderr);
    assert.equal(r.data.slot, slot);
  }
  const w = f.wt('quarta');
  assert.notEqual(
    f.run('reserve', '--team', 'quarta', '--agent', 'codex', '--worktree', w).status,
    0,
  );
});
test('reserva idempotente não troca ferramenta e detecta branch incorreta', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  const args = ['reserve', '--team', 'um', '--agent', 'codex', '--worktree', w];
  const a = f.run(...args);
  assert.equal(a.status, 0, a.stderr);
  assert.deepEqual(f.run(...args).data, a.data);
  assert.notEqual(f.run('reserve', '--team', 'um', '--agent', 'claude', '--worktree', w).status, 0);
  assert.notEqual(
    f.run('reserve', '--team', 'outra', '--agent', 'codex', '--worktree', w).status,
    0,
  );
});
test('prepare usa modelo econômico, gera brief e não permite duplicar uma tentativa', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  f.run('reserve', '--team', 'um', '--agent', 'codex', '--worktree', w);
  const args = ['prepare', '--team', 'um', '--role', 'tpl', '--worktree', w, '--spec', f.brief];
  const r = f.run(...args);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.data.argv.includes('gpt-6-luna'));
  assert.ok(r.data.argv.includes('medium'));
  assert.ok(readFileSync(r.data.specFile, 'utf8').includes(w));
  assert.ok(readFileSync(r.data.specFile, 'utf8').includes('Entrega: tarefa de teste'));
  assert.notEqual(f.run(...args).status, 0);
  assert.notEqual(f.run('release', '--team', 'um').status, 0);
});
test('bind só associa a tentativa registrada e o Stop não herda papel de outra sessão', async (t) => {
  const f = fixture(t),
    w = f.wt('um');
  f.run('reserve', '--team', 'um', '--agent', 'codex', '--worktree', w);
  f.run(
    'approve',
    '--team',
    'um',
    '--mode',
    'Front',
    '--spec',
    f.brief,
    '--evidence',
    'aprovação fixture',
  );
  const proof = join(f.dir, 'setup.json');
  writeFileSync(
    proof,
    JSON.stringify({
      worktree: w,
      head: f.git(w, 'rev-parse', 'HEAD'),
      checks: {
        install: { command: 'fixture install', exitCode: 0, evidence: 'log' },
        environment: { command: 'fixture ambiente', exitCode: 0, evidence: 'log' },
      },
    }),
  );
  f.run('ready', '--team', 'um', '--worktree', w, '--stage', 'dev', '--proof', proof);
  f.run('prepare', '--team', 'um', '--role', 'dev-front', '--worktree', w, '--spec', f.brief);
  assert.notEqual(f.run('bind', '--team', 'um', '--key', 'dev-front', '--session', 's1').status, 0);
  assert.equal(
    f.run(
      'record',
      '--team',
      'um',
      '--key',
      'dev-front',
      '--dispatch',
      'dispatch-one',
      '--task',
      'task-one',
      '--run',
      'run-one',
    ).status,
    0,
  );
  const bound = spawnSync(
    process.execPath,
    [cli, 'bind', '--team', 'um', '--key', 'dev-front', '--session', 's1'],
    { cwd: w, env, encoding: 'utf8' },
  );
  assert.equal(bound.status, 0, bound.stderr);
  const { sessionAssignment } = await import('./team.mjs');
  assert.equal(sessionAssignment(w, 's1').role, 'dev-front');
  assert.equal(sessionAssignment(w, 'other'), null);
  const other = f.wt('outra');
  assert.equal(sessionAssignment(other, 's1'), null);
});
test('duas reservas concorrentes não recebem a mesma vaga', async (t) => {
  const f = fixture(t),
    a = f.wt('a'),
    b = f.wt('b');
  const run = (name, path) =>
    new Promise((resolve) => {
      const p = spawn(
        process.execPath,
        [cli, 'reserve', '--team', name, '--agent', 'codex', '--worktree', path],
        { cwd: f.main, env },
      );
      let out = '';
      p.stdout.on('data', (x) => (out += x));
      p.on('close', (code) => resolve({ code, out }));
    });
  const results = await Promise.all([run('a', a), run('b', b)]);
  const success = results.filter((r) => r.code === 0).map((r) => JSON.parse(r.out));
  assert.ok(success.length >= 1);
  assert.equal(new Set(success.map((r) => r.slot)).size, success.length);
});
test('reserva reconhece portas de equipe sem quadro e recusa PORT inesperado', (t) => {
  const f = fixture(t),
    old = f.wt('legada');
  writeFileSync(join(old, '.env.equipe'), 'PORT=3100\n');
  const w = f.wt('nova');
  const r = f.run('reserve', '--team', 'nova', '--agent', 'codex', '--worktree', w);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.data.slot, 2);
  writeFileSync(join(old, '.env.equipe'), 'PORT=9999\n');
  const x = f.wt('terceira');
  assert.notEqual(
    f.run('reserve', '--team', 'terceira', '--agent', 'codex', '--worktree', x).status,
    0,
  );
});
test('prepare Claude não presume que --agent claude usa perfil pessoal', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  f.run('reserve', '--team', 'um', '--agent', 'claude', '--worktree', w);
  const r = f.run('prepare', '--team', 'um', '--role', 'tpl', '--worktree', w, '--spec', f.brief);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.data.argv, null);
  assert.equal(r.data.requiresPersonalTerminal, true);
});

test('tentativa comprovadamente não lançada pode ser cancelada sem apagar histórico', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  f.run('reserve', '--team', 'um', '--agent', 'codex', '--worktree', w);
  const args = ['prepare', '--team', 'um', '--role', 'tpl', '--worktree', w, '--spec', f.brief];
  f.run(...args);
  assert.notEqual(f.run('cancel-prepared', '--team', 'um', '--key', 'tpl').status, 0);
  const r = f.run(
    'cancel-prepared',
    '--team',
    'um',
    '--key',
    'tpl',
    '--evidence',
    'fixture: nenhuma chamada de launch foi feita',
  );
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.run(...args).status, 0);
  f.run('record', '--team', 'um', '--key', 'tpl', '--dispatch', 'd', '--task', 't', '--run', 'r');
  assert.notEqual(
    f.run('cancel-prepared', '--team', 'um', '--key', 'tpl', '--evidence', 'não basta').status,
    0,
  );
});
test('pedido explícito de paralelo preserva a vaga zero', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  const r = f.run(
    'reserve',
    '--team',
    'um',
    '--agent',
    'codex',
    '--worktree',
    w,
    '--parallel',
    'yes',
  );
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.data.slot, 1);
});
test('brief não lê arquivo de segredo nem usa papel fora da equipe', (t) => {
  const f = fixture(t),
    w = f.wt('um');
  f.run('reserve', '--team', 'um', '--agent', 'codex', '--worktree', w);
  const secret = join(f.dir, '.env');
  writeFileSync(secret, 'fixture only');
  assert.notEqual(
    f.run('prepare', '--team', 'um', '--role', 'tpl', '--worktree', w, '--spec', secret).status,
    0,
  );
  assert.notEqual(
    f.run('prepare', '--team', 'um', '--role', 'lider-v1', '--worktree', w, '--spec', f.brief)
      .status,
    0,
  );
});

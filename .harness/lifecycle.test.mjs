import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sessionAssignment } from './team.mjs';
import { fixture } from './test-fixture.mjs';

test('DEV exige aprovação e setup na revisão atual; alteração do spec invalida aprovação', (t) => {
  const f = fixture(t);
  assert.equal(f.call('status').teams.demo.policyVersion, 2);
  assert.throws(() => f.prepare('dev-back'), /aprova/i);
  f.approve();
  assert.throws(() => f.prepare('dev-back'), /prontidão/i);
  assert.throws(
    () =>
      f.ready(f.main, 'dev', (p) => {
        p.checks.install.exitCode = 1;
        return p;
      }),
    /install/,
  );
  f.ready();
  f.git(f.main, 'commit', '--allow-empty', '-m', 'nova revisão');
  assert.throws(() => f.prepare('dev-back'), /prontidão/i);
  f.ready();
  writeFileSync(f.spec, '# Contrato diferente\n');
  assert.throws(() => f.prepare('dev-back'), /aprova/i);
  f.approve();
  const a = f.prepare('dev-back');
  assert.ok(a.createdAt);
  assert.ok(a.id);
  assert.match(readFileSync(a.specFile, 'utf8'), /aprovação/i);
});

test('QA exige fixtures e processo isolado; configuração da aba não basta', (t) => {
  const f = fixture(t);
  f.approve();
  f.ready();
  assert.throws(() => f.prepare('qa', f.main, { round: '1' }), /prontidão/i);
  assert.throws(
    () =>
      f.ready(f.main, 'qa', (p) => {
        delete p.checks.fixtures;
        return p;
      }),
    /fixtures/,
  );
  assert.throws(
    () =>
      f.ready(f.main, 'qa', (p) => {
        p.browser.args = ['isolatedContext'];
        return p;
      }),
    /isolated/,
  );
  assert.throws(
    () =>
      f.ready(f.main, 'qa', (p) => {
        p.browser.navigation = '';
        return p;
      }),
    /navegação/,
  );
  f.ready(f.main, 'qa');
  assert.equal(f.prepare('qa', f.main, { round: '1' }).role, 'qa');
});

test('setup de outro checkout não serve mesmo quando o SHA é igual', (t) => {
  const f = fixture(t);
  const back = f.wt('demo-back');
  assert.throws(
    () =>
      f.ready(back, 'dev', (p) => {
        p.worktree = f.main;
        return p;
      }),
    /worktree/i,
  );
});

test('Par: contrato só pelo back vinculado; front exige commit ancestral e setup próprio', (t) => {
  const f = fixture(t, 'Par');
  const back = f.wt('demo-back');
  const front = f.wt('demo-front');
  f.approve();
  f.ready(back);
  f.ready(front);
  f.prepare('dev-back', back);
  f.record('dev-back');
  f.bind('dev-back', 'back-session', back);
  assert.throws(() => f.prepare('dev-front', front), /contrato/i);
  mkdirSync(join(back, 'packages/shared'), { recursive: true });
  writeFileSync(join(back, 'packages/shared/contract.ts'), 'export const contract = true;\n');
  f.git(back, 'add', '.');
  f.git(back, 'commit', '-m', 'contrato');
  const sha = f.git(back, 'rev-parse', 'HEAD');
  const args = { session: 'back-session', sha, evidence: 'commit do contrato aprovado' };
  assert.throws(() => f.call('contract', args), /back|worktree/i);
  f.call('contract', args, back);
  assert.equal(f.call('status').teams.demo.attempts['dev-back'].status, 'recorded');
  assert.throws(() => f.prepare('dev-front', front), /ancestral/i);
  f.git(front, 'merge', '--ff-only', sha);
  f.ready(front);
  assert.equal(f.prepare('dev-front', front).contract.sha, sha);
});

test('follow-up não sobrescreve recibo e recupera sessão sem dois bindings ativos', (t) => {
  const f = fixture(t);
  f.approve();
  f.ready();
  f.prepare('dev-back');
  f.record('dev-back');
  f.bind('dev-back', 'same');
  const receipt = f.call('status').teams.demo.attempts['dev-back'].receipt;
  assert.throws(
    () => f.prepare('dev-back', f.main, { after: 'dev-back', reason: 'retry' }),
    /encerrad|settled/i,
  );
  f.call('settle', { key: 'dev-back', evidence: 'Orca exited/released; nenhuma escrita' });
  const next = f.prepare('dev-back', f.main, {
    after: 'dev-back',
    reason: 'novo dispatch após encerramento',
  });
  assert.notEqual(next.key, 'dev-back');
  assert.equal(next.previousKey, 'dev-back');
  assert.throws(
    () => f.prepare('dev-back', f.main, { after: 'dev-back', reason: 'duplicado' }),
    /sucessora|follow-up/i,
  );
  assert.throws(() => f.record(next.key, 'dev-back'), /recibo|dispatch/i);
  f.record(next.key, 'retry');
  f.bind(next.key, 'same');
  assert.equal(sessionAssignment(f.main, 'same').key, next.key);
  assert.deepEqual(f.call('status').teams.demo.attempts['dev-back'].receipt, receipt);
  assert.equal(f.call('status').sessions.same.history[0].key, 'dev-back');
  assert.throws(() => f.bind(next.key, 'other'), /outra sessão/i);
});

test('release arquiva histórico e nome reutilizado ganha identidade nova', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  f.bind('tpl', 'tpl-session');
  const original = f.call('status').teams.demo;
  f.call('settle', { key: 'tpl', evidence: 'encerrado' });
  f.call('release', { evidence: 'integrado, limpo, processos encerrados e recursos livres' });
  const state = f.call('status');
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.archives[0].team.id, original.id);
  assert.equal(state.archives[0].sessions['tpl-session'].key, 'tpl');
  assert.ok(state.archives[0].releasedAt);
  f.call('reserve', { agent: 'codex', worktree: f.main });
  assert.notEqual(f.call('status').teams.demo.id, original.id);
});

test('equipes legadas continuam sem gates novos e sem timestamps retrospectivos', (t) => {
  const f = fixture(t);
  const file = join(f.root, '.git/fut-harness/state.json');
  const state = JSON.parse(readFileSync(file, 'utf8'));
  delete state.teams.demo.policyVersion;
  delete state.teams.demo.createdAt;
  writeFileSync(file, JSON.stringify(state));
  assert.equal(f.prepare('dev-back').role, 'dev-back');
  assert.equal(f.call('status').teams.demo.createdAt, undefined);
});

test('bind recusa revisão diferente do prepare e contrato sem alteração em shared', (t) => {
  const f = fixture(t);
  f.approve();
  f.ready();
  f.prepare('dev-back');
  f.record('dev-back');
  f.git(f.main, 'commit', '--allow-empty', '-m', 'mudança entre prepare e bind');
  assert.throws(() => f.bind('dev-back', 's'), /prontidão/i);
  f.ready();
  f.bind('dev-back', 's');
  assert.throws(
    () => f.call('contract', { session: 's', sha: 'HEAD', evidence: 'sem contrato' }),
    /shared/i,
  );
});

test('QA aguarda DEVs encerrados e prontidão de todos os worktrees usados', (t) => {
  const f = fixture(t, 'Back');
  const back = f.wt('demo-back');
  f.approve();
  f.ready(back);
  f.prepare('dev-back', back);
  f.record('dev-back');
  f.ready(f.main, 'qa');
  assert.throws(() => f.prepare('qa', f.main, { round: '1' }), /DEV|encerrad/i);
  f.call('settle', { key: 'dev-back', evidence: 'DEV encerrado' });
  assert.throws(() => f.prepare('qa', f.main, { round: '1' }), /prontidão/i);
  f.ready(back, 'qa');
  f.prepare('qa', f.main, { round: '1' });
  assert.throws(() => f.prepare('qa', f.main, { round: '2' }), /ativ|reconcil/i);
});

test('cancelamento de follow-up preserva intenção anterior e permite retry único', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  f.call('settle', { key: 'tpl', evidence: 'Orca encerrado' });
  const args = { after: 'tpl', reason: 'retry comprovado' };
  const attempt = f.prepare('tpl', f.main, args);
  f.call('cancel-prepared', { key: attempt.key, evidence: 'inspeção Orca comprova nenhum launch' });
  const retry = f.prepare('tpl', f.main, args);
  assert.notEqual(retry.id, attempt.id);
  assert.equal(f.call('status').teams.demo.history[0].id, attempt.id);
});

test('falha de persistência no release mantém equipe e histórico original no disco', (t) => {
  const f = fixture(t);
  const file = join(f.root, '.git/fut-harness/state.json');
  const before = readFileSync(file, 'utf8');
  mkdirSync(join(f.root, '.git/fut-harness/state.tmp'));
  assert.throws(() => f.call('release', { evidence: 'recursos livres' }));
  assert.equal(readFileSync(file, 'utf8'), before);
});

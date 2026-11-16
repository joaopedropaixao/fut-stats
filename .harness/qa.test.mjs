import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './test-fixture.mjs';

function qa(t) {
  const f = fixture(t);
  writeFileSync(join(f.main, 'feature.txt'), 'v1');
  f.git(f.main, 'add', '.');
  f.git(f.main, 'commit', '-m', 'feature');
  f.approve();
  const file = join(f.root, 'qa-plan.json');
  writeFileSync(
    file,
    JSON.stringify({ scenarios: [{ id: 'C1', paths: ['feature.txt'], test: 'integração' }] }),
  );
  f.call('qa-plan', { file });
  f.ready(f.main, 'qa');
  f.prepare('qa', f.main, { round: '1' });
  f.record('qa-1');
  f.bind('qa-1', 'qa-session');
  const evidence = (id, status = 'passed', issue) =>
    f.call('qa-evidence', {
      session: 'qa-session',
      scenario: id,
      status,
      evidence: 'relatório real da fixture',
      ...(issue ? { issue } : {}),
    });
  const result = (outcome) => f.call('qa-result', { session: 'qa-session', outcome });
  return { ...f, evidence, result };
}

test('QA só aprova matriz completa e exige sessão independente vinculada', (t) => {
  const f = qa(t);
  assert.throws(
    () =>
      f.call('qa-evidence', { session: 'dev', scenario: 'C1', status: 'passed', evidence: 'x' }),
    /QA/,
  );
  f.evidence('C1');
  assert.throws(() => f.result('approved'), /incompleta/);
  for (const id of ['lint', 'typecheck', 'test', 'build']) f.evidence(id);
  assert.equal(f.result('approved').outcome, 'approved');
  assert.equal(f.call('qa-status').next, 'deliver');
  f.call('qa-invalidate', { reason: 'nova informação' });
  assert.equal(f.call('report').summary.approved, 0);
});

test('evidência incremental sobrevive a mudança irrelevante e invalida dependência alterada', (t) => {
  const f = qa(t);
  f.evidence('C1');
  writeFileSync(join(f.main, 'unrelated.txt'), 'docs');
  f.git(f.main, 'add', '.');
  f.git(f.main, 'commit', '-m', 'fora do cenário');
  assert.equal(f.call('qa-status').scenarios.find((r) => r.id === 'C1').status, 'passed');
  writeFileSync(join(f.main, 'feature.txt'), 'v2');
  f.git(f.main, 'add', '.');
  f.git(f.main, 'commit', '-m', 'muda cenário');
  assert.equal(f.call('qa-status').scenarios.find((r) => r.id === 'C1').status, 'stale');
  f.call('qa-invalidate', { reason: 'regressão ampliada' });
  assert.equal(f.call('qa-status').scenarios.find((r) => r.id === 'C1').status, 'stale');
});

test('infraestrutura não consome rodada funcional; duas correções falhas escalam ao TPL', (t) => {
  const f = qa(t);
  f.evidence('C1', 'inconclusive');
  f.result('inconclusive');
  assert.equal(f.call('qa-status').functionalRounds, 0);
  f.evidence('C1', 'failed', 'bug-1');
  f.result('rejected');
  f.call('qa-correction', { issue: 'bug-1', evidence: 'correção 1' });
  f.evidence('C1', 'failed', 'bug-1');
  f.call('qa-correction', { issue: 'bug-1', evidence: 'correção 2' });
  f.evidence('C1', 'failed', 'bug-1');
  const status = f.call('qa-status');
  assert.equal(status.functionalRounds, 1);
  assert.equal(status.escalations[0].issue, 'bug-1');
  assert.equal(status.escalations[0].to, 'tpl');
});

test('spec alterado ou arquivo sujo impede reutilizar a aprovação QA', (t) => {
  const f = qa(t);
  for (const id of ['C1', 'lint', 'typecheck', 'test', 'build']) f.evidence(id);
  f.result('approved');
  writeFileSync(join(f.main, 'feature.txt'), 'alteração não commitada');
  assert.notEqual(f.call('qa-status').next, 'deliver');
  assert.equal(f.call('report').summary.approved, 0);
  assert.throws(() => f.evidence('C1'), /sujo|alterações/);
  writeFileSync(f.spec, '# outro contrato');
  assert.throws(() => f.result('approved'), /aprova/i);
});

test('correção aprovada não vira falha de correção quando problema reincide', (t) => {
  const f = qa(t);
  f.evidence('C1', 'failed', 'bug');
  f.call('qa-correction', { issue: 'bug', evidence: 'fix' });
  f.evidence('C1', 'passed', 'bug');
  f.evidence('C1', 'failed', 'bug');
  assert.equal(f.call('status').teams.demo.qa.issues.bug.failedCorrections, 0);
});

test('replanejamento preserva rodadas e retrabalho de planos anteriores', (t) => {
  const f = qa(t);
  f.evidence('C1', 'failed', 'bug');
  f.result('rejected');
  f.call('qa-correction', { issue: 'bug', evidence: 'fix' });
  f.call('settle', { key: 'qa-1', evidence: 'encerrado' });
  f.call('qa-plan', { file: join(f.root, 'qa-plan.json') });
  f.ready(f.main, 'qa');
  f.prepare('qa', f.main, { round: '2' });
  f.record('qa-2');
  f.bind('qa-2', 'qa-new');
  for (const id of ['C1', 'lint', 'typecheck', 'test', 'build'])
    f.call('qa-evidence', { session: 'qa-new', scenario: id, status: 'passed', evidence: 'log' });
  f.call('qa-result', { session: 'qa-new', outcome: 'approved' });
  const report = f.call('report');
  assert.equal(report.summary.firstPassRate, 0);
  assert.equal(report.tasks[0].functionalRounds, 2);
  assert.equal(report.tasks[0].corrections, 1);
  assert.equal(f.call('qa-status').functionalRounds, 2);
});

test('release congela validade atual e não ressuscita aprovação obsoleta', (t) => {
  const f = qa(t);
  for (const id of ['C1', 'lint', 'typecheck', 'test', 'build']) f.evidence(id);
  f.result('approved');
  f.call('settle', { key: 'qa-1', evidence: 'encerrado' });
  writeFileSync(join(f.main, 'feature.txt'), 'v2');
  f.git(f.main, 'add', '.');
  f.git(f.main, 'commit', '-m', 'alteração');
  assert.equal(f.call('report').summary.approved, 0);
  f.call('release', { evidence: 'preservado e encerrado' });
  assert.equal(f.call('report').summary.approved, 0);
});

test('duas correções falhas do mesmo issue em planos distintos mantêm escalonamento', (t) => {
  const f = qa(t);
  f.evidence('C1', 'failed', 'bug');
  f.call('qa-correction', { issue: 'bug', evidence: 'fix1' });
  f.evidence('C1', 'failed', 'bug');
  f.result('rejected');
  f.call('settle', { key: 'qa-1', evidence: 'encerrado' });
  f.call('qa-plan', { file: join(f.root, 'qa-plan.json') });
  f.ready(f.main, 'qa');
  f.prepare('qa', f.main, { round: '2' });
  f.record('qa-2');
  f.bind('qa-2', 'qa-new');
  const fail = () =>
    f.call('qa-evidence', {
      session: 'qa-new',
      scenario: 'C1',
      status: 'failed',
      issue: 'bug',
      evidence: 'log',
    });
  fail();
  f.call('qa-correction', { issue: 'bug', evidence: 'fix2' });
  fail();
  assert.deepEqual(f.call('qa-status').escalations, [{ issue: 'bug', to: 'tpl' }]);
  assert.equal(f.call('report').tasks[0].escalations, 1);
});

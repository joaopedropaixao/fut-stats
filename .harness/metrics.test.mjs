import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync, rmSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixture } from './test-fixture.mjs';

function sample(f, tokens = { input: 100, output: 20, cachedInput: 10, reasoning: 5, total: 120 }) {
  const attempt = f.call('status').teams.demo.attempts.tpl;
  const file = join(f.root, 'usage.json');
  writeFileSync(
    file,
    JSON.stringify({
      source: 'codex-runtime',
      scope: 'attempt',
      attemptId: attempt.id,
      dispatch: attempt.receipt.dispatch,
      reference: 'export oficial isolado desta execução',
      observedAt: new Date().toISOString(),
      model: 'gpt-6.1-sol',
      effort: 'medium',
      tokens,
    }),
  );
  return file;
}

test('uso cumulativo repetido não soma duas vezes; ausência nunca vira zero', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  assert.equal(f.call('report').summary.tokens.total, null);
  const file = sample(f);
  f.call('usage', { key: 'tpl', file });
  f.call('usage', { key: 'tpl', file });
  const report = f.call('report');
  assert.equal(report.summary.tokens.total, 120);
  assert.equal(report.summary.tokens.cachedInput, 10);
  assert.equal(report.summary.estimatedCost, null);
  assert.equal(report.attempts[0].modelVerified, true);
  assert.throws(
    () =>
      f.call('usage', {
        key: 'tpl',
        file: sample(f, { input: 1, output: 2, cachedInput: 0, reasoning: 0, total: 3 }),
      }),
    /cumulativo|regredir/,
  );
});

test('telemetria indisponível não impede reserva e tentativa; erro fica identificável', (t) => {
  const f = fixture(t);
  const dir = join(f.root, '.git/fut-harness');
  rmSync(join(dir, 'events.jsonl'));
  mkdirSync(join(dir, 'events.jsonl'));
  assert.doesNotThrow(() => f.prepare('tpl'));
  const report = f.call('report');
  assert.ok(report.warnings.length > 0);
});

test('relatório distingue tempo paralelo, atividade e espera humana', async () => {
  const { buildReport } = await import('./metrics.mjs');
  const start = '2026-01-01T00:00:00.000Z',
    middle = '2026-01-01T00:00:05.000Z',
    end = '2026-01-01T00:00:10.000Z';
  const a = (id) => ({
    id,
    role: 'dev-back',
    status: 'settled',
    recordedAt: start,
    settledAt: end,
    activity: [
      { phase: 'working', at: start },
      { phase: 'waiting', at: middle },
    ],
    routing: { model: 'gpt-6-luna', effort: 'low', complexity: 'ROTINEIRA' },
  });
  const team = {
    id: 'team',
    name: 'demo',
    createdAt: start,
    attempts: { a: a('a'), b: a('b') },
    classification: { complexity: 'ROTINEIRA' },
    workflowHistory: [{ phase: 'IMPLEMENT', at: start }],
    ownerWaits: [{ start, end: middle }],
    qa: { results: [{ outcome: 'approved', round: '1', at: end }], issues: {} },
  };
  const report = buildReport({ teams: { demo: team }, archives: [] });
  assert.equal(report.tasks[0].elapsedMs, 10000);
  assert.equal(report.summary.agentActiveMs, 10000);
  assert.equal(report.summary.agentElapsedMs, 20000);
  assert.equal(report.summary.ownerWaitMs, 5000);
  assert.equal(report.summary.firstPassRate, 1);
});

test('custos estimados usam preços versionados e não viram cobrança real', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  f.call('usage', { key: 'tpl', file: sample(f) });
  const prices = join(f.root, 'prices.json');
  writeFileSync(
    prices,
    JSON.stringify({
      source: 'fixture sem preço comercial',
      version: 'test-1',
      currency: 'USD',
      models: { 'gpt-6.1-sol': { input: 1, cachedInput: 0.5, output: 2 } },
    }),
  );
  const report = f.call('report', { prices });
  assert.equal(report.summary.estimatedCost, 0.000135);
  assert.equal(report.summary.actualCost, null);
  assert.equal(report.priceSource.version, 'test-1');
});

test('workflow exige aprovação antes de IMPLEMENT e espera humana é explícita', (t) => {
  const f = fixture(t);
  f.call('workflow', { phase: 'RESEARCH' });
  f.call('workflow', { phase: 'PLAN' });
  f.call('owner-wait', { state: 'start' });
  assert.throws(() => f.call('workflow', { phase: 'IMPLEMENT' }), /aprova/i);
  f.approve();
  f.call('workflow', { phase: 'IMPLEMENT' });
  assert.ok(f.call('status').teams.demo.ownerWaits[0].end);
});

test('uso rejeita agregado de sessão, identidade divergente e subconjuntos inválidos', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  const file = sample(f);
  const bad = (change) => {
    const a = f.call('status').teams.demo.attempts.tpl;
    writeFileSync(
      file,
      JSON.stringify({
        source: 'codex-runtime',
        scope: 'attempt',
        attemptId: a.id,
        dispatch: a.receipt.dispatch,
        reference: 'fixture',
        observedAt: new Date().toISOString(),
        model: 'gpt-6.1-sol',
        tokens: { input: 10, output: 5, cachedInput: 20, total: 15 },
        ...change,
      }),
    );
    return () => f.call('usage', { key: 'tpl', file });
  };
  assert.throws(bad({ scope: 'session' }), /export oficial/);
  assert.throws(bad({ attemptId: 'other' }), /export oficial/);
  assert.throws(bad({}), /subconjuntos/);
});

test('período filtra tarefas pelo início e arquivo de telemetria resiste a linha parcial', async (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  const { appendFileSync } = await import('node:fs');
  appendFileSync(join(f.root, '.git/fut-harness/events.jsonl'), '{incompleto');
  const report = f.call('report', { since: '2100-01-01' });
  assert.equal(report.summary.tasks, 0);
  assert.equal(report.summary.tokens.total, null);
  assert.ok(report.warnings.some((w) => w.includes('parcial')));
  assert.throws(() => f.call('telemetry-prune', { days: '30' }), /reconciliar/);
});

test('release conserva métricas e custo parcial não é total conhecido', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  f.call('usage', { key: 'tpl', file: sample(f) });
  f.call('settle', { key: 'tpl', evidence: 'encerrado' });
  f.call('release', { evidence: 'integrado e recursos livres' });
  assert.equal(f.call('report').summary.tokens.total, 120);
  assert.match(f.call('report', { format: 'markdown' }), /custo real: indisponível/);
});

test('não importa uso de tentativa sem recibo nem marca esforço ausente como divergente', (t) => {
  const f = fixture(t);
  const a = f.prepare('tpl');
  const file = join(f.root, 'early.json');
  writeFileSync(
    file,
    JSON.stringify({
      source: 'codex-runtime',
      scope: 'attempt',
      attemptId: a.id,
      reference: 'sem recibo',
      observedAt: new Date().toISOString(),
      model: 'gpt-6.1-sol',
      tokens: {},
    }),
  );
  assert.throws(() => f.call('usage', { key: 'tpl', file }), /recibo|dispatch/i);
  f.record('tpl');
  const official = sample(f);
  const data = JSON.parse(readFileSync(official, 'utf8'));
  delete data.effort;
  writeFileSync(official, JSON.stringify(data));
  f.call('usage', { key: 'tpl', file: official });
  assert.equal(f.call('report').attempts[0].modelVerified, null);
});

test('tarefa classificada sem worker aparece no grupo; reclassificação não reatribui consumo', (t) => {
  const f = fixture(t);
  f.call('classify', { complexity: 'COMPLEXA', reason: 'arquitetura' });
  assert.equal(f.call('report').byComplexity.COMPLEXA.tasks, 1);
});

test('uso total do TPL sem fases oficiais não é atribuído inteiro ao RESEARCH', (t) => {
  const f = fixture(t);
  f.prepare('tpl');
  f.record('tpl');
  f.call('usage', { key: 'tpl', file: sample(f) });
  const report = f.call('report');
  assert.equal(report.attempts[0].phase, null);
  assert.equal(report.attempts[0].scheduledPhase, 'RESEARCH');
});

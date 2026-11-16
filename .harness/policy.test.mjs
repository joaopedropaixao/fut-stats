import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixture } from './test-fixture.mjs';
import { readFileSync } from 'node:fs';

test('matriz resolve todos os papéis e complexidades sem trocar orquestrador', (t) => {
  const f = fixture(t, 'Back', false);
  const expected = {
    ROTINEIRA: [
      ['gpt-6.1-sol', 'medium'],
      ['gpt-6-luna', 'low'],
      ['gpt-6-luna', 'low'],
    ],
    MEDIANA: [
      ['gpt-6.1-sol', 'high'],
      ['gpt-6.1-sol', 'low'],
      ['gpt-6.1-sol', 'medium'],
    ],
    COMPLEXA: [
      ['gpt-6-astra', 'medium'],
      ['gpt-6.1-sol', 'medium'],
      ['gpt-6.1-sol', 'high'],
    ],
  };
  for (const [complexity, values] of Object.entries(expected)) {
    for (const [role, index] of [
      ['tpl', 0],
      ['dev-back', 1],
      ['dev-front', 1],
      ['qa', 2],
    ]) {
      const policy = f.call('policy', { role, complexity });
      assert.deepEqual([policy.model, policy.effort], values[index]);
    }
    assert.deepEqual(f.call('policy', { role: 'orchestrator', complexity }).model, 'gpt-6.1-sol');
    assert.equal(f.call('policy', { role: 'orchestrator', complexity }).effort, 'low');
  }
});

test('config do coordenador corresponde à matriz única', async () => {
  const { defaultConfig } = await import('./policy.mjs');
  assert.equal(
    readFileSync(new URL('../.codex/config.toml', import.meta.url), 'utf8'),
    defaultConfig(),
  );
});

test('classificação obrigatória e reclassificação só afeta próximas execuções', (t) => {
  const f = fixture(t, 'Back', false);
  assert.throws(() => f.prepare('tpl'), /classifi/i);
  f.call('classify', { complexity: 'ROTINEIRA', reason: 'escopo isolado' });
  const first = f.prepare('tpl');
  assert.equal(first.routing.model, 'gpt-6.1-sol');
  assert.equal(first.argv[first.argv.indexOf('--effort') + 1], 'medium');
  f.record('tpl');
  f.call('classify', { complexity: 'COMPLEXA', reason: 'impacto arquitetural revelado' });
  assert.equal(f.call('status').teams.demo.attempts.tpl.routing.complexity, 'ROTINEIRA');
  f.call('settle', { key: 'tpl', evidence: 'encerrado' });
  const next = f.prepare('tpl', f.main, { after: 'tpl', reason: 'nova etapa' });
  assert.equal(next.routing.model, 'gpt-6-astra');
  assert.equal(f.call('status').teams.demo.classificationHistory.length, 1);
});

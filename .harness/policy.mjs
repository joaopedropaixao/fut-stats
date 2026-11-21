import { readFileSync } from 'node:fs';
import { nonempty, timestamp } from './lifecycle.mjs';
export const policy = JSON.parse(
  readFileSync(new URL('./model-policy.json', import.meta.url), 'utf8'),
);

export function resolvePolicy(role, complexity) {
  // Líder tem as responsabilidades de investigação/planejamento do TPL.
  const pair = policy.roles[role === 'lider-v1' ? 'tpl' : role]?.[complexity];
  if (!pair) throw new Error('Papel ou complexidade inválidos para a política.');
  return { model: pair[0], effort: pair[1], complexity, policyVersion: policy.version };
}

export function classify(team, options) {
  if (team.agent !== 'codex') throw new Error('Política de modelos é exclusiva do Codex.');
  resolvePolicy('tpl', options.complexity);
  const reason = nonempty(options.reason, 'justificativa da classificação');
  const current = { complexity: options.complexity, reason, at: timestamp() };
  team.classificationHistory ??= [];
  if (team.classification) team.classificationHistory.push(team.classification);
  team.classification = current;
  return current;
}

export function routingFor(team, role) {
  if (team.agent !== 'codex') return null;
  if (!team.routingVersion)
    return { model: 'gpt-6-luna', effort: 'medium', complexity: null, policyVersion: 0 };
  if (!team.classification) throw new Error('Classifique a tarefa antes da delegação.');
  return resolvePolicy(role, team.classification.complexity);
}

export function defaultConfig() {
  const { model, effort } = resolvePolicy('orchestrator', 'ROTINEIRA');
  return `# Derivado de .harness/model-policy.json; tentativas usam o roteamento explícito.\n# Não altera sessões já abertas nem o perfil Claude.\nmodel = "${model}"\nmodel_reasoning_effort = "${effort}"\n`;
}

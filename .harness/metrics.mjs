import { appendFileSync, existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { document, nonempty, timestamp } from './lifecycle.mjs';
import { issuesFor } from './qa.mjs';

const tokenKeys = ['input', 'output', 'cachedInput', 'reasoning', 'total'];
const time = (s) => (s ? Date.parse(s) : NaN);
const duration = (a, b) =>
  Number.isFinite(time(a)) && Number.isFinite(time(b)) && time(b) >= time(a)
    ? time(b) - time(a)
    : null;
const knownSum = (values) =>
  values.length && values.every((n) => n !== null && Number.isFinite(n))
    ? values.reduce((a, b) => a + b, 0)
    : null;
const mean = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const median = (values) => {
  const v = [...values].sort((a, b) => a - b);
  return v.length ? (v[Math.floor((v.length - 1) / 2)] + v[Math.floor(v.length / 2)]) / 2 : null;
};

export function usage(attempt, file) {
  if (!attempt.receipt?.dispatch || !['recorded', 'settled'].includes(attempt.status))
    throw new Error('Uso exige recibo de launch com dispatch.');
  const input = JSON.parse(document(file, '.json').content);
  if (
    input.source !== 'codex-runtime' ||
    input.scope !== 'attempt' ||
    input.attemptId !== attempt.id ||
    input.dispatch !== attempt.receipt?.dispatch
  )
    throw new Error(
      'Uso exige export oficial cumulativo desta tentativa/dispatch; totais de sessão não são intercambiáveis.',
    );
  if (!Number.isFinite(time(input.observedAt))) throw new Error('Timestamp de uso inválido.');
  const tokens = {};
  for (const key of tokenKeys) {
    const value = input.tokens?.[key] ?? null;
    if (value !== null && (!Number.isSafeInteger(value) || value < 0))
      throw new Error(`Contagem inválida: ${key}.`);
    if (
      attempt.observation?.tokens[key] != null &&
      (value === null || value < attempt.observation.tokens[key])
    )
      throw new Error('Snapshot cumulativo não pode regredir.');
    tokens[key] = value;
  }
  if (
    (tokens.input !== null && tokens.cachedInput > tokens.input) ||
    (tokens.output !== null && tokens.reasoning > tokens.output) ||
    (tokens.total !== null &&
      tokens.input !== null &&
      tokens.output !== null &&
      tokens.total !== tokens.input + tokens.output)
  )
    throw new Error('Contagens inconsistentes; cache/raciocínio são subconjuntos.');
  if (attempt.observation && time(input.observedAt) < time(attempt.observation.observedAt))
    throw new Error('Snapshot cumulativo anterior ao último registro.');
  const model = nonempty(input.model, 'modelo observado');
  const phase = input.phase ?? null;
  if (phase !== null && !['RESEARCH', 'PLAN', 'IMPLEMENT', 'VERIFY'].includes(phase))
    throw new Error('Fase de uso inválida.');
  if (attempt.observation?.phase && phase !== attempt.observation.phase)
    throw new Error('Snapshot cumulativo não pode mudar atribuição de fase.');
  const effort = input.effort ?? null;
  if (effort !== null && !['low', 'medium', 'high', 'xhigh', 'max', 'ultra'].includes(effort))
    throw new Error('Esforço observado inválido.');
  let cost = null;
  if (input.cost) {
    if (
      !Number.isFinite(input.cost.amount) ||
      input.cost.amount < 0 ||
      !/^[A-Z]{3}$/.test(input.cost.currency || '')
    )
      throw new Error('Custo real inválido.');
    cost = {
      amount: input.cost.amount,
      currency: input.cost.currency,
      source: nonempty(input.cost.source, 'fonte do custo real'),
    };
  }
  attempt.observation = {
    source: input.source,
    scope: input.scope,
    reference: nonempty(input.reference, 'referência oficial'),
    observedAt: input.observedAt,
    model,
    phase,
    effort,
    tokens,
    cost,
  };
  return attempt.observation;
}

export function appendEvent(dir, context, team, attempt) {
  // Whitelist: nunca copiar options, brief, evidências, respostas ou credenciais.
  const event = {
    id: randomUUID(),
    at: timestamp(),
    type: context.command,
    teamId: team?.id ?? null,
    attemptId: attempt?.id ?? null,
    role: attempt?.role ?? null,
    complexity: attempt?.routing?.complexity ?? team?.classification?.complexity ?? null,
    phase: context.command === 'workflow' ? context.options.phase : null,
    status: attempt?.status ?? null,
    model: attempt?.routing?.model ?? null,
    effort: attempt?.routing?.effort ?? null,
  };
  try {
    appendFileSync(join(dir, 'events.jsonl'), JSON.stringify(event) + '\n', { mode: 0o600 });
  } catch {
    process.stderr.write('Aviso: telemetria não gravada; estado operacional preservado.\n');
  }
}

export function readEvents(dir) {
  const path = join(dir, 'events.jsonl');
  if (!existsSync(path)) return { events: [], warnings: ['Journal de telemetria indisponível.'] };
  const events = [],
    warnings = [];
  const ids = new Set();
  try {
    for (const line of readFileSync(path, 'utf8').split('\n').filter(Boolean)) {
      try {
        const e = JSON.parse(line);
        if (!e.id || !Number.isFinite(time(e.at))) throw new Error();
        if (!ids.has(e.id)) {
          ids.add(e.id);
          events.push(e);
        }
      } catch {
        warnings.push('Evento inválido ignorado; cobertura parcial.');
      }
    }
  } catch {
    warnings.push('Journal de telemetria ilegível; cobertura parcial.');
  }
  return { events, warnings };
}

export function pruneEvents(dir, days) {
  if (!Number.isInteger(days) || days < 1) throw new Error('Retenção exige dias positivos.');
  const { events, warnings } = readEvents(dir);
  if (warnings.length)
    throw new Error('Journal incompleto: não descartar dados antes de reconciliar.');
  const kept = events.filter((e) => time(e.at) >= Date.now() - days * 86400000);
  const tmp = join(dir, 'events.tmp');
  writeFileSync(tmp, kept.map((e) => JSON.stringify(e) + '\n').join(''), { mode: 0o600 });
  renameSync(tmp, join(dir, 'events.jsonl'));
  return { removed: events.length - kept.length, retained: kept.length, days };
}

function activeMs(attempt) {
  if (!attempt.activity?.length || !attempt.settledAt) return null;
  return attempt.activity.reduce(
    (sum, row, i) =>
      sum +
      (row.phase === 'working' || row.phase === 'delivering'
        ? (duration(row.at, attempt.activity[i + 1]?.at || attempt.settledAt) ?? 0)
        : 0),
    0,
  );
}

export function loadPrices(file) {
  if (!file) return null;
  const p = JSON.parse(document(file, '.json').content);
  nonempty(p.source, 'fonte de preços');
  nonempty(p.version, 'versão/data dos preços');
  if (!/^[A-Z]{3}$/.test(p.currency || '') || !p.models || typeof p.models !== 'object')
    throw new Error('Tabela de preços inválida.');
  for (const rates of Object.values(p.models))
    for (const key of ['input', 'cachedInput', 'output'])
      if (!Number.isFinite(rates[key]) || rates[key] < 0)
        throw new Error('Preços por milhão inválidos.');
  return p;
}

function estimate(observation, prices) {
  const rates = prices?.models[observation?.model];
  const t = observation?.tokens;
  if (!rates || !t || [t.input, t.output, t.cachedInput].some((n) => n === null)) return null;
  return (
    ((t.input - t.cachedInput) * rates.input +
      t.cachedInput * rates.cachedInput +
      t.output * rates.output) /
    1000000
  );
}

function aggregate(tasks, attempts) {
  const completed = tasks.filter((t) => t.approved);
  const verified = tasks.filter((t) => t.functionalRounds > 0);
  const times = completed.map((t) => t.elapsedMs).filter((v) => v !== null);
  const actualCurrencies = new Set(attempts.map((a) => a.actualCurrency).filter(Boolean));
  const tokens = Object.fromEntries(
    tokenKeys.map((k) => [k, knownSum(attempts.map((a) => a.tokens[k]))]),
  );
  const estimatedCost = knownSum(attempts.map((a) => a.estimatedCost));
  return {
    tasks: tasks.length,
    approved: completed.length,
    blocked: tasks.filter((t) => t.phase === 'BLOCKED').length,
    incomplete: tasks.filter((t) => !t.approved).length,
    attempts: attempts.length,
    tokens,
    knownTokens: Object.fromEntries(
      tokenKeys.map((k) => [k, attempts.reduce((s, a) => s + (a.tokens[k] ?? 0), 0)]),
    ),
    usageCoverage: {
      known: attempts.filter((a) => a.tokens.total !== null).length,
      total: attempts.length,
    },
    estimatedCost,
    actualCost: actualCurrencies.size === 1 ? knownSum(attempts.map((a) => a.actualCost)) : null,
    actualCurrency: actualCurrencies.size === 1 ? [...actualCurrencies][0] : null,
    agentActiveMs: knownSum(attempts.map((a) => a.activeMs)),
    agentElapsedMs: knownSum(attempts.map((a) => a.elapsedMs)),
    ownerWaitMs: knownSum(tasks.map((t) => t.ownerWaitMs)),
    meanDeliveryMs: mean(times),
    medianDeliveryMs: median(times),
    deliverySamples: times.length,
    meanQaCycles: mean(verified.map((t) => t.functionalRounds)),
    firstPassRate: verified.length
      ? verified.filter((t) => t.approved && t.functionalRounds === 1 && t.rejectedRounds === 0)
          .length / verified.length
      : null,
    tokensPerApprovedTask:
      completed.length && tokens.total !== null ? tokens.total / completed.length : null,
    estimatedCostPerApprovedTask:
      completed.length && estimatedCost !== null ? estimatedCost / completed.length : null,
  };
}

export function buildReport(state, options = {}, journal = { events: [], warnings: [] }) {
  const prices = options.prices ?? null;
  const since = options.since ? time(options.since) : -Infinity,
    until = options.until ? time(options.until) : Infinity;
  if (Number.isNaN(since) || Number.isNaN(until) || since > until)
    throw new Error('Período inválido.');
  const teams = [
    ...Object.values(state.teams || {}),
    ...(state.archives || []).map((a) => a.team),
  ].filter(
    (t) =>
      (!options.since && !options.until) ||
      (time(t.createdAt) >= since && time(t.createdAt) <= until),
  );
  const tasks = [],
    attempts = [];
  for (const team of teams) {
    const plans = [...(team.qaHistory || []), ...(team.qa ? [team.qa] : [])];
    const results = plans.flatMap((p) => p.results);
    const issues = Object.entries(issuesFor(team));
    const approved =
      team.qa?.results.at(-1)?.outcome === 'approved' &&
      team.qa?.valid !== false &&
      options.qaValidity?.[team.id] !== false;
    const end = approved ? results.at(-1).at : null;
    const waits = team.ownerWaits;
    const task = {
      id: team.id ?? null,
      name: team.name,
      complexity: team.classification?.complexity ?? null,
      phase: team.workflowHistory?.at(-1)?.phase ?? null,
      approved,
      elapsedMs: duration(team.createdAt, end),
      ownerWaitMs: waits
        ? waits.length
          ? knownSum(waits.map((w) => duration(w.start, w.end)))
          : 0
        : null,
      functionalRounds: new Set(
        results.filter((r) => r.outcome !== 'inconclusive').map((r) => r.round),
      ).size,
      rejectedRounds: new Set(results.filter((r) => r.outcome === 'rejected').map((r) => r.round))
        .size,
      issues: new Set(issues.map(([id]) => id)).size,
      corrections: issues.reduce((s, [, i]) => s + i.corrections.length, 0),
      reclassifications: team.classificationHistory?.length ?? 0,
      escalations: issues.map(([, i]) => i).filter((i) => i.failedCorrections >= 2).length,
      phases: {},
    };
    for (const [i, row] of (team.workflowHistory || []).entries()) {
      const d = duration(row.at, team.workflowHistory[i + 1]?.at || end);
      task.phases[row.phase] =
        d === null || task.phases[row.phase] === null ? null : (task.phases[row.phase] || 0) + d;
    }
    tasks.push(task);
    for (const a of [...Object.values(team.attempts), ...(team.history || [])]) {
      const o = a.observation;
      attempts.push({
        id: a.id ?? null,
        teamId: team.id ?? null,
        role: a.role,
        complexity: a.routing?.complexity ?? null,
        phase: o?.phase ?? null,
        scheduledPhase: a.workflowPhase ?? null,
        status: a.status,
        requestedModel: a.routing?.model ?? null,
        requestedEffort: a.routing?.effort ?? null,
        model: o?.model ?? a.routing?.model ?? null,
        effort: o?.effort ?? null,
        modelVerified:
          o && o.effort !== null
            ? o.model === a.routing?.model && o.effort === a.routing?.effort
            : null,
        elapsedMs: duration(a.recordedAt, a.settledAt),
        activeMs: activeMs(a),
        tokens: o?.tokens ?? Object.fromEntries(tokenKeys.map((k) => [k, null])),
        estimatedCost: estimate(o, prices),
        actualCost: o?.cost?.amount ?? null,
        actualCurrency: o?.cost?.currency ?? null,
      });
    }
  }
  const by = (key) =>
    Object.fromEntries(
      [...new Set(attempts.map((a) => a[key] ?? 'indisponível'))].map((value) => {
        const selected = attempts.filter((a) => (a[key] ?? 'indisponível') === value);
        const ids = new Set(selected.map((a) => a.teamId));
        return [
          value,
          aggregate(
            tasks.filter((t) => ids.has(t.id)),
            selected,
          ),
        ];
      }),
    );
  return {
    generatedAt: timestamp(),
    period: {
      since: options.since ?? null,
      until: options.until ?? null,
      basis: 'coorte por criação da tarefa; métricas de toda sua execução',
    },
    summary: aggregate(tasks, attempts),
    tasks,
    attempts,
    byComplexity: Object.fromEntries(
      [...new Set(tasks.map((t) => t.complexity ?? 'indisponível'))].map((key) => {
        const group = tasks.filter((t) => (t.complexity ?? 'indisponível') === key);
        const ids = new Set(group.map((t) => t.id));
        return [
          key,
          aggregate(
            group,
            attempts.filter((a) => ids.has(a.teamId)),
          ),
        ];
      }),
    ),
    byExecutionComplexity: by('complexity'),
    observations: [
      `${attempts.filter((a) => a.tokens.total !== null).length}/${attempts.length} execuções com total de tokens oficial.`,
      `${attempts.filter((a) => a.modelVerified === false).length} execuções com divergência observada de modelo/esforço.`,
      ...(tasks.length < 5
        ? ['Amostra inferior a cinco tarefas; sem recomendação comparativa de eficiência.']
        : []),
    ],
    byRole: by('role'),
    byModel: by('model'),
    byPhase: by('phase'),
    priceSource: prices
      ? {
          source: prices.source,
          version: prices.version,
          currency: prices.currency,
          unit: 'por milhão de tokens',
        }
      : null,
    journalEvents: journal.events.length,
    warnings: journal.warnings,
    notes: [
      'Tempo ativo é a soma de intervalos working/delivering registrados, não tempo de CPU nem cobrança.',
      'Modelos sem observação são apenas solicitados. Dados ausentes permanecem null; knownTokens é subtotal com cobertura.',
      'byComplexity agrupa tarefas pela classificação atual; byExecutionComplexity conserva a classificação da execução. Uso sem fase oficial não é atribuído pela fase inicial do worker.',
      'Menor consumo não prova qualidade; nenhuma alteração automática da política.',
    ],
  };
}

export function markdownReport(report) {
  const show = (v) => (v === null ? 'indisponível' : String(v));
  return `# Desempenho do harness\n\nTarefas: ${report.summary.tasks}; aprovadas: ${report.summary.approved}; incompletas: ${report.summary.incomplete}.\n\nTokens totais: ${show(report.summary.tokens.total)} (cobertura ${report.summary.usageCoverage.known}/${report.summary.usageCoverage.total}).\nCusto estimado: ${show(report.summary.estimatedCost)} ${report.priceSource?.currency || ''}; custo real: ${show(report.summary.actualCost)} ${report.summary.actualCurrency || ''}.\n\n| Complexidade | Tarefas | Aprovadas | Tokens | Ciclos QA médios |\n|---|---:|---:|---:|---:|\n${Object.entries(
    report.byComplexity,
  )
    .map(
      ([k, v]) =>
        `| ${k} | ${v.tasks} | ${v.approved} | ${show(v.tokens.total)} | ${show(v.meanQaCycles)} |`,
    )
    .join(
      '\n',
    )}\n\n${[...report.notes, ...report.warnings].map((n) => `- ${n}`).join('\n')}\n\nConsulte --format json para tempos, agrupamentos por papel/modelo/fase e execuções individuais.\n`;
}

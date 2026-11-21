import { createHash } from 'node:crypto';
import { approvalFor, document, nonempty, timestamp } from './lifecycle.mjs';

const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const suiteIds = ['lint', 'typecheck', 'test', 'build'];
const allowedArtifact = (path, team) =>
  path.startsWith(`docs/design/prints/${team}/`) || path.startsWith('.playwright-mcp/');

function snapshot(team, scenario, git) {
  const roots = [
    ...new Set([
      team.worktree,
      ...Object.values(team.attempts)
        .filter((a) => a.role.startsWith('dev-'))
        .map((a) => a.worktree),
    ]),
  ].sort();
  const entries = roots.map((root) => {
    const changed = [
      git(root, '--literal-pathspecs', 'diff', '--name-only', 'HEAD', '--', ...scenario.paths),
      git(
        root,
        '--literal-pathspecs',
        'ls-files',
        '--others',
        '--exclude-standard',
        '--',
        ...scenario.paths,
      ),
    ]
      .join('\n')
      .split('\n')
      .filter((p) => p && !allowedArtifact(p, team.name));
    const tree = git(root, '--literal-pathspecs', 'ls-tree', '-r', 'HEAD', '--', ...scenario.paths)
      .split('\n')
      .filter((line) => !allowedArtifact(line.split('\t')[1] || '', team.name));
    return { root, tree, dirty: changed.length > 0 };
  });
  return {
    fingerprint: hash(entries.map(({ root, tree }) => ({ root, tree }))),
    dirty: entries.some((e) => e.dirty),
    heads: Object.fromEntries(roots.map((p) => [p, git(p, 'rev-parse', 'HEAD')])),
  };
}

export function issuesFor(team) {
  const combined = {};
  for (const plan of [...(team.qaHistory || []), ...(team.qa ? [team.qa] : [])]) {
    for (const [id, issue] of Object.entries(plan.issues)) {
      const previous = combined[id];
      combined[id] = {
        ...issue,
        corrections: [...(previous?.corrections || []), ...issue.corrections],
        failedCorrections: (previous?.failedCorrections || 0) + issue.failedCorrections,
      };
    }
  }
  return combined;
}

export function qaStatus(team, git) {
  if (!team.qa) return { scenarios: [], next: 'qa-plan', functionalRounds: 0, escalations: [] };
  const qa = team.qa;
  const results = [...(team.qaHistory || []), qa].flatMap((p) => p.results);
  let validSpec = true;
  try {
    validSpec = approvalFor(team).digest === qa.approvalDigest;
  } catch {
    validSpec = false;
  }
  const scenarios = qa.plan.map((scenario) => {
    const row = qa.rows[scenario.id];
    const current = snapshot(team, scenario, git);
    const valid =
      row &&
      validSpec &&
      !current.dirty &&
      row.fingerprint === current.fingerprint &&
      row.generation === qa.generation;
    return {
      ...scenario,
      status: !row ? 'missing' : valid ? row.status : 'stale',
      evidence: row?.evidence ?? null,
      heads: row?.heads ?? null,
    };
  });
  const functionalRounds = new Set(
    results.filter((r) => r.outcome !== 'inconclusive').map((r) => r.round),
  ).size;
  const rejectedRounds = new Set(
    results.filter((r) => r.outcome === 'rejected').map((r) => r.round),
  ).size;
  const escalations = Object.entries(issuesFor(team))
    .filter(([, issue]) => issue.failedCorrections >= 2 && !issue.resolved)
    .map(([issue]) => ({ issue, to: 'tpl' }));
  if (rejectedRounds >= 3) escalations.push({ issue: null, to: 'owner' });
  const allPassed = scenarios.length > 0 && scenarios.every((r) => r.status === 'passed');
  return {
    scenarios,
    functionalRounds,
    rejectedRounds,
    escalations,
    next:
      allPassed && qa.valid !== false && qa.results.at(-1)?.outcome === 'approved'
        ? 'deliver'
        : 'verify',
    allPassed,
  };
}

export function qaCommand(command, team, options, assignment, git) {
  if (command === 'qa-plan') {
    const approval = approvalFor(team);
    if (Object.values(team.attempts).some((a) => a.role === 'qa' && a.status !== 'settled'))
      throw new Error('Encerre QA antes de alterar seu plano.');
    const input = JSON.parse(document(options.file, '.json').content);
    if (!Array.isArray(input.scenarios) || !input.scenarios.length)
      throw new Error('Plano QA exige cenários.');
    const plan = input.scenarios.map((s) => {
      if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(s.id || '') || suiteIds.includes(s.id))
        throw new Error('ID de cenário inválido.');
      if (
        !Array.isArray(s.paths) ||
        !s.paths.length ||
        s.paths.some(
          (p) =>
            typeof p !== 'string' ||
            !p ||
            p.startsWith('/') ||
            p.includes('..') ||
            p.startsWith(':'),
        )
      )
        throw new Error('Cenário exige caminhos relativos explícitos.');
      return { id: s.id, paths: s.paths, test: nonempty(s.test, 'tipo de teste') };
    });
    if (new Set(plan.map((s) => s.id)).size !== plan.length) throw new Error('Cenário duplicado.');
    plan.push(...suiteIds.map((id) => ({ id, paths: ['.'], test: id })));
    team.qaHistory ??= [];
    if (team.qa) team.qaHistory.push(team.qa);
    team.qa = {
      plan,
      approvalDigest: approval.digest,
      generation: 0,
      rows: {},
      evidenceHistory: [],
      issues: {},
      results: [],
      createdAt: timestamp(),
    };
    return team.qa;
  }
  if (!team.qa) throw new Error('Registre qa-plan antes.');
  const qa = team.qa;
  if (command === 'qa-invalidate') {
    qa.valid = false;
    qa.generation++;
    qa.invalidations ??= [];
    qa.invalidations.push({
      reason: nonempty(options.reason, 'motivo de invalidação'),
      at: timestamp(),
    });
    return { generation: qa.generation };
  }
  if (command === 'qa-correction') {
    const issue = qa.issues[options.issue];
    if (!issue) throw new Error('Problema QA inexistente.');
    issue.corrections.push({
      evidence: nonempty(options.evidence, 'evidência da correção'),
      at: timestamp(),
    });
    return issue;
  }
  if (assignment?.role !== 'qa' || assignment.team !== team.name)
    throw new Error('Exige sessão QA vinculada.');
  if (approvalFor(team).digest !== qa.approvalDigest)
    throw new Error('Plano QA não corresponde à aprovação atual.');
  if (command === 'qa-evidence') {
    const scenario = qa.plan.find((s) => s.id === options.scenario);
    if (!scenario || !['passed', 'failed', 'inconclusive'].includes(options.status))
      throw new Error('Cenário/status QA inválido.');
    const current = snapshot(team, scenario, git);
    if (current.dirty)
      throw new Error('Checkout com alterações não commitadas no escopo do cenário.');
    let issueId = options.issue;
    if (options.status === 'failed') issueId = nonempty(issueId, 'ID estável do problema');
    if (issueId) {
      if (!/^[a-zA-Z0-9_-]+$/.test(issueId)) throw new Error('ID de problema inválido.');
      qa.issues[issueId] ??= {
        scenario: scenario.id,
        corrections: [],
        failedCorrections: 0,
        lastCheckedCorrection: 0,
        resolved: false,
      };
      const issue = qa.issues[issueId];
      if (issue.scenario !== scenario.id) throw new Error('Problema pertence a outro cenário.');
      if (
        options.status !== 'inconclusive' &&
        issue.corrections.length > issue.lastCheckedCorrection
      ) {
        if (options.status === 'failed') issue.failedCorrections++;
        issue.lastCheckedCorrection = issue.corrections.length;
      }
      issue.resolved = options.status === 'passed';
    }
    const row = {
      scenario: scenario.id,
      status: options.status,
      evidence: nonempty(options.evidence, 'evidência QA'),
      ...(issueId ? { issue: issueId } : {}),
      fingerprint: current.fingerprint,
      heads: current.heads,
      generation: qa.generation,
      attemptId: assignment.id,
      round: assignment.round,
      recordedAt: timestamp(),
    };
    if (qa.rows[scenario.id]) qa.evidenceHistory.push(qa.rows[scenario.id]);
    qa.rows[scenario.id] = row;
    qa.valid = false;
    return row;
  }
  if (command === 'qa-result') {
    if (!['approved', 'rejected', 'inconclusive'].includes(options.outcome))
      throw new Error('Veredito QA inválido.');
    const status = qaStatus(team, git);
    if (options.outcome === 'approved' && !status.allPassed)
      throw new Error('Matriz QA incompleta ou inválida.');
    if (options.outcome === 'rejected' && !status.scenarios.some((s) => s.status === 'failed'))
      throw new Error('Reprovação funcional exige defeito confirmado.');
    const result = {
      outcome: options.outcome,
      attemptId: assignment.id,
      round: assignment.round,
      at: timestamp(),
    };
    qa.results.push(result);
    qa.valid = options.outcome === 'approved';
    return result;
  }
  throw new Error('Comando QA desconhecido.');
}

import { readFileSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const timestamp = () => new Date().toISOString();

export function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Falta ${label}.`);
  return value;
}

export function document(path, extension) {
  const file = realpathSync(nonempty(path, 'arquivo'));
  if (!file.endsWith(extension) || file.split('/').some((p) => /^\.env(?:$|[.-])/.test(p)))
    throw new Error(`Arquivo deve ser ${extension}, nunca arquivo de segredo.`);
  return { file, content: readFileSync(file, 'utf8') };
}

const digest = (text) => createHash('sha256').update(text).digest('hex');

export function approve(team, options) {
  if (!['Front', 'Back', 'Par'].includes(options.mode))
    throw new Error('Modo: Front, Back ou Par.');
  const spec = document(options.spec, '.md');
  const approval = {
    mode: options.mode,
    spec: spec.file,
    digest: digest(spec.content),
    evidence: nonempty(options.evidence, 'evidência da aprovação do dono'),
    source: 'coordinator-attestation',
    approvedAt: timestamp(),
  };
  if (
    Object.values(team.attempts).some(
      (a) =>
        ['prepared', 'recorded'].includes(a.status) &&
        (a.role.startsWith('dev-') || a.role === 'qa'),
    )
  )
    throw new Error('Encerre/reconcilie DEVs e QA antes de substituir a aprovação.');
  team.approvalHistory ??= [];
  if (team.approval) team.approvalHistory.push(team.approval);
  team.approval = approval;
  return approval;
}

export function approvalFor(team) {
  const approval = team.approval;
  if (!approval || digest(document(approval.spec, '.md').content) !== approval.digest)
    throw new Error('Aprovação do spec ausente ou desatualizada.');
  return approval;
}

export function ready(team, options, wt, git) {
  if (!['dev', 'qa'].includes(options.stage)) throw new Error('Prontidão exige stage dev ou qa.');
  const { content } = document(options.proof, '.json');
  const proof = JSON.parse(content);
  if (realpathSync(nonempty(proof.worktree, 'worktree da prova')) !== wt.path)
    throw new Error('Prova de prontidão pertence a outro worktree.');
  const head = git(wt.path, 'rev-parse', 'HEAD');
  if (proof.head !== head) throw new Error('Prova de prontidão pertence a outra revisão.');
  const names =
    options.stage === 'dev'
      ? ['install', 'environment']
      : ['install', 'environment', 'api', 'web', 'fixtures', 'browser'];
  const checks = {};
  for (const name of names) {
    const check = proof.checks?.[name];
    if (check?.exitCode !== 0) throw new Error(`Prontidão incompleta: ${name}.`);
    checks[name] = {
      command: nonempty(check.command, `comando de ${name}`),
      exitCode: 0,
      evidence: nonempty(check.evidence, `evidência de ${name}`),
    };
  }
  let browser;
  if (options.stage === 'qa') {
    const b = proof.browser;
    if (
      !Number.isSafeInteger(b?.pid) ||
      b.pid <= 0 ||
      !Array.isArray(b.args) ||
      !b.args.every((x) => typeof x === 'string') ||
      !b.args.includes('--isolated')
    )
      throw new Error('Prova exige PID e argv do processo MCP com --isolated.');
    browser = {
      pid: b.pid,
      args: b.args,
      navigation: nonempty(b.navigation, 'evidência de navegação real'),
    };
  }
  const entry = {
    worktree: wt.path,
    branch: wt.branch,
    head,
    stage: options.stage,
    checks,
    ...(browser ? { browser } : {}),
    source: 'coordinator-attestation',
    checkedAt: timestamp(),
  };
  team.readiness ??= {};
  team.readiness[wt.path] ??= {};
  team.readiness[wt.path][options.stage] = entry;
  return entry;
}

export function gate(team, role, wt, git) {
  if (team.policyVersion !== 2 || (!role.startsWith('dev-') && role !== 'qa')) return {};
  const approval = approvalFor(team);
  if (
    (role === 'dev-front' && approval.mode === 'Back') ||
    (role === 'dev-back' && approval.mode === 'Front')
  )
    throw new Error('Papel incompatível com o modo aprovado.');
  let contract;
  if (role === 'dev-front' && approval.mode === 'Par') {
    contract = team.contract;
    if (!contract || contract.approvalDigest !== approval.digest)
      throw new Error('Contrato do back ainda não registrado para este spec.');
    try {
      git(wt.path, 'merge-base', '--is-ancestor', contract.sha, 'HEAD');
    } catch {
      throw new Error('SHA do contrato não é ancestral do front.');
    }
  }
  const stage = role === 'qa' ? 'qa' : 'dev';
  const proof = team.readiness?.[wt.path]?.[stage];
  if (!proof || proof.branch !== wt.branch || proof.head !== git(wt.path, 'rev-parse', 'HEAD'))
    throw new Error(`Prontidão ${stage} ausente ou desatualizada neste worktree.`);
  return {
    approval: { ...approval },
    readiness: proof,
    ...(contract ? { contract: { ...contract } } : {}),
  };
}

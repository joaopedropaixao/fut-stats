import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  realpathSync,
} from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { approve, approvalFor, ready, gate, nonempty, timestamp } from './lifecycle.mjs';
import { qaCommand, qaStatus } from './qa.mjs';
import { classify, resolvePolicy, routingFor } from './policy.mjs';
import {
  appendEvent,
  readEvents,
  pruneEvents,
  buildReport,
  loadPrices,
  markdownReport,
  usage,
} from './metrics.mjs';
const roles = ['tpl', 'lider-v1', 'dev-back', 'dev-front', 'qa'];
function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.trim() || 'Git indisponível.');
  return r.stdout.trim();
}
function location(cwd) {
  return join(git(cwd, 'rev-parse', '--path-format=absolute', '--git-common-dir'), 'fut-harness');
}
function readState(dir) {
  const file = join(dir, 'state.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { teams: {}, sessions: {} };
}
function transaction(cwd, fn, context) {
  const dir = location(cwd);
  mkdirSync(dir, { recursive: true });
  const lock = join(dir, 'lock');
  try {
    mkdirSync(lock);
  } catch {
    throw new Error(
      'Registro ocupado. Inspecione a operação em andamento; não apague a trava por timeout.',
    );
  }
  try {
    const state = readState(dir);
    const previousTeam =
      state.teams[context?.options.team || state.sessions[context?.options.session]?.team];
    if (state.schemaVersion && state.schemaVersion !== 2)
      throw new Error('Versão de estado não suportada.');
    const result = fn(state, dir);
    state.schemaVersion = 2;
    const temp = join(dir, 'state.tmp');
    writeFileSync(temp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    renameSync(temp, join(dir, 'state.json'));
    if (context) {
      const team =
        state.teams[context.options.team || state.sessions[context.options.session]?.team] ||
        previousTeam;
      const attempt =
        team?.attempts[
          result?.key || context.options.key || state.sessions[context.options.session]?.key
        ];
      appendEvent(dir, context, team, attempt);
    }
    return result;
  } finally {
    rmSync(lock, { recursive: true });
  }
}
function required(o, key) {
  if (!o[key]) throw new Error(`Falta --${key}.`);
  return o[key];
}
function validTeam(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name.length > 40)
    throw new Error('Fatia inválida: slug minúsculo de até 40 caracteres.');
  return name;
}
function checkout(cwd, path, branches) {
  const p = realpathSync(path);
  if (location(p) !== location(cwd)) throw new Error('Worktree pertence a outro repositório.');
  if (realpathSync(git(p, 'rev-parse', '--show-toplevel')) !== p)
    throw new Error('Informe a raiz exata do worktree.');
  const branch = git(p, 'branch', '--show-current');
  if (!branches.includes(branch))
    throw new Error(`Branch inesperada: ${branch}. Não usar sufixo criado por colisão.`);
  return { path: p, branch };
}
function worktrees(cwd) {
  return git(cwd, 'worktree', 'list', '--porcelain')
    .split('\n\n')
    .map((block) => {
      const lines = block.split('\n');
      return {
        path: lines.find((l) => l.startsWith('worktree '))?.slice(9),
        branch: lines.find((l) => l.startsWith('branch '))?.slice(7),
      };
    })
    .filter((w) => w.path);
}
function occupied(cwd, state) {
  const entries = Object.values(state.teams)
    .filter((x) => x.kind === 'team')
    .map((x) => ({ name: x.name, slot: x.slot, path: x.worktree }));
  const trees = worktrees(cwd);
  const board = join(trees[0].path, '.claude/quadro-v1.local.tsv');
  const boardNames = existsSync(board)
    ? readFileSync(board, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => l.split('\t')[0])
        .filter(
          (n) => !['specs-v1', 'plugin-harness'].includes(n) && state.teams[n]?.kind !== 'leader',
        )
    : [];
  for (const wt of trees) {
    if (!wt.branch?.startsWith('refs/heads/feature/')) continue;
    let name = wt.branch.slice('refs/heads/feature/'.length);
    if (name.endsWith('-back') || name.endsWith('-front'))
      name = name.replace(/-(back|front)$/, '');
    const file = join(wt.path, '.env.equipe');
    if (!existsSync(file) && !boardNames.includes(name)) continue;
    let slot = 0;
    if (existsSync(file)) {
      const port = readFileSync(file, 'utf8').match(/^PORT=(\d+)\s*$/m)?.[1];
      slot = { 3000: 0, 3100: 1, 3200: 2 }[port];
      if (slot === undefined)
        throw new Error(`PORT não reconhecido em ${file}; reconciliar antes de reservar.`);
    }
    const same = entries.find((e) => e.name === name);
    if (same) {
      if (same.slot !== slot && existsSync(file)) throw new Error(`Vaga divergente para ${name}.`);
      continue;
    }
    entries.push({ name, slot, path: wt.path });
  }
  for (const name of boardNames)
    if (!entries.some((e) => e.name === name))
      throw new Error(`Fatia ${name} no quadro sem worktree; reconciliar antes de reservar.`);
  if (new Set(entries.map((e) => e.slot)).size !== entries.length)
    throw new Error('Equipes existentes compartilham vaga; reconciliar antes de reservar.');
  return entries;
}
export function sessionAssignment(cwd, id) {
  if (!id) return null;
  const s = readState(location(cwd));
  const binding = s.sessions[id];
  if (!binding) return null;
  const t = s.teams[binding.team],
    a = t?.attempts[binding.key];
  if (
    !a ||
    a.status !== 'recorded' ||
    realpathSync(cwd) !== a.worktree ||
    git(cwd, 'branch', '--show-current') !== a.branch
  )
    return null;
  return { ...a, phase: binding.phase, team: t.name };
}
export function run(command, o, cwd = process.cwd()) {
  if (command === 'report') {
    const dir = location(cwd);
    const state = readState(dir);
    const qaValidity = {};
    for (const team of Object.values(state.teams)) {
      if (!team.qa) continue;
      try {
        qaValidity[team.id] = qaStatus(team, git).next === 'deliver';
      } catch {
        qaValidity[team.id] = false;
      }
    }
    const report = buildReport(
      state,
      { ...o, qaValidity, prices: loadPrices(o.prices) },
      readEvents(dir),
    );
    if (o.format && !['json', 'markdown'].includes(o.format))
      throw new Error('Formato: json ou markdown.');
    return o.format === 'markdown' ? markdownReport(report) : report;
  }
  if (command === 'policy') return resolvePolicy(required(o, 'role'), required(o, 'complexity'));
  if (command === 'status') return readState(location(cwd));
  if (command === 'qa-status') {
    const team = readState(location(cwd)).teams[required(o, 'team')];
    if (!team) throw new Error('Equipe inexistente.');
    return qaStatus(team, git);
  }
  return transaction(
    cwd,
    (state, dir) => {
      if (command === 'telemetry-prune') return pruneEvents(dir, Number(o.days));
      if (command === 'phase') {
        const id = required(o, 'session'),
          binding = state.sessions[id];
        if (!binding || !sessionAssignment(cwd, id))
          throw new Error('Sessão não vinculada neste worktree.');
        if (!['working', 'waiting', 'delivering'].includes(o.phase))
          throw new Error('Fase inválida.');
        binding.phase = o.phase;
        binding.updatedAt = timestamp();
        const attempt = state.teams[binding.team].attempts[binding.key];
        attempt.activity ??= [];
        if (attempt.activity.at(-1)?.phase !== o.phase)
          attempt.activity.push({ phase: o.phase, at: binding.updatedAt });
        return binding;
      }
      const name = validTeam(required(o, 'team'));
      if (command === 'reserve') {
        const agent = required(o, 'agent');
        if (!['claude', 'codex'].includes(agent)) throw new Error('Ferramenta inválida.');
        const wt = checkout(cwd, required(o, 'worktree'), ['feature/' + name]);
        const kind = o.kind || 'team';
        if (!['team', 'leader'].includes(kind)) throw new Error('Tipo inválido.');
        const old = state.teams[name];
        if (old) {
          if (old.worktree !== wt.path || old.agent !== agent || old.kind !== kind)
            throw new Error('Reserva existente tem outro dono; não transferir implicitamente.');
          return old;
        }
        let slot = null;
        if (kind === 'team') {
          const used = occupied(cwd, state);
          if (used.some((e) => e.name === name))
            throw new Error('Equipe legada existente: não assumir a tarefa.');
          if (o.parallel && o.parallel !== 'yes') throw new Error('Use --parallel yes ou omita.');
          const candidates = used.length || o.parallel === 'yes' ? [1, 2] : [0, 1, 2];
          slot = candidates.find((n) => !used.some((e) => e.slot === n));
          if (used.length >= 3 || slot === undefined)
            throw new Error('Sem vaga: limite conjunto de três equipes.');
        }
        const entry = {
          id: randomUUID(),
          createdAt: timestamp(),
          ownerWaits: [],
          ...(agent === 'codex' ? { policyVersion: 2, routingVersion: 1 } : {}),
          name,
          agent,
          kind,
          worktree: wt.path,
          slot,
          apiPort: slot === null ? null : 3000 + 100 * slot,
          webPort: slot === null ? null : 5173 + 100 * slot,
          database:
            slot === null
              ? null
              : slot === 0
                ? 'do .env'
                : `fut_stats_${name.replaceAll('-', '_')}`,
          attempts: {},
        };
        state.teams[name] = entry;
        return entry;
      }
      const t = state.teams[name];
      if (!t) throw new Error('Reserve a equipe primeiro.');
      if (command === 'owner-wait') {
        t.ownerWaits ??= [];
        const last = t.ownerWaits.at(-1);
        if (o.state === 'start') {
          if (!last || last.end) t.ownerWaits.push({ start: timestamp() });
        } else if (o.state === 'end') {
          if (!last || last.end) throw new Error('Sem espera humana aberta.');
          last.end = timestamp();
        } else throw new Error('Espera humana: start ou end.');
        return t.ownerWaits;
      }
      if (command === 'workflow') {
        if (!['RESEARCH', 'PLAN', 'IMPLEMENT', 'VERIFY', 'DELIVERED', 'BLOCKED'].includes(o.phase))
          throw new Error('Fase de workflow inválida.');
        if (['IMPLEMENT', 'VERIFY'].includes(o.phase)) approvalFor(t);
        if (o.phase === 'DELIVERED' && qaStatus(t, git).next !== 'deliver')
          throw new Error('Entrega exige aprovação QA válida.');
        t.workflowHistory ??= [];
        if (t.workflowHistory.at(-1)?.phase !== o.phase)
          t.workflowHistory.push({
            phase: o.phase,
            at: timestamp(),
            ...(o.phase === 'BLOCKED' ? { reason: nonempty(o.reason, 'motivo do bloqueio') } : {}),
          });
        return t.workflowHistory.at(-1);
      }
      if (command === 'classify') return classify(t, o);
      if (command.startsWith('qa-'))
        return qaCommand(command, t, o, sessionAssignment(cwd, o.session), git);
      if (command === 'approve') {
        const result = approve(t, o);
        const wait = t.ownerWaits?.at(-1);
        if (wait && !wait.end) wait.end = timestamp();
        return result;
      }
      if (command === 'ready') {
        const wt = checkout(cwd, required(o, 'worktree'), [
          'feature/' + name,
          'feature/' + name + '-back',
          'feature/' + name + '-front',
        ]);
        return ready(t, o, wt, git);
      }
      if (command === 'contract') {
        const binding = state.sessions[required(o, 'session')];
        const assignment = sessionAssignment(cwd, o.session);
        if (binding?.team !== name || assignment?.role !== 'dev-back')
          throw new Error('Contrato exige sessão back vinculada neste worktree.');
        const approval = approvalFor(t);
        const sha = git(cwd, 'rev-parse', '--verify', `${required(o, 'sha')}^{commit}`);
        git(cwd, 'merge-base', '--is-ancestor', sha, 'HEAD');
        if (
          !git(
            cwd,
            'diff-tree',
            '--root',
            '--no-commit-id',
            '--name-only',
            '-r',
            sha,
            '--',
            'packages/shared',
          )
        )
          throw new Error('Commit do contrato precisa alterar packages/shared.');
        const contract = {
          sha,
          worktree: assignment.worktree,
          key: binding.key,
          session: o.session,
          approvalDigest: approval.digest,
          evidence: nonempty(o.evidence, 'evidência do contrato'),
          recordedAt: timestamp(),
        };
        t.contractHistory ??= [];
        if (t.contract) t.contractHistory.push(t.contract);
        t.contract = contract;
        return contract;
      }
      if (command === 'prepare') {
        const role = required(o, 'role');
        if (!roles.includes(role)) throw new Error('Papel inválido.');
        const routing = routingFor(t, role);
        if ((t.kind === 'leader') !== (role === 'lider-v1'))
          throw new Error('Papel incompatível com o tipo da reserva.');
        if (role === 'qa' && !/^[1-9]\d*$/.test(o.round || ''))
          throw new Error('QA exige --round positivo e único.');
        let key = role === 'qa' ? `qa-${o.round}` : role;
        let previous;
        if (o.after) {
          previous = t.attempts[o.after];
          if (!previous || previous.status !== 'settled')
            throw new Error('Antecessor deve estar encerrado (settled).');
          if (previous.role !== role || previous.worktree !== realpathSync(required(o, 'worktree')))
            throw new Error('Follow-up deve preservar papel e worktree.');
          if (role === 'qa' && previous.round !== o.round)
            throw new Error('Recuperação QA preserva a rodada.');
          nonempty(o.reason, 'motivo do follow-up');
          if (Object.values(t.attempts).some((a) => a.previousKey === o.after))
            throw new Error('Antecessor já tem tentativa sucessora; reconcilie o follow-up.');
          key = `${o.after}-next`;
        }
        if (t.attempts[key])
          throw new Error(
            'Tentativa já preparada. Inspecione o recibo e o Orca; não relançar após resultado ambíguo.',
          );
        if (
          t.policyVersion === 2 &&
          Object.values(t.attempts).some(
            (a) => a.role === role && ['prepared', 'recorded'].includes(a.status),
          )
        )
          throw new Error('Papel já tem tentativa ativa; reconcilie antes de preparar outra.');
        const branches = ['feature/' + name];
        if (role.startsWith('dev-')) branches.push('feature/' + name + '-' + role.slice(4));
        const wt = checkout(cwd, required(o, 'worktree'), branches);
        if (t.policyVersion === 2 && role === 'qa') {
          const devs = Object.values(t.attempts).filter((a) => a.role.startsWith('dev-'));
          if (devs.some((a) => a.status !== 'settled'))
            throw new Error('QA exige DEVs encerrados e reconciliados.');
          for (const dev of devs) {
            const target = checkout(cwd, dev.worktree, [dev.branch]);
            gate(t, 'qa', target, git);
          }
        }
        const gates = gate(t, role, wt, git);
        const briefPath = realpathSync(required(o, 'spec'));
        if (
          !briefPath.endsWith('.md') ||
          briefPath.split('/').some((p) => /^\.env(?:$|[.-])/.test(p))
        ) {
          throw new Error('Brief precisa ser Markdown, nunca arquivo de segredo.');
        }
        const brief = readFileSync(briefPath, 'utf8');
        const specFile = join(dir, `${name}-${key}.md`);
        const source =
          role === 'tpl' || role === 'lider-v1'
            ? `${t.agent === 'codex' ? '.agents' : '.claude'}/skills/${role}/SKILL.md`
            : `.harness/roles/${role}.md`;
        const text = `# Kickoff ${role}: ${name}\n\nFerramenta: ${t.agent}\nPapel: ${role}\nChave: ${key}\nEquipe: ${name}\nWorktree: ${wt.path}\nBranch: ${wt.branch}\nVaga: ${t.slot ?? 'não usa banco'}\nAPI: ${t.apiPort}\nWeb: ${t.webPort}\nBanco: ${t.database}\n${gates.approval ? `Aprovação: ${gates.approval.spec} (sha256 ${gates.approval.digest})\n` : ''}${gates.contract ? `Contrato: ${gates.contract.sha}\n` : ''}\nLeia AGENTS.md e ${source}.\n${t.agent === 'codex' ? 'Leia .harness/codex-workers.md antes de agir. Vincule a sessão com team.mjs bind; depois siga o papel.' : 'Use apenas Claude pessoal e as skills .claude/skills; o corpo de papel é compartilhado.'}\nNão assuma outra tarefa nem troque de ferramenta automaticamente.\n\n${brief}\n`;
        writeFileSync(
          specFile,
          `${routing ? `Complexidade: ${routing.complexity ?? 'legada'}\nModelo solicitado: ${routing.model}/${routing.effort} (política ${routing.policyVersion})\n\n` : ''}${text}`,
          { mode: 0o600 },
        );
        const argv =
          t.agent === 'codex'
            ? [
                'orca',
                'orchestration',
                'worker-start',
                '--spec-file',
                specFile,
                '--task-title',
                `${role} ${name}`,
                '--worktree',
                `path:${wt.path}`,
                '--agent',
                'codex',
                '--model',
                routing.model,
                '--effort',
                routing.effort,
                ...(role === 'tpl' || role === 'lider-v1' ? ['--keep-open'] : []),
                '--json',
              ]
            : null;
        t.attempts[key] = {
          id: randomUUID(),
          createdAt: timestamp(),
          ...(routing ? { routing } : {}),
          workflowPhase:
            t.workflowHistory?.at(-1)?.phase ??
            (role === 'qa' ? 'VERIFY' : role.startsWith('dev-') ? 'IMPLEMENT' : 'RESEARCH'),
          ...(previous ? { previousKey: o.after, reason: o.reason } : {}),
          ...(role === 'qa' ? { round: o.round } : {}),
          ...gates,
          key,
          role,
          worktree: wt.path,
          branch: wt.branch,
          status: 'prepared',
          specFile,
          argv,
        };
        return { ...t.attempts[key], requiresPersonalTerminal: t.agent === 'claude' };
      }
      if (command === 'release') {
        if (Object.values(t.attempts).some((a) => a.status !== 'settled'))
          throw new Error(
            'Há tentativas preparadas ou workers não encerrados. Reconcilie antes de liberar.',
          );
        nonempty(o.evidence, 'evidência de liberação');
        if (t.qa) {
          try {
            t.qa.valid = qaStatus(t, git).next === 'deliver';
          } catch {
            t.qa.valid = false;
          }
          t.qa.validatedAtRelease = timestamp();
        }
        state.archives ??= [];
        state.archives.push({
          team: t,
          sessions: Object.fromEntries(
            Object.entries(state.sessions).filter(([, b]) => b.team === name),
          ),
          releasedAt: timestamp(),
          evidence: o.evidence,
        });
        delete state.teams[name];
        for (const [id, b] of Object.entries(state.sessions))
          if (b.team === name) delete state.sessions[id];
        return { released: name };
      }
      const key = required(o, 'key'),
        a = t.attempts[key];
      if (!a) throw new Error('Tentativa inexistente.');
      if (command === 'usage') return usage(a, required(o, 'file'));
      if (command === 'cancel-prepared') {
        if (a.status !== 'prepared')
          throw new Error('Worker com recibo não pode ser cancelado como não lançado.');
        const evidence = required(o, 'evidence');
        t.history ??= [];
        t.history.push({
          ...a,
          status: 'cancelled-before-launch',
          evidence,
          cancelledAt: timestamp(),
        });
        delete t.attempts[key];
        return { cancelled: key, evidence };
      }
      if (command === 'record') {
        const receipt = {
          dispatch: required(o, 'dispatch'),
          task: required(o, 'task'),
          run: required(o, 'run'),
        };
        if (a.status !== 'prepared' && JSON.stringify(a.receipt) !== JSON.stringify(receipt))
          throw new Error('Recibo divergente; não substituir outro worker.');
        if (a.status === 'settled') throw new Error('Worker já encerrado.');
        const allAttempts = [
          ...Object.values(state.teams),
          ...(state.archives || []).map((x) => x.team),
        ].flatMap((x) => [...Object.values(x.attempts), ...(x.history || [])]);
        if (
          allAttempts.some((other) => other !== a && other.receipt?.dispatch === receipt.dispatch)
        )
          throw new Error('Dispatch do recibo já pertence a outra tentativa.');
        a.receipt = receipt;
        a.status = 'recorded';
        a.recordedAt ??= timestamp();
        return a;
      }
      if (command === 'bind') {
        if (a.status !== 'recorded')
          throw new Error(
            'Coordenador ainda não registrou recibo. Aguarde via ask, sem implementar.',
          );
        const id = required(o, 'session');
        if (t.agent !== 'codex') throw new Error('Vínculo de hook é específico do Codex.');
        if (realpathSync(cwd) !== a.worktree)
          throw new Error('Vincule de dentro do worktree atribuído.');
        checkout(cwd, a.worktree, [a.branch]);
        gate(t, a.role, { path: a.worktree, branch: a.branch }, git);
        const old = state.sessions[id];
        const recovering =
          old?.team === name &&
          a.previousKey === old.key &&
          t.attempts[old.key]?.status === 'settled';
        if (old && (old.team !== name || old.key !== key) && !recovering)
          throw new Error('Sessão já pertence a outra atribuição.');
        if (
          Object.entries(state.sessions).some(
            ([other, b]) => other !== id && b.team === name && b.key === key,
          )
        )
          throw new Error('Atribuição já vinculada a outra sessão.');
        const history = old?.history || [];
        if (recovering) {
          const { history: ignored, ...prior } = old;
          history.push(prior);
        }
        state.sessions[id] = {
          team: name,
          key,
          phase: recovering ? 'working' : old?.phase || 'working',
          boundAt: recovering ? timestamp() : old?.boundAt || timestamp(),
          history,
        };
        a.activity ??= [];
        if (!a.activity.length) a.activity.push({ phase: 'working', at: timestamp() });
        return state.sessions[id];
      }
      if (command === 'settle') {
        required(o, 'evidence');
        if (a.status !== 'recorded')
          throw new Error('Tentativa sem recibo: reconciliar antes de encerrar.');
        a.status = 'settled';
        a.evidence = o.evidence;
        a.settledAt = timestamp();
        return a;
      }
      throw new Error('Comando desconhecido.');
    },
    { command, options: o },
  );
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [command, ...args] = process.argv.slice(2),
      o = {};
    for (let i = 0; i < args.length; i += 2) {
      if (!args[i].startsWith('--') || !args[i + 1] || args[i + 1].startsWith('--'))
        throw new Error('Use pares --opção valor.');
      o[args[i].slice(2)] = args[i + 1];
    }
    const result = run(command, o);
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}

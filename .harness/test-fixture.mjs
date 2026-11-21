import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { run } from './team.mjs';

export function fixture(t, mode = 'Back', classified = true) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'lifecycle ')));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'test@example.invalid',
    GIT_COMMITTER_EMAIL: 'test@example.invalid',
  };
  const git = (cwd, ...args) =>
    execFileSync('git', args, {
      cwd,
      env,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  git(root, 'init', '-b', 'develop');
  git(root, 'commit', '--allow-empty', '-m', 'base');
  const wt = (name) => {
    const p = join(root, name);
    git(root, 'worktree', 'add', '-b', `feature/${name}`, p);
    return p;
  };
  const main = wt('demo');
  const spec = join(root, 'spec.md');
  writeFileSync(spec, '# Contrato aprovado\n');
  const call = (command, args = {}, cwd = main) => run(command, { team: 'demo', ...args }, cwd);
  call('reserve', { agent: 'codex', worktree: main });
  if (classified) call('classify', { complexity: 'ROTINEIRA', reason: 'fixture isolada' });
  const approve = () => call('approve', { mode, spec, evidence: 'mensagem do dono: aprovado' });
  const ready = (path = main, stage = 'dev', alter = (p) => p) => {
    const checks = Object.fromEntries(
      (stage === 'dev'
        ? ['install', 'environment']
        : ['install', 'environment', 'api', 'web', 'fixtures', 'browser']
      ).map((name) => [
        name,
        { command: `verificar ${name}`, exitCode: 0, evidence: `log-${name}` },
      ]),
    );
    const proof = join(root, 'proof.json');
    writeFileSync(
      proof,
      JSON.stringify(
        alter({
          worktree: path,
          head: git(path, 'rev-parse', 'HEAD'),
          checks,
          ...(stage === 'qa'
            ? {
                browser: {
                  pid: 123,
                  args: ['@playwright/mcp', '--isolated'],
                  navigation: 'log navegação real',
                },
              }
            : {}),
        }),
      ),
    );
    return call('ready', { worktree: path, stage, proof });
  };
  const prepare = (role, path = main, args = {}) =>
    call('prepare', { role, worktree: path, spec, ...args });
  const record = (key, id = key) =>
    call('record', { key, dispatch: `dispatch-${id}`, task: `task-${id}`, run: 'run-demo' });
  const bind = (key, session, path = main) => call('bind', { key, session }, path);
  return { root, main, spec, git, wt, call, approve, ready, prepare, record, bind };
}

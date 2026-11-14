import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
let directory;

function git(...args) {
  const result = spawnSync('git', args, { cwd: directory, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

before(() => {
  directory = mkdtempSync(join(tmpdir(), 'fut-codex hooks-'));
  git('init', '--initial-branch=develop');
  writeFileSync(join(directory, 'README.md'), 'fixture\n');
  git('add', 'README.md');
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-m',
    'fixture',
  );
  symlinkSync(join(root, '.codex'), join(directory, '.codex'));
});

after(() => rmSync(directory, { recursive: true, force: true }));

function hook(event, toolName, toolInput = {}, extra = {}) {
  const configPath = join(root, '.codex/hooks.json');
  assert.ok(existsSync(configPath), 'a configuração nativa dos hooks ainda não existe');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  const groups = config.hooks[event];
  assert.ok(groups?.length, 'o evento precisa estar configurado');
  const payload = {
    session_id: 'fixture',
    hook_event_name: event,
    cwd: directory,
    tool_name: toolName,
    tool_input: toolInput,
    ...extra,
  };
  const matching = groups.filter(
    (group) => !group.matcher || new RegExp(group.matcher).test(toolName),
  );
  assert.ok(matching.length, 'o matcher precisa cobrir a ferramenta');
  const handlers = matching.flatMap((group) => group.hooks);
  assert.equal(handlers.length, 1, 'um adaptador por evento evita saídas JSON concorrentes');
  return spawnSync('sh', ['-c', handlers[0].command], {
    cwd: directory,
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
}

function denied(result, message) {
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stderr, message);
}

function patch(body) {
  return hook('PreToolUse', 'apply_patch', {
    command: '*** Begin Patch\n' + body + '\n*** End Patch',
  });
}

test('bloqueia leitura de segredo por shell e por ferramenta de arquivo', () => {
  denied(hook('PreToolUse', 'Bash', { command: 'cat .env' }), /nunca abrir/);
  denied(hook('PreToolUse', 'mcp__fs__read_file', { path: '.env.local' }), /nunca abrir/);
});

test('permite comandos e arquivos sem segredo', () => {
  assert.equal(hook('PreToolUse', 'Bash', { command: 'git status --short' }).status, 0);
  assert.equal(hook('PreToolUse', 'mcp__fs__read_file', { path: '.env.example' }).status, 0);
  assert.equal(patch('*** Add File: example.ts\n+export const value = 1;').status, 0);
});

test('bloqueia segredo em qualquer arquivo ou destino de um patch', () => {
  denied(
    patch('*** Add File: safe.ts\n+ok\n*** Update File: .env.local\n@@\n-old\n+new'),
    /nunca abrir/,
  );
  denied(patch('*** Update File: safe.ts\n*** Move to: .env\n@@\n-old\n+new'), /nunca abrir/);
});

test('o front não altera o contrato por patch, inclusive em renomeação', () => {
  git('checkout', '-b', 'feature/native-front');
  denied(patch('*** Add File: packages/shared/schema.ts\n+export {};'), /Front não edita/);
  denied(
    patch('*** Update File: file.ts\n*** Move to: packages/shared/schema.ts\n@@\n-a\n+b'),
    /Front não edita/,
  );
  git('checkout', 'develop');
});

test('o front pode ler o contrato, mas ferramentas de escrita continuam bloqueadas', () => {
  git('checkout', 'feature/native-front');
  try {
    assert.equal(
      hook('PreToolUse', 'mcp__fs__read_file', {
        path: 'packages/shared/schema.ts',
      }).status,
      0,
    );
    denied(
      hook('PreToolUse', 'mcp__fs__write_file', {
        path: 'packages/shared/schema.ts',
      }),
      /Front não edita/,
    );
  } finally {
    git('checkout', 'develop');
  }
});

test('o comando considera o workdir solicitado pela ferramenta', () => {
  const worker = join(directory, 'shell-worker');
  git('worktree', 'add', '-b', 'feature/native-shell', worker);
  assert.equal(
    hook('PreToolUse', 'Bash', {
      command: 'git push',
      workdir: worker,
    }).status,
    0,
  );
  denied(
    hook(
      'PreToolUse',
      'Bash',
      {
        command: 'git push',
        workdir: directory,
      },
      { cwd: worker },
    ),
    /Bloqueado/,
  );
});

test('payload de shell sem comando é recusado', () => {
  denied(hook('PreToolUse', 'Bash'), /comando/i);
});

test('git -C relativo é avaliado no diretório efetivo do comando', () => {
  denied(hook('PreToolUse', 'Bash', { command: 'git -C . push' }), /Bloqueado/);
  const worker = join(directory, 'shell-worker');
  denied(
    hook(
      'PreToolUse',
      'Bash',
      {
        command: 'git -C . push',
        workdir: directory,
      },
      { cwd: worker },
    ),
    /Bloqueado/,
  );
});

test('preserva os bloqueios de merge, push e atribuição de IA', () => {
  denied(hook('PreToolUse', 'Bash', { command: 'git push' }), /Bloqueado/);
  denied(hook('PreToolUse', 'Bash', { command: 'git push origin HEAD:main' }), /Bloqueado/);
  denied(hook('PreToolUse', 'Bash', { command: 'git commit -m "Co-Authored-By: IA"' }), /trailer/);
});

test('formata um arquivo real depois de um patch permitido', () => {
  const file = join(directory, 'example.ts');
  writeFileSync(file, 'export const value={a:1}\n');
  const result = hook('PostToolUse', 'apply_patch', {
    command: '*** Begin Patch\n*** Add File: example.ts\n+export const value={a:1}\n*** End Patch',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(file, 'utf8'), /value = \{ a: 1 \};/);
});

test('o fim do turno preserva a decisão de push pendente sem executar push', () => {
  const worktree = join(directory, 'worker');
  git('branch', 'origin/develop');
  git('worktree', 'add', '-b', 'feature/native-worker', worktree);
  writeFileSync(join(worktree, 'change.txt'), 'pending\n');
  const commit = spawnSync('git', ['-C', worktree, 'add', 'change.txt'], { encoding: 'utf8' });
  assert.equal(commit.status, 0);
  const result = spawnSync(
    'git',
    [
      '-C',
      worktree,
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'pending',
    ],
    { encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  const stop = hook('Stop', '', {}, { cwd: worktree });
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(JSON.parse(stop.stdout).decision, 'block');
  assert.equal(hook('Stop', '', {}, { cwd: worktree, stop_hook_active: true }).status, 0);
  assert.equal(
    git('-C', worktree, 'rev-parse', '--abbrev-ref', 'HEAD').trim(),
    'feature/native-worker',
  );
});

test('DEV simples não recebe cobrança de push do TPL e mantém proteção do contrato', async () => {
  const { run } = await import('../../.harness/team.mjs');
  const worktree = join(directory, 'worker');
  const input = join(directory, 'worker-brief.md');
  writeFileSync(input, 'Fixture de papel.');
  run('reserve', { team: 'native-worker', agent: 'codex', worktree }, directory);
  run('prepare', { team: 'native-worker', role: 'dev-front', worktree, spec: input }, directory);
  run(
    'record',
    { team: 'native-worker', key: 'dev-front', dispatch: 'd', task: 't', run: 'r' },
    directory,
  );
  run('bind', { team: 'native-worker', key: 'dev-front', session: 'dev-only' }, worktree);
  const stop = hook('Stop', '', {}, { cwd: worktree, session_id: 'dev-only' });
  assert.equal(stop.status, 0, stop.stderr);
  assert.equal(stop.stdout, '');
  const other = hook('Stop', '', {}, { cwd: worktree, session_id: 'tpl-only' });
  assert.equal(JSON.parse(other.stdout).decision, 'block');
  denied(
    hook(
      'PreToolUse',
      'apply_patch',
      { command: '*** Begin Patch\n*** Add File: packages/shared/no.ts\n+x\n*** End Patch' },
      { cwd: worktree, session_id: 'dev-only' },
    ),
    /Front não edita/,
  );
});

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const mode = process.argv[2];

function runHook(name, payload) {
  const result = spawnSync('sh', [join(root, '.claude/hooks', name + '.sh')], {
    cwd: payload.cwd,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: 'utf8',
    input: JSON.stringify(payload),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 2);
}

function fileEvents(payload) {
  const input = payload.tool_input ?? {};
  let paths;
  if (payload.tool_name === 'apply_patch') {
    if (typeof input.command !== 'string') throw new Error('Patch sem comando.');
    paths = [
      ...input.command.matchAll(/^\*\*\* (?:(?:Add|Update|Delete) File: |Move to: )(.+)\r?$/gm),
    ].map((match) => match[1].replace(/\r$/, ''));
    if (!paths.length) throw new Error('Patch sem caminhos de arquivo.');
  } else {
    paths = [input.file_path, input.path, input.notebook_path].filter(
      (path) => typeof path === 'string',
    );
  }
  return [...new Set(paths)].map((path) => ({
    ...payload,
    tool_name:
      payload.tool_name === 'apply_patch' ||
      /write|edit|delete|move|rename/i.test(payload.tool_name)
        ? 'Edit'
        : 'Read',
    tool_input: { file_path: isAbsolute(path) ? path : resolve(payload.cwd, path) },
  }));
}

function main(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Entrada do hook precisa ser um objeto JSON.');
  }
  const cwd = payload.cwd || root;
  payload = { ...payload, cwd: resolve(cwd, payload.tool_input?.workdir || cwd) };
  if (mode === 'pre') {
    if (payload.tool_name === 'Bash') {
      if (typeof payload.tool_input?.command !== 'string') {
        throw new Error('Ferramenta de shell sem comando.');
      }
      for (const hook of ['sem-env', 'sem-merge', 'commit-sem-ia']) runHook(hook, payload);
    } else {
      for (const event of fileEvents(payload)) {
        runHook('sem-env', event);
        runHook('front-sem-shared', event);
      }
    }
  } else if (mode === 'post') {
    if (payload.tool_name === 'apply_patch') {
      for (const event of fileEvents(payload)) runHook('prettier', event);
    }
  } else if (mode === 'start') {
    runHook('atraso-ao-iniciar', payload);
  } else if (mode === 'stop') {
    runHook('sem-push-pendente', payload);
  } else {
    throw new Error('Evento do adaptador desconhecido.');
  }
}

try {
  main(JSON.parse(readFileSync(0, 'utf8')));
} catch (error) {
  process.stderr.write('Hook do Fut Stats: ' + error.message + '\n');
  process.exit(2);
}

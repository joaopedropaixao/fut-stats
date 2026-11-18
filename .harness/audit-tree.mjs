import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, lstatSync, readlinkSync, realpathSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const [mode, path, baseline, team] = process.argv.slice(2);
try {
  if (
    !['capture', 'check'].includes(mode) ||
    !path ||
    !baseline ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(team || '')
  )
    throw new Error(
      'Uso: audit-tree.mjs capture|check <worktree> <baseline fora do worktree> <fatia>',
    );
  const root = realpathSync(path),
    dest = resolve(baseline);
  if (!relative(root, dest).startsWith('..'))
    throw new Error('Guarde baseline fora do worktree auditado.');
  function git(...args) {
    const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout;
  }
  if (realpathSync(git('rev-parse', '--show-toplevel').trim()) !== root)
    throw new Error('Informe a raiz do worktree.');
  const paths = [
    ...new Set(
      git('ls-files', '-z', '--cached', '--others', '--exclude-standard')
        .split('\0')
        .filter(Boolean),
    ),
  ].sort();
  const files = {};
  for (const p of paths) {
    if (p.startsWith(`docs/design/prints/${team}/`) || p.startsWith('.playwright-mcp/')) continue;
    if (
      p
        .split('/')
        .some((x) => /^\.env(?:$|[.-])/.test(x) && !['.env.example', '.env.equipe'].includes(x))
    )
      throw new Error('Arquivo de segredo versionado: auditoria interrompida sem ler conteúdo.');
    try {
      const stat = lstatSync(join(root, p));
      const data = stat.isSymbolicLink()
        ? readlinkSync(join(root, p))
        : readFileSync(join(root, p));
      files[p] = `${stat.mode}:${createHash('sha256').update(data).digest('hex')}`;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      files[p] = 'deleted';
    }
  }
  const snapshot = { root, head: git('rev-parse', 'HEAD').trim(), files };
  if (mode === 'capture') {
    writeFileSync(dest, JSON.stringify(snapshot), { mode: 0o600 });
    console.log('Baseline do QA registrada.');
  } else {
    const before = JSON.parse(readFileSync(dest, 'utf8'));
    if (before.root !== root) throw new Error('Baseline de outro worktree.');
    const changed = [...new Set([...Object.keys(before.files), ...Object.keys(files)])].filter(
      (p) => before.files[p] !== files[p],
    );
    if (before.head !== snapshot.head) changed.unshift('HEAD');
    console.log(JSON.stringify({ changed }));
    if (changed.length) process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}

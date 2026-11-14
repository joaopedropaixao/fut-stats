// Falha o build se o dist trouxer o React de desenvolvimento (jsxDEV). Roda depois do `vite build`.
// Já aconteceu: o NODE_ENV=development do arquivo de ambiente da raiz vazou para o build e o bundle saiu
// maior e mais lento.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dist = join(import.meta.dirname, '..', 'dist');

function jsFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(path);
    return entry.name.endsWith('.js') ? [path] : [];
  });
}

const offenders = jsFiles(dist)
  .map((file) => ({ file, count: readFileSync(file, 'utf8').split('jsxDEV').length - 1 }))
  .filter(({ count }) => count > 0);

if (offenders.length > 0) {
  console.error(
    'O dist tem o React de desenvolvimento (jsxDEV). O build deve sair com NODE_ENV=production:',
  );
  for (const { file, count } of offenders) {
    console.error(`  ${file.replace(dist, 'dist')}: ${count} ocorrências`);
  }
  process.exit(1);
}
console.log('dist sem jsxDEV: o build saiu com o React de produção.');

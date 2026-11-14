// Confere o dist depois do `vite build` e falha o build se algo estiver errado:
// 1. React de desenvolvimento (jsxDEV). Já aconteceu: o NODE_ENV=development do arquivo de ambiente da raiz
//    vazou para o build e o bundle saiu maior e mais lento.
// 2. Telas de dev (/dev/entrar, /dev/componentes) dentro do build de produção.
// 3. Orçamento do bundle (apps/web/bundle-budget.json): JS inicial, pedaço de rota, CSS e JS total.
import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';
import {
  checkBudget,
  formatFailures,
  formatMarkdown,
  formatTable,
  initialFiles,
} from './bundle-budget.mjs';

const root = join(import.meta.dirname, '..');
const dist = join(root, 'dist');

function filesWith(dir, extension) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return filesWith(path, extension);
    return entry.name.endsWith(extension) ? [path] : [];
  });
}

const jsFiles = (dir) => filesWith(dir, '.js');

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

// Telas de dev ficam fora do build: nem o arquivo delas nem o caminho delas podem aparecer no dist
const manifest = JSON.parse(readFileSync(join(dist, '.vite', 'manifest.json'), 'utf8'));
const devLeaks = [
  ...Object.keys(manifest).filter((key) => key.includes('pages/dev/')),
  ...jsFiles(dist)
    .filter((file) => /\/dev\/(entrar|componentes)/.test(readFileSync(file, 'utf8')))
    .map((file) => relative(dist, file)),
];
if (devLeaks.length > 0) {
  console.error('O dist tem as telas de dev (/dev/entrar, /dev/componentes):');
  for (const leak of devLeaks) console.error(`  ${leak}`);
  process.exit(1);
}
console.log('dist sem as telas de dev.');

// Orçamento. O service worker, o runtime do Workbox e o registerSW não são código de tela: ficam fora da conta.
const isApp = (file) => !/^(sw|registerSW|workbox-[^/]*)\.js$/.test(relative(dist, file));
const sized = [...jsFiles(dist), ...filesWith(dist, '.css')]
  .filter(isApp)
  .map((file) => ({ path: relative(dist, file), bytes: gzipSync(readFileSync(file)).length }));
const budget = JSON.parse(readFileSync(join(root, 'bundle-budget.json'), 'utf8'));
const report = checkBudget(sized, initialFiles(manifest), budget);

console.log(`\n${formatTable(report)}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, formatMarkdown(report));
}
if (!report.ok) {
  console.error('O bundle passou do orçamento (apps/web/bundle-budget.json):');
  for (const failure of formatFailures(report)) console.error(`  ${failure}`);
  process.exit(1);
}

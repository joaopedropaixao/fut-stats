import { describe, expect, it } from 'vitest';
// @ts-expect-error o módulo é .mjs puro (roda no Node, sem tipos); as funções são exercitadas pelos testes
import * as budgetModule from './bundle-budget.mjs';

type Budget = { initialJs: number; routeChunk: number; css: number; totalJs: number };
type FileSize = { path: string; bytes: number };
type Measure = {
  id: string;
  label: string;
  value: number;
  limit: number;
  ok: boolean;
  detail?: string;
};
type Report = { ok: boolean; measures: Measure[] };
type Manifest = Record<
  string,
  {
    file: string;
    isEntry?: boolean;
    imports?: string[];
    dynamicImports?: string[];
    css?: string[];
  }
>;

const { checkBudget, initialFiles, formatTable, formatMarkdown, formatFailures } = budgetModule as {
  checkBudget: (files: FileSize[], initial: string[], budget: Budget) => Report;
  initialFiles: (manifest: Manifest) => string[];
  formatTable: (report: Report) => string;
  formatMarkdown: (report: Report) => string;
  formatFailures: (report: Report) => string[];
};

const BUDGET: Budget = { initialJs: 150, routeChunk: 40, css: 25, totalJs: 400 };
const kb = (n: number) => Math.round(n * 1000);

const FILES: FileSize[] = [
  { path: 'assets/index-a.js', bytes: kb(100) },
  { path: 'assets/vendor-b.js', bytes: kb(30) },
  { path: 'assets/rodadas-c.js', bytes: kb(20) },
  { path: 'assets/times-d.js', bytes: kb(35) },
  { path: 'assets/index-e.css', bytes: kb(12) },
];
const INITIAL = ['assets/index-a.js', 'assets/vendor-b.js'];

describe('checkBudget', () => {
  it('C1: lista cada medida com valor, limite e se passou', () => {
    const report = checkBudget(FILES, INITIAL, BUDGET);
    expect(report.ok).toBe(true);
    expect(report.measures.map(({ id, value, limit, ok }) => ({ id, value, limit, ok }))).toEqual([
      { id: 'initialJs', value: 130, limit: 150, ok: true },
      { id: 'routeChunk', value: 35, limit: 40, ok: true },
      { id: 'css', value: 12, limit: 25, ok: true },
      { id: 'totalJs', value: 185, limit: 400, ok: true },
    ]);
  });

  it('C1: estourou qualquer medida: ok false e só ela falha', () => {
    const report = checkBudget(FILES, INITIAL, { ...BUDGET, initialJs: 1 });
    expect(report.ok).toBe(false);
    expect(report.measures.filter((m) => !m.ok).map((m) => m.id)).toEqual(['initialJs']);
  });

  it('C1: o limite é inclusivo (igual ao limite passa)', () => {
    const report = checkBudget(FILES, INITIAL, { ...BUDGET, initialJs: 130 });
    expect(report.measures[0]).toMatchObject({ id: 'initialJs', ok: true });
  });

  it('C1: pedaço de rota olha cada arquivo, não a soma, e aponta o maior', () => {
    const report = checkBudget(FILES, INITIAL, { ...BUDGET, routeChunk: 30 });
    const route = report.measures.find((m) => m.id === 'routeChunk')!;
    expect(route).toMatchObject({ value: 35, limit: 30, ok: false });
    expect(route.detail).toContain('assets/times-d.js');
  });

  it('C1: sem pedaço sob demanda, a medida de pedaço é 0', () => {
    const report = checkBudget(FILES.slice(0, 2), INITIAL, BUDGET);
    expect(report.measures.find((m) => m.id === 'routeChunk')).toMatchObject({
      value: 0,
      ok: true,
    });
  });

  it('C1: o CSS soma todos os arquivos .css', () => {
    const files = [...FILES, { path: 'assets/outro.css', bytes: kb(15) }];
    const report = checkBudget(files, INITIAL, BUDGET);
    expect(report.measures.find((m) => m.id === 'css')).toMatchObject({ value: 27, ok: false });
    expect(report.ok).toBe(false);
  });

  it('C1: o JS total soma todos os .js e ignora o que não é js nem css', () => {
    const files = [...FILES, { path: 'assets/fonte.woff2', bytes: kb(500) }];
    const report = checkBudget(files, INITIAL, BUDGET);
    expect(report.measures.find((m) => m.id === 'totalJs')).toMatchObject({ value: 185, ok: true });
  });
});

describe('initialFiles', () => {
  const manifest: Manifest = {
    'index.html': {
      file: 'assets/index-a.js',
      isEntry: true,
      imports: ['_vendor.js'],
      dynamicImports: ['src/pages/rounds/x.tsx'],
      css: ['assets/index-e.css'],
    },
    '_vendor.js': { file: 'assets/vendor-b.js', imports: ['_base.js'] },
    '_base.js': { file: 'assets/base-f.js' },
    'src/pages/rounds/x.tsx': {
      file: 'assets/rodadas-c.js',
      imports: ['_vendor.js', '_so-rodadas.js'],
    },
    '_so-rodadas.js': { file: 'assets/so-rodadas-g.js' },
  };

  it('C2: devolve a entrada e os imports estáticos (recursivo), sem os dinâmicos', () => {
    expect(initialFiles(manifest).sort()).toEqual([
      'assets/base-f.js',
      'assets/index-a.js',
      'assets/vendor-b.js',
    ]);
  });

  it('C2: um import estático repetido entra uma vez só e ciclo não trava', () => {
    const cyclic: Manifest = {
      'index.html': { file: 'a.js', isEntry: true, imports: ['_b.js', '_c.js'] },
      '_b.js': { file: 'b.js', imports: ['_c.js'] },
      '_c.js': { file: 'c.js', imports: ['_b.js'] },
    };
    expect(initialFiles(cyclic).sort()).toEqual(['a.js', 'b.js', 'c.js']);
  });

  it('C2: só entradas (isEntry) contam como ponto de partida', () => {
    const m: Manifest = {
      'index.html': { file: 'a.js', isEntry: true },
      'src/x.tsx': { file: 'x.js', dynamicImports: [] },
    };
    expect(initialFiles(m)).toEqual(['a.js']);
  });
});

describe('formatação', () => {
  const failing = checkBudget(FILES, INITIAL, { ...BUDGET, initialJs: 100 });

  it('C3: a tabela traz medida, tamanho, limite e ✓ ou ✕', () => {
    const table = formatTable(checkBudget(FILES, INITIAL, BUDGET));
    expect(table).toContain('JS inicial');
    expect(table).toContain('130.0 kB');
    expect(table).toContain('150 kB');
    expect(table).toContain('✓');
    expect(table).not.toContain('✕');
    expect(formatTable(failing)).toContain('✕');
  });

  it('C4: diz qual medida estourou e por quanto', () => {
    expect(formatFailures(failing)).toEqual([
      'JS inicial: 130.0 kB, limite 100 kB (estourou por 30.0 kB)',
    ]);
    expect(formatFailures(checkBudget(FILES, INITIAL, BUDGET))).toEqual([]);
  });

  it('C5: o resumo do job sai em Markdown, com a mesma tabela', () => {
    const md = formatMarkdown(failing);
    const lines = md.trim().split('\n');
    expect(lines[0]).toMatch(/^###? /);
    expect(md).toContain('| Medida | Tamanho (gzip) | Limite | |');
    expect(md).toContain('| JS inicial | 130.0 kB | 100 kB | ✕ |');
    expect(md).toContain('| CSS | 12.0 kB | 25 kB | ✓ |');
  });
});

// Orçamento do bundle: funções puras (sem ler disco) que o check-build.mjs usa depois do `vite build`.
// Tamanhos em bytes comprimidos com gzip; limites em kB (1 kB = 1000 bytes, como o Vite mostra).

const KB = 1000;

/** Medidas do orçamento, na ordem em que aparecem na tabela. */
const MEASURES = [
  { id: 'initialJs', label: 'JS inicial' },
  { id: 'routeChunk', label: 'Maior pedaço de rota' },
  { id: 'css', label: 'CSS' },
  { id: 'totalJs', label: 'JS total' },
];

const sum = (files) => files.reduce((total, file) => total + file.bytes, 0);

/**
 * Arquivos do JS inicial: a(s) entrada(s) do manifesto do Vite e tudo que ela importa de forma estática
 * (recursivo). Os imports dinâmicos (`dynamicImports`) ficam de fora: são os pedaços carregados sob demanda.
 */
export function initialFiles(manifest) {
  const files = new Set();
  const visited = new Set();
  const visit = (key) => {
    const chunk = manifest[key];
    if (!chunk || visited.has(key)) return;
    visited.add(key);
    files.add(chunk.file);
    for (const imported of chunk.imports ?? []) visit(imported);
  };
  for (const [key, chunk] of Object.entries(manifest)) {
    if (chunk.isEntry) visit(key);
  }
  return [...files];
}

/**
 * Mede os arquivos do build. `files`: `{ path, bytes }` (bytes já comprimidos); `initial`: caminhos do JS inicial.
 * Devolve cada medida em kB: o JS inicial, o maior pedaço de rota (cada .js fora do inicial, um a um), o CSS
 * (soma) e o JS total (soma).
 */
export function measure(files, initial) {
  const initialSet = new Set(initial);
  const js = files.filter((file) => file.path.endsWith('.js'));
  const routeChunks = js.filter((file) => !initialSet.has(file.path));
  const largest = routeChunks.reduce(
    (max, file) => (file.bytes > (max?.bytes ?? -1) ? file : max),
    null,
  );

  return {
    initialJs: { value: sum(js.filter((file) => initialSet.has(file.path))) / KB },
    routeChunk: { value: (largest?.bytes ?? 0) / KB, detail: largest?.path },
    css: { value: sum(files.filter((file) => file.path.endsWith('.css'))) / KB },
    totalJs: { value: sum(js) / KB },
  };
}

/** Compara as medidas com o orçamento (em kB). `ok` só é verdadeiro se todas as medidas couberem no limite. */
export function checkBudget(files, initial, budget) {
  const measured = measure(files, initial);
  const measures = MEASURES.map(({ id, label }) => ({
    id,
    label,
    value: measured[id].value,
    limit: budget[id],
    ok: measured[id].value <= budget[id],
    ...(measured[id].detail ? { detail: measured[id].detail } : {}),
  }));
  return { ok: measures.every((m) => m.ok), measures };
}

const formatKb = (kb) => `${kb.toFixed(1)} kB`;
const mark = (m) => (m.ok ? '✓' : '✕');
const label = (m) => (m.detail ? `${m.label} (${m.detail})` : m.label);

/** Tabela em texto para o terminal: medida, tamanho, limite e ✓ ou ✕. */
export function formatTable(report) {
  const rows = report.measures.map((m) => [label(m), formatKb(m.value), `${m.limit} kB`, mark(m)]);
  const head = ['Medida', 'Tamanho (gzip)', 'Limite', ''];
  const widths = head.map((_, col) => Math.max(...[head, ...rows].map((row) => row[col].length)));
  const line = (row) =>
    row
      .map((cell, col) => (col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col])))
      .join('  ')
      .trimEnd();
  return [line(head), line(widths.map((w) => '-'.repeat(w))), ...rows.map(line)].join('\n');
}

/** A mesma tabela em Markdown, para o resumo do job no GitHub (`GITHUB_STEP_SUMMARY`). */
export function formatMarkdown(report) {
  const rows = report.measures.map(
    (m) => `| ${label(m)} | ${formatKb(m.value)} | ${m.limit} kB | ${mark(m)} |`,
  );
  return [
    '### Orçamento do bundle (web)',
    '',
    '| Medida | Tamanho (gzip) | Limite | |',
    '|---|---:|---:|:-:|',
    ...rows,
    '',
  ].join('\n');
}

/** Uma linha por medida que estourou: qual foi e por quanto. */
export function formatFailures(report) {
  return report.measures
    .filter((m) => !m.ok)
    .map(
      (m) =>
        `${label(m)}: ${formatKb(m.value)}, limite ${m.limit} kB (estourou por ${formatKb(m.value - m.limit)})`,
    );
}

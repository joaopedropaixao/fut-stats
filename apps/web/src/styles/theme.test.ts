import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Variáveis "--nome: valor;" de um CSS, com o valor normalizado (minúsculas, sem espaço extra). */
function tokens(path: string): Map<string, string> {
  const css = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    // Primeira ocorrência = valor padrão (Gramado, com movimento); as trocas vêm depois
    if (!map.has(name!)) map.set(name!, value!.trim().toLowerCase().replace(/\s+/g, ' '));
  }
  return map;
}

// tokens.css é a fonte da verdade do visual (DS v1.3); theme.css é a cópia que o Tailwind lê
const source = tokens('../../../../docs/design/tokens.css');
const theme = tokens('./theme.css');

// O Tailwind usa uma unidade de espaço (--spacing: 4px) no lugar da escala spacing-1..14
const SPACING = /^--spacing-(\d+)$/;

describe('tema do Tailwind x docs/design/tokens.css', () => {
  it.each([...source.entries()])('%s tem o mesmo valor', (name, value) => {
    const step = SPACING.exec(name);
    if (step) {
      expect(value).toBe(`${Number(step[1]) * 4}px`);
      expect(theme.get('--spacing')).toBe('4px');
      return;
    }
    // A fonte do Inter é servida como "Inter Variable" (fontsource), com "Inter" de reserva
    if (name === '--font-sans') {
      expect(theme.get(name)).toContain("'inter'");
      return;
    }
    expect(theme.get(name)).toBe(value);
  });
});

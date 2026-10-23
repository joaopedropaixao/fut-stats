import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Tokens = Map<string, string>;

const NIGHT_BLOCK = /\[data-theme='night'\]\s*\{([^}]*)\}/;
const REDUCED_MOTION_BLOCK =
  /@media \(prefers-reduced-motion: reduce\)\s*\{\s*:root\s*\{([^}]*)\}\s*\}/;

/** Variáveis "--nome: valor;" de um trecho de CSS, com o valor normalizado (minúsculas, sem espaço extra). */
function parse(css: string): Tokens {
  const map: Tokens = new Map();
  for (const [, name, value] of css.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    map.set(name!, value!.trim().toLowerCase().replace(/\s+/g, ' '));
  }
  return map;
}

/** Separa os valores padrão (Gramado, com movimento) das trocas do tema Noite e do "reduzir movimento". */
function tokens(path: string) {
  const css = readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const night = NIGHT_BLOCK.exec(css);
  const reduced = REDUCED_MOTION_BLOCK.exec(css);
  if (!night || !reduced)
    throw new Error(`${path}: faltou o bloco do tema Noite ou do reduzir movimento`);

  return {
    base: parse(css.replace(night[0], '').replace(reduced[0], '')),
    night: parse(night[1]!),
    reduced: parse(reduced[1]!),
  };
}

// tokens.css é a fonte da verdade do visual (DS v1.3); theme.css é a cópia que o Tailwind lê
const source = tokens('../../../../docs/design/tokens.css');
const theme = tokens('./theme.css');

// O Tailwind usa uma unidade de espaço (--spacing: 4px) no lugar da escala spacing-1..14
const SPACING = /^--spacing-(\d+)$/;

describe('tema do Tailwind x docs/design/tokens.css', () => {
  it.each([...source.base.entries()])('%s tem o mesmo valor', (name, value) => {
    const step = SPACING.exec(name);
    if (step) {
      expect(value).toBe(`${Number(step[1]) * 4}px`);
      expect(theme.base.get('--spacing')).toBe('4px');
      return;
    }
    // A fonte do Inter é servida como "Inter Variable" (fontsource), com "Inter" de reserva
    if (name === '--font-sans') {
      expect(theme.base.get(name)).toContain("'inter'");
      return;
    }
    expect(theme.base.get(name)).toBe(value);
  });

  it('o tema Noite troca os mesmos tokens, com os mesmos valores', () => {
    expect(theme.night).toEqual(source.night);
  });

  it('o "reduzir movimento" zera as mesmas durações', () => {
    expect(theme.reduced).toEqual(source.reduced);
  });
});

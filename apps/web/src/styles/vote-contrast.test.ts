import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../../../docs/design/tokens.css', import.meta.url), 'utf8');
const token = (name: string): string => {
  const hex = new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(css)?.[1];
  if (!hex) throw new Error(`token ${name} não encontrado`);
  return hex;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe('azul da votação (--color-vote)', () => {
  it.each(['--color-bg', '--color-surface-raised', '--color-surface-3', '--color-track'])(
    'tem contraste AA (≥ 4,5:1) para texto sobre %s',
    (surface) => {
      expect(contrast(token('--color-vote'), token(surface))).toBeGreaterThanOrEqual(4.5);
    },
  );
});

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('tentativa de sinal de tema escuro para o Samsung Internet (C13)', () => {
  it('o index.html declara a meta color-scheme "light dark"', () => {
    const html = read('../index.html');
    expect(html).toMatch(/<meta\s+name="color-scheme"\s+content="light dark"\s*\/?>/);
  });

  it('o CSS mantém color-scheme: dark no html (a página segue sempre escura)', () => {
    const css = read('./index.css').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).toMatch(/html\s*\{[^}]*color-scheme:\s*dark/);
  });
});

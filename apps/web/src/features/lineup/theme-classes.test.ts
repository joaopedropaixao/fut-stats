import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// O tema zera as cores do Tailwind (`--color-*: initial`): bg-white, bg-black, text-white e text-black
// não geram nada. Foi o que deixou o "Pular" do VS invisível.
const FILES = [
  'vs-board.tsx',
  'you-banner.tsx',
  'you-tag.tsx',
  '../../components/ui/pixel-sprite.tsx',
];

describe('classes de cor do tema', () => {
  it.each(FILES)('%s só usa cores que existem no tema', (file) => {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    expect(source).not.toMatch(/\b(?:bg|text|border|ring|fill|stroke)-(?:white|black)\b/);
  });
});

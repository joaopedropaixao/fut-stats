/**
 * Dígitos pixel próprios do DS v1.3: grade 6x9, traço de 2px, largura fixa.
 * O 4 é aberto, o 0 tem risco, o 2 tem topo curvo (não é Z) e a vírgula tem rabicho.
 * Mesmo desenho de docs/design/folha/build.py (GLYPHS).
 */
const GLYPHS: Record<string, readonly string[]> = {
  '0': ['.####.', '##..##', '##..##', '##.###', '###.##', '##..##', '##..##', '##..##', '.####.'],
  '1': ['..##..', '.###..', '####..', '..##..', '..##..', '..##..', '..##..', '..##..', '######'],
  '2': ['.####.', '##..##', '....##', '....##', '..###.', '.##...', '##....', '##....', '######'],
  '3': ['#####.', '....##', '....##', '....##', '.####.', '....##', '....##', '....##', '#####.'],
  '4': ['##..##', '##..##', '##..##', '##..##', '######', '....##', '....##', '....##', '....##'],
  '5': ['######', '##....', '##....', '#####.', '....##', '....##', '....##', '##..##', '.####.'],
  '6': ['.####.', '##....', '##....', '#####.', '##..##', '##..##', '##..##', '##..##', '.####.'],
  '7': ['######', '....##', '....##', '...##.', '..##..', '..##..', '..##..', '..##..', '..##..'],
  '8': ['.####.', '##..##', '##..##', '##..##', '.####.', '##..##', '##..##', '##..##', '.####.'],
  '9': ['.####.', '##..##', '##..##', '##..##', '.#####', '....##', '....##', '....##', '.####.'],
  ',': ['..', '..', '..', '..', '..', '##', '##', '.#', '#.'],
  '+': ['......', '......', '..##..', '..##..', '######', '######', '..##..', '..##..', '......'],
  '×': ['......', '......', '##..##', '.####.', '..##..', '.####.', '##..##', '......', '......'],
  '/': ['....##', '....##', '...##.', '...##.', '..##..', '.##...', '.##...', '##....', '##....'],
  ' ': ['...', '...', '...', '...', '...', '...', '...', '...', '...'],
};

/** Altura da grade em pixels do desenho; na tela, altura = 9 x escala. */
export const GLYPH_HEIGHT = 9;

/** Caracteres que os dígitos pixel sabem desenhar. */
export const PIXEL_CHARS = Object.keys(GLYPHS);

export function isPixelText(text: string): boolean {
  return [...text].every((ch) => ch in GLYPHS);
}

/**
 * Desenho de um texto em dígitos pixel: o caminho SVG (em unidades da grade) e a largura total.
 * Cada sequência de "#" numa linha vira um retângulo de 1 de altura; 1 coluna vazia entre caracteres.
 * Caractere fora da lista é ignorado (o componente avisa em dev).
 */
export function pixelDigitsPath(text: string): { d: string; width: number } {
  let x = 0;
  const parts: string[] = [];

  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) continue;

    glyph.forEach((line, y) => {
      let start = line.indexOf('#');
      while (start !== -1) {
        let end = start;
        while (line[end] === '#') end++;
        parts.push(`M${x + start} ${y}h${end - start}v1h-${end - start}z`);
        start = line.indexOf('#', end);
      }
    });
    x += glyph[0]!.length + 1;
  }

  return { d: parts.join(''), width: Math.max(x - 1, 1) };
}

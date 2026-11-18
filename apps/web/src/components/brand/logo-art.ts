/**
 * Letras do logo "FUT STATS": mesmo traço dos dígitos pixel (grade 6x9, vertical de 2, horizontal de 1).
 * O logo é a única peça com essas letras; o resto da interface usa a Silkscreen.
 */
const LETTERS: Record<string, readonly string[]> = {
  F: ['######', '##....', '##....', '##....', '#####.', '##....', '##....', '##....', '##....'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  S: ['.#####', '##....', '##....', '##....', '.####.', '....##', '....##', '....##', '#####.'],
  A: ['.####.', '##..##', '##..##', '##..##', '######', '##..##', '##..##', '##..##', '##..##'],
};

export const LETTER_HEIGHT = 9;

/** Quantos pixels de profundidade (a sombra de fliperama) saem para baixo e para a direita. */
export const EXTRUDE_DEPTH = 1;

/**
 * Margem em volta das letras: contorno (1) à esquerda/topo; profundidade + contorno + sombra (1) à direita/base.
 */
export const LOGO_PAD = { start: 1, end: EXTRUDE_DEPTH + 2 };

type Cell = `${number},${number}`;
const key = (x: number, y: number): Cell => `${x},${y}`;

/** Pixels acesos de uma palavra (1 coluna vazia entre letras), já deslocados pela margem. */
function wordCells(word: string): Set<Cell> {
  const cells = new Set<Cell>();
  let x0 = LOGO_PAD.start;
  for (const letter of word) {
    const rows = LETTERS[letter];
    if (!rows) throw new Error(`Letra sem desenho no logo: ${letter}`);
    rows.forEach((row, y) =>
      [...row].forEach((c, x) => c === '#' && cells.add(key(x0 + x, LOGO_PAD.start + y))),
    );
    x0 += rows[0]!.length + 1;
  }
  return cells;
}

function shift(cells: Set<Cell>, dx: number, dy: number): Set<Cell> {
  return new Set(
    [...cells].map((c) => {
      const [x, y] = c.split(',').map(Number) as [number, number];
      return key(x + dx, y + dy);
    }),
  );
}

function union(...sets: Set<Cell>[]): Set<Cell> {
  return new Set(sets.flatMap((s) => [...s]));
}

function minus(a: Set<Cell>, b: Set<Cell>): Set<Cell> {
  return new Set([...a].filter((c) => !b.has(c)));
}

/** Engorda 1 pixel em volta (8 vizinhos): é o contorno. */
function dilate(cells: Set<Cell>): Set<Cell> {
  const out: Set<Cell>[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) out.push(shift(cells, dx, dy));
  return union(...out);
}

/** Caminho SVG (em unidades da grade): cada sequência horizontal vira um retângulo de 1 de altura. */
function toPath(cells: Set<Cell>): string {
  const rows = new Map<number, number[]>();
  for (const c of cells) {
    const [x, y] = c.split(',').map(Number) as [number, number];
    rows.set(y, [...(rows.get(y) ?? []), x]);
  }
  let d = '';
  for (const [y, xs] of [...rows].sort((a, b) => a[0] - b[0])) {
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length;) {
      let j = i;
      while (xs[j + 1] === xs[j]! + 1) j++;
      d += `M${xs[i]} ${y}h${j - i + 1}v1h-${j - i + 1}z`;
      i = j + 1;
    }
  }
  return d;
}

export interface LogoWordArt {
  width: number;
  height: number;
  /** De baixo para cima: sombra dura, contorno, profundidade, letra. */
  shadow: string;
  outline: string;
  extrude: string;
  face: string;
}

/**
 * Camadas de uma palavra do logo, em pixels da grade, como letreiro de fliperama: a letra, uma
 * profundidade de `EXTRUDE_DEPTH` para baixo e para a direita, um contorno de 1 em volta das duas e
 * uma sombra dura de 1 que solta o letreiro do fundo.
 */
export function logoWordArt(word: string): LogoWordArt {
  const face = wordCells(word);
  const body = union(
    face,
    ...Array.from({ length: EXTRUDE_DEPTH }, (_, i) => shift(face, i + 1, i + 1)),
  );
  const outlined = dilate(body);
  const letters = [...word].reduce((w, l) => w + LETTERS[l]![0]!.length, 0) + word.length - 1;
  return {
    width: LOGO_PAD.start + letters + LOGO_PAD.end,
    height: LOGO_PAD.start + LETTER_HEIGHT + LOGO_PAD.end,
    shadow: toPath(minus(shift(outlined, 1, 1), outlined)),
    outline: toPath(minus(outlined, body)),
    extrude: toPath(minus(body, face)),
    face: toPath(face),
  };
}

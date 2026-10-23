/**
 * "G" do Google em pixel art (grade 9x9, traço de 2, como os dígitos pixel) dentro de uma moeda pixel branca
 * com contorno preto. A moeda deixa o amarelo do G legível sobre a tecla amarela.
 */
const COIN = [
  '....KKKKK....',
  '..KKWWWWWKK..',
  '.KWWRRRRRWWK.',
  '.KWRRRRRRRWK.',
  'KWRRWWWWWWWWK',
  'KWYYWWWBBBBWK',
  'KWYYWWWBBBBWK',
  'KWYYWWWWWBBWK',
  'KWGGWWWWWBBWK',
  '.KWGGGGGGGWK.',
  '.KWWGGGGGWWK.',
  '..KKWWWWWKK..',
  '....KKKKK....',
];

const COLORS: Record<string, string> = {
  K: '#111111',
  W: '#ffffff',
  R: '#ea4335',
  Y: '#fbbc05',
  G: '#34a853',
  B: '#4285f4',
};

/** Um retângulo por sequência de pixels da mesma cor numa linha, agrupados por cor. */
function paths() {
  const byColor = new Map<string, string[]>();
  COIN.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const c = line[x]!;
      let end = x;
      while (line[end] === c) end++;
      if (COLORS[c]) {
        const list = byColor.get(c) ?? [];
        list.push(`M${x} ${y}h${end - x}v1h-${end - x}z`);
        byColor.set(c, list);
      }
      x = end;
    }
  });
  return [...byColor].map(([c, d]) => <path key={c} d={d.join('')} fill={COLORS[c]} />);
}

const PATHS = paths();

/** Marca do Google para o botão de entrar. Decorativa: o rótulo do botão já diz "com Google". */
export function GoogleMark() {
  return (
    <svg
      aria-hidden
      width="26"
      height="26"
      viewBox="0 0 13 13"
      shapeRendering="crispEdges"
      className="shrink-0"
    >
      {PATHS}
    </svg>
  );
}

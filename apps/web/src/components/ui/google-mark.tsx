/**
 * "G" do Google em pixel art: grade 9x9 com traço de 2, como os dígitos pixel, nas 4 cores da marca.
 * Fica num quadrado branco porque o amarelo do G sumiria sobre a tecla amarela.
 */
const G = [
  '..RRRRR..',
  '.RRRRRRR.',
  'RR.......',
  'YY...BBBB',
  'YY...BBBB',
  'YY.....BB',
  'GG.....BB',
  '.GGGGGGG.',
  '..GGGGG..',
];

const COLORS: Record<string, string> = {
  R: '#ea4335',
  Y: '#fbbc05',
  G: '#34a853',
  B: '#4285f4',
};

/** Um retângulo por sequência de pixels da mesma cor numa linha, agrupados por cor. */
function paths() {
  const byColor = new Map<string, string[]>();
  G.forEach((line, y) => {
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
    <span
      aria-hidden
      className="inline-flex size-6 shrink-0 items-center justify-center bg-team-white"
    >
      <svg width="18" height="18" viewBox="0 0 9 9" shapeRendering="crispEdges">
        {PATHS}
      </svg>
    </span>
  );
}

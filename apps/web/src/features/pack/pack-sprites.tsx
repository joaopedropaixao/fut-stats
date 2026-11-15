import { spritePaths, type SpriteMap } from '../../components/ui/pixel-sprite-maps';

/**
 * Pixel art do pacote (folha: Momento/Pacote, `build.py`): o pacote fechado (22 x 28) com a tampa serrilhada, o
 * emblema da estrela, a luz do rasgo (BURST) e as estrelas pequenas. Mapas de caracteres como o resto dos
 * sprites: uma letra por cor.
 */
const W = 22;
const H = 28;
/** A tampa (as 6 primeiras linhas) é a peça que sai no rasgo. */
const PACK_FLAP_ROWS = 6;

const zigzag = (up: boolean) =>
  Array.from({ length: W }, (_, x) => (x % 2 === (up ? 0 : 1) ? 'K' : '.')).join('');
const ridges = (shift: number) =>
  `K${Array.from({ length: W - 2 }, (_, x) => ((x + shift) % 2 === 0 ? 'G' : 'D')).join('')}K`;
const plain = `K${'G'.repeat(W - 2)}K`;
const edge = 'K'.repeat(W);
/** O corpo: brilho à esquerda, sombra à direita, sem estrela. */
const body = (() => {
  const cells = Array.from({ length: W - 2 }, (_, x) =>
    x === 1 || x === 2 ? 'Y' : x >= W - 5 && x <= W - 4 ? 'D' : 'G',
  );
  return `K${cells.join('')}K`;
})();

const STAR_SOLID = [
  '....K....',
  '...KKK...',
  '...KKK...',
  'KKKKKKKKK',
  '.KKKKKKK.',
  '..KKKKK..',
  '..KK.KK..',
  '.KK...KK.',
  'KK.....KK',
];

function buildPack(): string[] {
  const rows = [
    zigzag(true),
    ridges(0),
    ridges(1),
    plain,
    plain,
    edge,
    ...Array.from({ length: H - 2 * PACK_FLAP_ROWS }, () => body),
    edge,
    plain,
    plain,
    ridges(1),
    ridges(0),
    zigzag(false),
  ];
  // O emblema: a estrela escura no meio do corpo
  const top = 7;
  const left = Math.floor((W - 9) / 2);
  STAR_SOLID.forEach((line, i) => {
    const y = top + i;
    const row = [...rows[y]!];
    [...line].forEach((c, x) => {
      if (c === 'K') row[left + x] = 'K';
    });
    rows[y] = row.join('');
  });
  return rows;
}

const PACK_MAP: SpriteMap = buildPack();

const PACK_PALETTE = {
  K: '#111111',
  G: 'var(--color-gold)',
  Y: 'var(--color-gold-light)',
  D: 'var(--color-gold-shadow)',
};

/** A luz do rasgo da folha (19 x 13): raios amarelos que saem da fenda. */
const BURST = [
  '....Y....Y....Y....',
  '.....Y...Y...Y.....',
  'Y.....Y..Y..Y.....Y',
  '.Y.............Y...',
  '..Y.............Y..',
  '...................',
  'YYY.............YYY',
  '...................',
  '..Y.............Y..',
  '.Y...............Y.',
  'Y.....Y..Y..Y.....Y',
  '.....Y...Y...Y.....',
  '....Y....Y....Y....',
];

const STAR_SMALL = ['...#...', '..###..', '#######', '.#####.', '..###..', '.##.##.', '.#...#.'];

type SpriteProps = { scale?: number; className?: string };

function Sprite({
  map,
  palette,
  scale,
  className,
  rows,
}: SpriteProps & { map: SpriteMap; palette: Record<string, string>; rows?: [number, number] }) {
  const [from, to] = rows ?? [0, map.length];
  const slice = map.slice(from, to);
  const paths = spritePaths(slice, palette);
  const width = slice[0]!.length;
  return (
    <svg
      aria-hidden
      width={width * (scale ?? 8)}
      height={slice.length * (scale ?? 8)}
      viewBox={`0 0 ${width} ${slice.length}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {Object.entries(paths).map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

/** O pacote inteiro, fechado (176 x 224 na escala 8). */
export function PackSprite({ scale = 8, className }: SpriteProps) {
  return <Sprite map={PACK_MAP} palette={PACK_PALETTE} scale={scale} className={className} />;
}

/** A tampa do pacote (a parte que sai no rasgo). */
export function PackFlap({ scale = 8, className }: SpriteProps) {
  return (
    <Sprite
      map={PACK_MAP}
      palette={PACK_PALETTE}
      scale={scale}
      className={className}
      rows={[0, PACK_FLAP_ROWS]}
    />
  );
}

/** O resto do pacote, sem a tampa. */
export function PackBody({ scale = 8, className }: SpriteProps) {
  return (
    <Sprite
      map={PACK_MAP}
      palette={PACK_PALETTE}
      scale={scale}
      className={className}
      rows={[PACK_FLAP_ROWS, PACK_MAP.length]}
    />
  );
}

export function BurstSprite({ scale = 10, className }: SpriteProps) {
  return (
    <Sprite
      map={BURST}
      palette={{ Y: 'var(--color-gold-light)' }}
      scale={scale}
      className={className}
    />
  );
}

export function StarSprite({ scale = 3, color, className }: SpriteProps & { color: string }) {
  return <Sprite map={STAR_SMALL} palette={{ '#': color }} scale={scale} className={className} />;
}

import { useState } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

type GenerateBlockProps = {
  /** Já tem alguém no rascunho: o bloco vira "Regerar". */
  regenerate: boolean;
  loading: boolean;
  onGenerate: () => void;
};

/**
 * Sprites em grade: um caractere por pixel. K contorno, G face, Y faixa clara, B sombra, W brilho/"?" (creme),
 * "." transparente. As cores vêm dos tokens (`fill-*`), nada de hex aqui.
 */
const BLOCK = [
  '....KKKKKKKKKKKKKKKKKKKKKK....',
  '....KKKKKKKKKKKKKKKKKKKKKK....',
  '..KKWWWWWWGGGGGGGGGGGGGGBBKK..',
  '..KKWWWWWWGGGGGGGGGGGGGGBBKK..',
  'KKWWWWYYKKKKKKKKKKKKYYGGGGBBKK',
  'KKWWWWYYKKKKKKKKKKKKYYGGGGBBKK',
  'KKWWYYKKWWWWWWWWWWWWKKYYGGBBKK',
  'KKWWYYKKWWWWWWWWWWWWKKYYGGBBKK',
  'KKWWKKWWWWWWWWWWWWWWWWKKGGBBKK',
  'KKWWKKWWWWWWWWWWWWWWWWKKGGBBKK',
  'KKGGKKWWWWWKKKKKWWWWWWKKGGBBKK',
  'KKGGYYKKKKKKKKKKWWWWWWKKGGBBKK',
  'KKWWYYKKKKKKKKKKWWWWWWKKGGBBKK',
  'KKWWYYYYYKKWWWWWWWWWKKYYGGBBKK',
  'KKGGYYYYYKKWWWWWWWWWKKYYGGBBKK',
  'KKGGYYYYYKKWWWWWKKKKYYYYGGBBKK',
  'KKGGYYYYYKKWWWWWKKKKYYYYGGBBKK',
  'KKGGYYYYYYYKKKKKYYYYYYYYGGBBKK',
  'KKGGYYYYYYYKKKKKYYYYYYYYGGBBKK',
  'KKGGYYYYYKKWWWWWKKYYYYYYGGBBKK',
  'KKGGYYYYYKKWWWWWKKYYYYYYGGBBKK',
  'KKGGYYYYYKKWWWWWKKYYYYYYGGBBKK',
  'KKGGGGYYYYYKKKKKYYYYYYGGGGBBKK',
  'KKGGGGYYYYYKKKKKYYYYYYGGGGBBKK',
  'KKBBGGGGGGGGGGGGGGGGGGGGGGBBKK',
  'KKBBGGGGGGGGGGGGGGGGGGGGGGBBKK',
  '..KKBBBBBBBBBBBBBBBBBBBBBBKK..',
  '..KKBBBBBBBBBBBBBBBBBBBBBBKK..',
  '....KKKKKKKKKKKKKKKKKKKKKK....',
  '....KKKKKKKKKKKKKKKKKKKKKK....',
];

const COIN = [
  '..KKKK..',
  '.KYYGGK.',
  'KYYGGGGK',
  'KYGGBGGK',
  'KYGGBGGK',
  'KYGGBGGK',
  'KYGGBGGK',
  'KYGGBGGK',
  'KYGGBGGK',
  'KGGGGGBK',
  '.KGGBBK.',
  '..KKKK..',
];

type Fill = Record<string, string>;

const FILL: Fill = {
  K: 'fill-outline',
  G: 'fill-gold',
  Y: 'fill-gold-light',
  B: 'fill-gold-shadow',
  W: 'fill-text',
};

/** Bloco "usado": a face e o "?" viram um só tom escuro, o brilho vira ouro e a sombra some no contorno. */
const FILL_USED: Fill = {
  K: 'fill-outline',
  G: 'fill-gold-shadow',
  Y: 'fill-gold-shadow',
  B: 'fill-outline',
  W: 'fill-gold',
};

/** Pixel do "?" (contorno e miolo), que no bloco "usado" some na face. */
function isGlyph(row: number, col: number, char: string) {
  if (char !== 'K' && char !== 'W') return false;
  if (row < 4 || row > 23 || col < 4 || col > 25) return false;
  return !(row <= 5 && col <= 5);
}

type Cell = { x: number; y: number; w: number; fill: string };

/** Junta pixels vizinhos da mesma cor numa linha em um só retângulo (menos nós no SVG). */
function toRects(grid: string[], palette: Fill, glyphFill?: string): Cell[] {
  const out: Cell[] = [];
  grid.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const char = line[x]!;
      if (char === '.') {
        x += 1;
        continue;
      }
      const fill = glyphFill && isGlyph(y, x, char) ? glyphFill : palette[char]!;
      let w = 1;
      while (x + w < line.length) {
        const next = line[x + w]!;
        const nextFill =
          next === '.' ? null : glyphFill && isGlyph(y, x + w, next) ? glyphFill : palette[next];
        if (nextFill !== fill) break;
        w += 1;
      }
      out.push({ x, y, w, fill });
      x += w;
    }
  });
  return out;
}

const BLOCK_RECTS = toRects(BLOCK, FILL);
const BLOCK_USED_RECTS = toRects(BLOCK, FILL_USED, 'fill-gold-shadow');
const COIN_RECTS = toRects(COIN, FILL);

function Sprite({
  rects,
  size,
  className,
}: {
  rects: Cell[];
  size: [number, number];
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      focusable="false"
      viewBox={`0 0 ${size[0]} ${size[1]}`}
      shapeRendering="crispEdges"
      className={className}
    >
      {rects.map((r) => (
        <rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} className={r.fill} />
      ))}
    </svg>
  );
}

/**
 * Bloco "?" do Mario ao lado de "Gerar times" / "Regerar": toca, ele pula e uma moeda sai de dentro e some.
 * Dourado da família `--color-gold` (exceção aprovada no DESIGN.md; o amarelo de ação é só do Publicar).
 * Gerando: bloco "usado" (sem "?"). Tudo anda em degraus; com Reduzir movimento não pula e a moeda não aparece.
 */
export function GenerateBlock({ regenerate, loading, onGenerate }: GenerateBlockProps) {
  const [hops, setHops] = useState(0);

  function press() {
    if (loading) return;
    setHops((n) => n + 1);
    onGenerate();
  }

  return (
    <button
      type="button"
      disabled={loading}
      aria-busy={loading}
      onClick={press}
      className={cn(
        'relative flex min-h-24 w-full items-center justify-center gap-4 px-4 py-2 select-none',
        'bg-surface shadow-float transition-[translate,box-shadow] duration-(--duration-fast) ease-out',
        loading
          ? 'text-disabled'
          : 'text-text active:translate-x-1 active:translate-y-1 active:shadow-key-pressed',
      )}
    >
      <span
        // A key nova reinicia o pulo e a moeda a cada toque
        key={hops}
        aria-hidden
        className="relative size-[90px] shrink-0"
      >
        {hops > 0 && (
          <span
            data-testid="coin"
            className="pointer-events-none absolute inset-x-0 top-[27px] flex animate-coin-rise justify-center motion-reduce:hidden"
          >
            <Sprite rects={COIN_RECTS} size={[8, 12]} className="animate-coin-spin h-9 w-6" />
          </span>
        )}
        <Sprite
          rects={loading ? BLOCK_USED_RECTS : BLOCK_RECTS}
          size={[30, 30]}
          className={cn('relative size-[90px]', hops > 0 && 'animate-block-hop')}
        />
      </span>
      <PixelText size={24}>
        {loading ? 'Gerando' : regenerate ? 'Regerar' : 'Gerar times'}
      </PixelText>
    </button>
  );
}

import { useState } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { WaitNotice } from '../../components/ui/wait-notice';
import { cn } from '../../lib/cn';
import { useSlowWait } from '../../lib/slow-wait';

/** Em 320 px "Gerando..." em 24 px encosta na borda do botão: abaixo de 360 px o texto vai para 16 px. */
const NARROW_LOADING_TEXT = 'max-[359px]:text-pixel-sm';

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

type Cell = { x: number; y: number; w: number; fill: string };

/** Junta pixels vizinhos da mesma cor numa linha em um só retângulo (menos nós no SVG). */
function toRects(grid: string[], palette: Fill): Cell[] {
  const out: Cell[] = [];
  grid.forEach((line, y) => {
    let x = 0;
    while (x < line.length) {
      const char = line[x]!;
      if (char === '.') {
        x += 1;
        continue;
      }
      const fill = palette[char]!;
      let w = 1;
      while (x + w < line.length) {
        const next = line[x + w]!;
        if (next === '.' || palette[next] !== fill) break;
        w += 1;
      }
      out.push({ x, y, w, fill });
      x += w;
    }
  });
  return out;
}

const BLOCK_RECTS = toRects(BLOCK, FILL);
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
 * Gerando: o bloco continua dourado e vivo, bate em degraus (quadros A e B) soltando moedas em loop, e o texto
 * ganha reticências que andam em degraus. Com mais de 5 s, uma linha avisa que o servidor está acordando. Tudo
 * anda em degraus (só transform e opacity); com Reduzir movimento fica parado ("Gerando...") e a linha aparece igual.
 */
export function GenerateBlock({ regenerate, loading, onGenerate }: GenerateBlockProps) {
  const [hops, setHops] = useState(0);
  const slow = useSlowWait(loading);

  function press() {
    if (loading) return;
    setHops((n) => n + 1);
    onGenerate();
  }

  return (
    <div className="flex flex-col">
      <button
        type="button"
        disabled={loading}
        aria-busy={loading}
        onClick={press}
        className={cn(
          'relative flex min-h-24 w-full items-center justify-center gap-4 px-4 py-2 select-none max-[359px]:gap-2',
          'bg-surface shadow-float transition-[translate,box-shadow] duration-(--duration-fast) ease-out',
          // Gerando: o bloco segue vivo, mas o botão não aceita toque (cursor de espera, sem o efeito de pressionar)
          'text-text disabled:cursor-wait',
          !loading && 'active:translate-x-1 active:translate-y-1 active:shadow-key-pressed',
        )}
      >
        <span
          // A key nova reinicia o pulo e a moeda a cada toque
          key={hops}
          aria-hidden
          className="relative size-[90px] shrink-0"
        >
          {(hops > 0 || loading) && (
            <span
              data-testid="coin"
              className={cn(
                'pointer-events-none absolute inset-x-0 top-[27px] flex justify-center motion-reduce:hidden',
                loading ? 'animate-coin-loop motion-reduce:animate-none' : 'animate-coin-rise',
              )}
            >
              <Sprite
                rects={COIN_RECTS}
                size={[8, 12]}
                className={cn(
                  'h-9 w-6',
                  loading
                    ? 'animate-coin-spin-loop motion-reduce:animate-none'
                    : 'animate-coin-spin',
                )}
              />
            </span>
          )}
          <Sprite
            rects={BLOCK_RECTS}
            size={[30, 30]}
            className={cn(
              'relative size-[90px]',
              loading
                ? 'animate-block-bump motion-reduce:animate-none'
                : hops > 0 && 'animate-block-hop',
            )}
          />
        </span>
        {loading ? (
          // Largura fixa: as reticências só aparecem e somem (opacidade), o texto não pula
          <span className="inline-flex items-baseline">
            <PixelText size={24} className={NARROW_LOADING_TEXT}>
              Gerando
            </PixelText>
            <span aria-hidden className="inline-flex">
              <PixelText size={24} className={NARROW_LOADING_TEXT}>
                .
              </PixelText>
              <span className="animate-dot-2 motion-reduce:animate-none">
                <PixelText size={24} className={NARROW_LOADING_TEXT}>
                  .
                </PixelText>
              </span>
              <span className="animate-dot-3 motion-reduce:animate-none">
                <PixelText size={24} className={NARROW_LOADING_TEXT}>
                  .
                </PixelText>
              </span>
            </span>
          </span>
        ) : (
          // Em 320 px "Gerar times" não cabe ao lado do bloco: abaixo de 360 px o texto encolhe e quebra em duas linhas
          <PixelText size={24} wrap className="min-w-0 min-[360px]:shrink-0">
            {regenerate ? 'Regerar' : 'Gerar times'}
          </PixelText>
        )}
      </button>
      {/* A região existe sempre: o leitor de tela só anuncia o que entra depois dela */}
      <div aria-live="polite">{slow && <SlowWaitNotice />}</div>
    </div>
  );
}

/** "Acordando o servidor, pode levar até 1 min" embaixo do bloco (o `mt-3` é o espaço entre os dois). */
export function SlowWaitNotice() {
  return <WaitNotice className="mt-3">Acordando o servidor, pode levar até 1 min</WaitNotice>;
}

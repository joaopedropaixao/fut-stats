import { cn } from '../../lib/cn';

/**
 * Bola pixel em movimento (14x14 e rastro de 5 colunas à esquerda): contorno preto, pentágono no
 * centro, gomos nas bordas e sombra creme embaixo à direita. Escolhida pelo dono para a capa.
 */
const BALL = [
  '..........KKKK.....',
  '........KKPPPPKK...',
  '.......KWWPPPPWWK..',
  '.TTT..KWWWWPPWWWWK.',
  '......KPWWWWWWWWPK.',
  'TTTT.KPPWWWPPWWWPPK',
  '.....KPPWWPPPPWWPPK',
  '.TTT.KPWWWPPPPWWWSK',
  '.....KWWWWWPPWWWWSK',
  'TTTT..KWWWWWWWWWSK.',
  '......KWPPWWWWPPSK.',
  '.......KPPPWWPPSK..',
  '........KKPSSPKK...',
  '..........KKKK.....',
];
const BALL_WIDTH = BALL[0]!.length;
/** O centro da bola (sem o rastro) fica no ponto central do campo. */
const BALL_CENTER_X = 5 + 7;

const BALL_LAYERS = [
  { char: 'K', fill: '#000000' },
  { char: 'P', fill: '#111111' },
  { char: 'W', fill: '#ffffff' },
  { char: 'S', fill: 'var(--color-text-muted)' },
  { char: 'T', fill: 'rgb(255 255 255 / 35%)' },
] as const;

function ballPath(char: string): string {
  return BALL.flatMap((line, y) =>
    [...line].map((c, x) => (c === char ? `M${x} ${y}h1v1h-1z` : '')),
  ).join('');
}

const BALL_PATHS = BALL_LAYERS.map(({ char, fill }) => ({ d: ballPath(char), fill }));

/** Bola pixel parada no ponto: `x`/`y` é o centro, `scale` o tamanho do pixel (inteiro, para não borrar). */
function PixelBall({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <svg
      x={x - BALL_CENTER_X * scale}
      y={y - (BALL.length / 2) * scale}
      width={BALL_WIDTH * scale}
      height={BALL.length * scale}
      viewBox={`0 0 ${BALL_WIDTH} ${BALL.length}`}
      shapeRendering="crispEdges"
    >
      {BALL_PATHS.map(({ d, fill }) => (
        <path key={fill} d={d} fill={fill} />
      ))}
    </svg>
  );
}

/**
 * Capa do app: linhas de giz do meio-campo (como a capa da folha) e a bola pixel no ponto central.
 * Fica atrás do conteúdo, no topo da tela; é só desenho.
 */
export function ChalkPitch({
  className,
  ballIn = false,
}: {
  className?: string;
  /** A bola entra correndo até o ponto central (capa); com "reduzir movimento", já está lá. */
  ballIn?: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 390 460"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      strokeWidth={2}
      className={cn('pointer-events-none absolute inset-x-0 top-0 h-115 w-full', className)}
    >
      <rect x="-60" y="-40" width="170" height="110" className="stroke-highlight" />
      <line x1="-20" y1="300" x2="410" y2="300" className="stroke-chalk" />
      <circle cx="270" cy="300" r="112" className="stroke-chalk" />
      <g className={ballIn ? 'animate-ball-in' : undefined}>
        <PixelBall x={270} y={300} scale={5} />
      </g>
    </svg>
  );
}

/** Canto do campo para cards: meia-lua do grande círculo saindo pela direita. */
export function ChalkCorner({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 140 200"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      strokeWidth={2}
      className={cn('pointer-events-none absolute inset-y-0 right-0 h-full w-35', className)}
    >
      <line x1="120" y1="-10" x2="120" y2="210" className="stroke-chalk" />
      <circle cx="120" cy="100" r="64" className="stroke-chalk" />
      <rect x="116" y="96" width="8" height="8" className="fill-chalk" stroke="none" />
    </svg>
  );
}

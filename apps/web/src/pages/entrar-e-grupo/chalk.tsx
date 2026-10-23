import { cn } from '../../lib/cn';

/** A bola pixel da folha (BALL em docs/design/folha/build.py, a mesma do ícone do app). */
const BALL = ['..WWW..', '.WKWWW.', 'WWWWKWW', 'WKWWWWW', 'WWWKWKW', '.WWWWW.', '..WWW..'];

function ballPath(color: 'W' | 'K'): string {
  return BALL.flatMap((line, y) =>
    [...line].map((c, x) => (c === color ? `M${x} ${y}h1v1h-1z` : '')),
  ).join('');
}

const BALL_WHITE = ballPath('W');
const BALL_BLACK = ballPath('K');

/** Bola pixel parada no ponto: `x`/`y` é o centro, `scale` o tamanho do pixel (inteiro, para não borrar). */
function PixelBall({ x, y, scale }: { x: number; y: number; scale: number }) {
  const size = BALL.length * scale;
  return (
    <svg
      x={x - size / 2}
      y={y - size / 2}
      width={size}
      height={size}
      viewBox={`0 0 ${BALL.length} ${BALL.length}`}
      shapeRendering="crispEdges"
    >
      <path d={BALL_WHITE} className="fill-text" />
      <path d={BALL_BLACK} fill="#111111" />
    </svg>
  );
}

/**
 * Capa do app: linhas de giz do meio-campo (como a capa da folha) e a bola pixel no ponto central.
 * Fica atrás do conteúdo, no topo da tela; é só desenho.
 */
export function ChalkPitch({ className }: { className?: string }) {
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
      <PixelBall x={270} y={300} scale={8} />
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

import { cn } from '../../lib/cn';

/**
 * Holofote de estádio em pixel: um cone de luz que abre em degraus a partir do refletor, com um miolo mais claro e a
 * poça de luz no chão. Grade 16 x 16 (l = refletor, b = feixe, c = miolo, p = chão), estático. Fica atrás do bonequinho,
 * dentro do palco escuro do card do topo do Ranking; o número e o texto ficam fora dele, no fundo de sempre.
 */
const ROWS = [
  '......llll......',
  '......bbbb......',
  '......bbbb......',
  '.....bbbbbb.....',
  '.....bbbbbb.....',
  '....bbbbbbbb....',
  '....bbbbbbbb....',
  '...bbbbbbbbbb...',
  '...bbbbbbbbbb...',
  '..bbbbbbbbbbbb..',
  '..bbbbbbbbbbbb..',
  '.bbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbb.',
  '.bbbbbbbbbbbbbb.',
  '..pppppppppppp..',
  '....pppppppp....',
] as const;

const SIZE = 16;

/** O miolo é o feixe a duas casas das bordas (não encosta no contorno do cone). */
function cellKind(row: string, x: number): 'l' | 'b' | 'c' | 'p' | null {
  const ch = row[x];
  if (ch === 'l' || ch === 'p') return ch;
  if (ch !== 'b') return null;
  return row[x - 2] === 'b' && row[x + 2] === 'b' ? 'c' : 'b';
}

function pathOf(kind: 'l' | 'b' | 'c' | 'p'): string {
  const parts: string[] = [];
  ROWS.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) if (cellKind(row, x) === kind) parts.push(`M${x} ${y}h1v1h-1z`);
  });
  return parts.join('');
}

const PATHS = {
  l: pathOf('l'),
  b: pathOf('b'),
  c: pathOf('c'),
  p: pathOf('p'),
};

export function Spotlight({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      shapeRendering="crispEdges"
      preserveAspectRatio="none"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    >
      <path d={PATHS.b} fill="rgb(232 255 214 / 20%)" />
      <path d={PATHS.c} fill="rgb(232 255 214 / 36%)" />
      <path d={PATHS.p} fill="rgb(232 255 214 / 42%)" />
      <path d={PATHS.l} fill="var(--color-text)" />
    </svg>
  );
}

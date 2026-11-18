import { cn } from '../../lib/cn';
import type { PodiumTier } from './podium';

/** Pixel art das peças do pódio: M = cor do degrau, L = faixa clara, S = sombra, "." = vazio. */
const CROWN = ['M...M...M', 'MM.MMM.MM', 'MLMMMMMMM', 'MMMMLMMMM', 'SSSSSSSSS'] as const;
const MEDAL = [
  'SS.....SS',
  '.SS...SS.',
  '..SS.SS..',
  '...SSS...',
  '..MMMMM..',
  '.MLLMMMS.',
  'MMLMMMMMS',
  'MMMMMMMMS',
  '.MMMMMSS.',
  '..SSSSS..',
] as const;

/** Largura da grade das duas peças. */
export const MEDAL_WIDTH = 9;

const COLORS: Record<PodiumTier, { M: string; L: string; S: string }> = {
  gold: {
    M: 'var(--color-gold)',
    L: 'var(--color-gold-light)',
    S: 'var(--color-gold-shadow)',
  },
  silver: {
    M: 'var(--color-silver)',
    L: 'var(--color-silver-light)',
    S: 'var(--color-silver-shadow)',
  },
  bronze: {
    M: 'var(--color-bronze)',
    L: 'var(--color-bronze-light)',
    S: 'var(--color-bronze-shadow)',
  },
};

/** Os retângulos de uma cor, num caminho só (como os dígitos pixel). */
function pathOf(rows: readonly string[], char: 'M' | 'L' | 'S'): string {
  const parts: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (row[x] === char) parts.push(`M${x} ${y}h1v1h-1z`);
  });
  return parts.join('');
}

type MedalProps = {
  tier: PodiumTier;
  /** Escala inteira (nunca fração): 2 → 18 px de largura; 4 → 36 px. */
  scale?: number;
  className?: string;
};

/**
 * A medalha do pódio em pixel: coroa no 1º (ouro), medalha com fita no 2º (prata) e no 3º (bronze). Decorativa: o lugar
 * vem sempre em texto ao lado (o número e o nome para leitor de tela, "1º lugar, ouro"); a cor sozinha não é o sinal.
 */
export function Medal({ tier, scale = 2, className }: MedalProps) {
  const rows = tier === 'gold' ? CROWN : MEDAL;
  const colors = COLORS[tier];
  return (
    <svg
      aria-hidden
      width={MEDAL_WIDTH * scale}
      height={rows.length * scale}
      viewBox={`0 0 ${MEDAL_WIDTH} ${rows.length}`}
      shapeRendering="crispEdges"
      className={cn('shrink-0', className)}
    >
      {(['S', 'M', 'L'] as const).map((char) => (
        <path key={char} d={pathOf(rows, char)} style={{ fill: colors[char] }} />
      ))}
    </svg>
  );
}

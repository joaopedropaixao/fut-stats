import { cn } from '../../lib/cn';

/**
 * O pacote fechado em miniatura (11 x 13, a folha: Momento/Pacote) para o card do início: ouro com a estrela
 * escura no meio. Leve de propósito (vai no JS inicial): o pacote grande, com a animação, fica no pedaço da rota.
 */
const MAP = [
  'K.K.K.K.K.K',
  'KDGDGDGDGDK',
  'KKKKKKKKKKK',
  'KYGGGGGGGDK',
  'KYGGGKGGGDK',
  'KYGGKKKGGDK',
  'KYGKKKKKGDK',
  'KYGGKKKGGDK',
  'KYGGKGKGGDK',
  'KYGGGGGGGDK',
  'KKKKKKKKKKK',
  'KDGDGDGDGDK',
  'K.K.K.K.K.K',
] as const;

const COLORS: Record<string, string> = {
  K: '#111111',
  G: 'var(--color-gold)',
  Y: 'var(--color-gold-light)',
  D: 'var(--color-gold-shadow)',
};

const PATHS = (() => {
  const byColor: Record<string, string> = {};
  MAP.forEach((row, y) =>
    [...row].forEach((c, x) => {
      const color = COLORS[c];
      if (color) byColor[color] = `${byColor[color] ?? ''}M${x} ${y}h1v1h-1z`;
    }),
  );
  return Object.entries(byColor);
})();

export function PackMini({ scale = 5, className }: { scale?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={11 * scale}
      height={13 * scale}
      viewBox="0 0 11 13"
      shapeRendering="crispEdges"
      className={cn('shrink-0', className)}
    >
      {PATHS.map(([color, d]) => (
        <path key={color} d={d} fill={color} />
      ))}
    </svg>
  );
}

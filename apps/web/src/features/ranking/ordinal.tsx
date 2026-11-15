/**
 * O "º" do ordinal ("4º"), desenhado em pixel junto dos dígitos: a Silkscreen o faz pequeno demais e ele some ao lado
 * de um número grande. Anel 4 x 4, escala inteira, alinhado ao topo do número.
 */
export function Ordinal({ scale = 2, className }: { scale?: number; className?: string }) {
  return (
    <svg
      aria-hidden
      width={4 * scale}
      height={4 * scale}
      viewBox="0 0 4 4"
      shapeRendering="crispEdges"
      className={['shrink-0', className].filter(Boolean).join(' ')}
    >
      <path d="M1 0h2v1h-2zM0 1h1v2h-1zM3 1h1v2h-1zM1 3h2v1h-2z" fill="currentColor" />
    </svg>
  );
}

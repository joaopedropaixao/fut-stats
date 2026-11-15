import { PixelDigits } from '../../components/ui/pixel-digits';
import { cn } from '../../lib/cn';
import { trendLabel } from './ranking-text';

/** Triângulo pixel (▲ / ▼): forma, nunca só cor. */
function Triangle({ up }: { up: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0 fill-current">
      {up ? <path d="M12 4l9 15H3z" /> : <path d="M12 20L3 5h18z" />}
    </svg>
  );
}

/**
 * Tendência com a última rodada: ▲ 2 (subiu), ▼ 1 (desceu) ou = (igual). O número vem da API; o nome para leitor de
 * tela diz para onde foi ("subiu 2 posições"). Cor com forma e número junto (daltonismo).
 */
export function TrendMark({ trend, className }: { trend: number; className?: string }) {
  const tone = trend > 0 ? 'text-success' : trend < 0 ? 'text-[#f87171]' : 'text-text-muted';
  return (
    <span className={cn('inline-flex h-4.5 items-center gap-1', tone, className)}>
      <span className="sr-only">{trendLabel(trend)}</span>
      {trend === 0 ? (
        <span aria-hidden className="flex w-3 shrink-0 flex-col gap-0.75">
          <span className="h-0.5 bg-current" />
          <span className="h-0.5 bg-current" />
        </span>
      ) : (
        <>
          <Triangle up={trend > 0} />
          <PixelDigits value={Math.abs(trend)} scale={2} decorative />
        </>
      )}
    </span>
  );
}

import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

type MeterProps = {
  voted: number;
  total: number;
  /** Mostra "Faltam N" embaixo (a tela de votar; o card do início é mais enxuto). */
  showMissing?: boolean;
  /** A cor da barra: verde (padrão) ou a cor do card de quem a usa (laranja ou o prata da votação). */
  tone?: 'success' | 'warning' | 'silver';
  className?: string;
};

/** Medidor da votação: a barra verde e "9 de 16 já votaram". O texto diz o número; a barra só acompanha. */
export function Meter({ voted, total, showMissing, tone = 'success', className }: MeterProps) {
  const pct = total > 0 ? Math.min(100, Math.round((voted / total) * 100)) : 0;
  const missing = Math.max(0, total - voted);
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div
        role="meter"
        aria-label="Quem já votou"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={voted}
        aria-valuetext={`${voted} de ${total} já votaram`}
        className="relative h-2 bg-track"
      >
        <div
          className={cn(
            'absolute inset-y-0 left-0',
            { success: 'bg-success', warning: 'bg-warning', silver: 'bg-silver' }[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <PixelText wrap>{`${voted} de ${total} já votaram`}</PixelText>
        {showMissing && missing > 0 && (
          <PixelText className="text-text-muted">{`Faltam ${missing}`}</PixelText>
        )}
      </div>
    </div>
  );
}

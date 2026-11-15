import type { ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

/** O quadro de cada passo de votar: grande momento (contorno de 3px, sombra dura, entrada em degraus). */
export function StepCard({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      className={cn(
        'moment-frame animate-moment-in flex flex-col gap-5 bg-surface-raised p-4',
        className,
      )}
    >
      {children}
    </section>
  );
}

/** A barra de progresso do passo: fina, creme sobre o trilho. */
export function StepBar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div aria-hidden className="relative h-1.5 bg-track">
      <div className="absolute inset-y-0 left-0 bg-text" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** "Passo 1 de 2" e a barra. */
export function StepHeader({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex flex-col gap-3">
      <PixelText>{`Passo ${step} de 2`}</PixelText>
      <StepBar done={step} total={2} />
    </div>
  );
}

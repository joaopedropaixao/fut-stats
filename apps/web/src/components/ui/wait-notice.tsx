import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

/**
 * Aviso de espera: borda dourada e um quadradinho que pisca em degraus (parado com Reduzir movimento). Usado no
 * "Acordando o servidor" do Gerar times e no "Pode levar até 1 min" da tela de servidor iniciando. Quem usa põe o
 * aviso dentro de uma região `aria-live="polite"` que já existe, para o leitor de tela anunciar quando ele entra.
 */
export function WaitNotice({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  /** Mais folga dos lados (a tela de servidor iniciando, como no desenho). */
  wide?: boolean;
}) {
  return (
    <p
      data-testid="slow-wait"
      className={cn(
        'animate-menu-in flex items-center gap-2.5 bg-surface-raised py-2.5',
        wide ? 'px-4' : 'px-3',
        'text-sm font-semibold text-text shadow-[inset_0_0_0_2px_var(--color-gold)]',
        className,
      )}
    >
      <span
        aria-hidden
        className="animate-live-blink size-2.5 shrink-0 bg-gold-light shadow-[0_0_0_2px_var(--color-outline)] motion-reduce:animate-none"
      />
      {children}
    </p>
  );
}

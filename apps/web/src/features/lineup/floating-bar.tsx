import type { ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

/** Aviso que flutua acima da barra de abas, na mesma altura do `Notice`: mostra o jogador "na mão". */
export function FloatingBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-(--z-toast) px-4">
      <div
        role="status"
        className="pointer-events-auto mx-auto flex min-h-14 max-w-mobile items-center gap-3 bg-surface-3 py-1.5 pr-2 pl-3 shadow-float transition-[opacity,translate] duration-(--duration-normal) ease-out starting:translate-y-2 starting:opacity-0"
      >
        {children}
      </div>
    </div>
  );
}

/** Ação de texto dentro do aviso (44px de toque). */
export function FloatingAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('inline-flex h-11 shrink-0 items-center px-2 text-text')}
    >
      <PixelText>{label}</PixelText>
    </button>
  );
}

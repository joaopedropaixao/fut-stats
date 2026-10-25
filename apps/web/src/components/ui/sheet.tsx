import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { PixelText } from './pixel-text';

/** Fechar leva 100 ms (o dono achou a descida lenta); abrir leva 180 ms (ver `animate-sheet-up`). */
const CLOSE_MS = 100;

type SheetProps = {
  title: string;
  /** Texto de apoio (Chakra Petch 16). */
  children?: ReactNode;
  /**
   * Os dois botões da gaveta (Voltar + ação). Como função, recebe `close`: fecha com a animação e depois
   * chama `onClose`. Chamar `onClose` direto desmonta a gaveta na hora, sem animar.
   */
  actions: ReactNode | ((close: () => void) => ReactNode);
  onClose: () => void;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Gaveta de confirmação (DS): sobe de baixo sobre um véu escuro em 180 ms e desce em 100 ms. Esc e toque no véu
 * fecham. A gaveta de ação (confirmar) deve fechar na hora e deixar a chamada seguir: quem espera a rede para
 * descer parece travado.
 */
export function Sheet({ title, children, actions, onClose }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  const close = useCallback(() => setClosing(true), []);

  // Pediu para fechar: desce em 100 ms e então avisa quem abriu (sem animar com "reduzir movimento")
  useEffect(() => {
    if (!closing) return;
    if (prefersReducedMotion()) {
      onCloseRef.current();
      return;
    }
    const timer = setTimeout(() => onCloseRef.current(), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [close]);

  return createPortal(
    <div className="fixed inset-0 z-(--z-sheet)">
      <div
        className={cn(
          'absolute inset-0 bg-scrim',
          closing ? 'animate-scrim-out' : 'animate-scrim-in',
        )}
        onClick={close}
        aria-hidden
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'absolute inset-x-0 bottom-0 mx-auto flex max-w-mobile flex-col gap-3 bg-surface-3 px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[inset_0_0_0_2px_var(--color-border-strong)]',
          closing ? 'animate-sheet-down' : 'animate-sheet-up',
        )}
      >
        <span aria-hidden className="h-1 w-10 self-center bg-border-strong" />
        <PixelText as="h2" size={24} wrap className="pt-1">
          {title}
        </PixelText>
        {children && <div className="text-base text-text-muted">{children}</div>}
        <div className="flex gap-3 pt-1">
          {typeof actions === 'function' ? actions(close) : actions}
        </div>
      </div>
    </div>,
    document.body,
  );
}

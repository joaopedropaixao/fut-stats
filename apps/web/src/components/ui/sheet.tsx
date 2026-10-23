import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PixelText } from './pixel-text';

type SheetProps = {
  title: string;
  /** Texto de apoio em Inter 16. */
  children?: ReactNode;
  /** Os dois botões da gaveta (Voltar + ação). */
  actions: ReactNode;
  onClose: () => void;
};

/** Gaveta de confirmação (DS): sobe de baixo sobre um véu escuro. Esc e toque no véu fecham. */
export function Sheet({ title, children, actions, onClose }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-(--z-sheet)">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-mobile flex-col gap-3 bg-surface-3 px-5 pt-3 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[inset_0_0_0_2px_var(--color-border-strong)]"
      >
        <span aria-hidden className="h-1 w-10 self-center bg-border-strong" />
        <PixelText as="h2" size={24} wrap className="pt-1">
          {title}
        </PixelText>
        {children && <div className="text-base text-text-muted">{children}</div>}
        <div className="flex gap-3 pt-1">{actions}</div>
      </div>
    </div>,
    document.body,
  );
}

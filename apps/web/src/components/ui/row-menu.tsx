import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '../../lib/cn';
import { Icon, type IconName } from './icons';
import { PixelText } from './pixel-text';

/** Um item do menu ⋯ de uma linha (quadro flutuante da folha: Menu do jogador). */
export function MenuItem({
  icon,
  label,
  className,
  onClick,
}: {
  icon: IconName;
  label: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex h-13 items-center gap-3 px-4 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none',
        className,
      )}
    >
      <Icon name={icon} size={20} strokeWidth={2.2} />
      <PixelText>{label}</PixelText>
    </button>
  );
}

/** Esc ou um toque fora da linha fecham o menu aberto. */
function useMenuDismiss(open: boolean, close: () => void, ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onEvent = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      close();
    };
    document.addEventListener('pointerdown', onEvent);
    document.addEventListener('keydown', onEvent);
    return () => {
      document.removeEventListener('pointerdown', onEvent);
      document.removeEventListener('keydown', onEvent);
    };
  }, [open, close, ref]);
}

type RowMenuProps = {
  /** Nome da pessoa da linha, para o leitor de tela ("Mais opções de Beto"). */
  label: string;
  /** O que o menu tem; cada `MenuItem` fecha o menu ao ser tocado (use `close`). */
  children: (close: () => void) => ReactNode;
  className?: string;
};

/** O botão ⋯ (alvo de 44 x 44) e o quadro flutuante que ele abre. */
export function RowMenu({ label, children, className }: RowMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);
  useMenuDismiss(open, () => setOpen(false), ref);

  return (
    <div ref={ref} className={cn('relative shrink-0', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex size-11 items-center justify-center shadow-card active:bg-highlight"
      >
        <Icon name="more" size={20} />
      </button>
      {open && (
        <div
          role="menu"
          className="animate-menu-in absolute top-full right-0 z-(--z-sheet) mt-1 flex w-72 max-w-[calc(100vw-32px)] flex-col bg-surface-3 shadow-float"
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

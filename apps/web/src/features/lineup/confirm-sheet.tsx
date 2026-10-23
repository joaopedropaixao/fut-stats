import { useEffect, useId, useRef, type ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';

type ConfirmSheetProps = {
  title: string;
  /** Texto corrido de apoio. */
  message: string;
  /** Aparece entre o texto e os botões (ex.: o erro da última tentativa). */
  notice?: ReactNode;
  /**
   * Os dois botões, lado a lado: cancelar à esquerda, confirmar à direita. Se os rótulos não couberem
   * juntos, cada um ocupa a linha toda, com o de confirmar em cima.
   */
  children: ReactNode;
  onClose: () => void;
};

/** Gaveta de confirmação da folha: sobe da base com a tela escurecida atrás. Esc ou toque fora fecha. */
export function ConfirmSheet({ title, message, notice, onClose, children }: ConfirmSheetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const previous = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-(--z-sheet) flex items-end bg-scrim transition-opacity duration-(--duration-normal) ease-out starting:opacity-0"
      onClick={onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="mx-auto flex w-full max-w-content flex-col transition-transform duration-(--duration-normal) ease-out starting:translate-y-full gap-3 bg-surface-3 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-card outline-none"
      >
        <span aria-hidden className="h-1 w-10 self-center bg-border-strong" />
        <div id={titleId} className="pt-1">
          <PixelText as="h2" size={24} wrap>
            {title}
          </PixelText>
        </div>
        <p id={messageId} className="text-base text-text-muted">
          {message}
        </p>
        {notice}
        <div className="flex flex-wrap-reverse gap-3 pt-1 *:grow *:basis-0">{children}</div>
      </div>
    </div>
  );
}

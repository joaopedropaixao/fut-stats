import { useEffect, useRef, type ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { Surface } from '../../components/ui/surface';

type ConfirmSheetProps = {
  title: string;
  /** Botões da gaveta (confirmar e cancelar). */
  children: ReactNode;
  /** Texto corrido de apoio. */
  message: string;
  onClose: () => void;
};

/** Gaveta de confirmação: sobe da base com a tela escurecida atrás. Esc ou toque fora fecha. */
export function ConfirmSheet({ title, message, onClose, children }: ConfirmSheetProps) {
  const ref = useRef<HTMLDivElement>(null);

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
    <div className="fixed inset-0 z-(--z-sheet) flex items-end bg-scrim" onClick={onClose}>
      <div
        className="mx-auto w-full max-w-content px-2 pb-[max(8px,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <Surface level={3} className="p-4">
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-sheet-title"
            tabIndex={-1}
            className="flex flex-col gap-4 outline-none"
          >
            <div id="confirm-sheet-title">
              <PixelText as="h2" size={24} wrap>
                {title}
              </PixelText>
            </div>
            <p className="text-base text-text-muted">{message}</p>
            <div className="flex flex-col gap-3">{children}</div>
          </div>
        </Surface>
      </div>
    </div>
  );
}

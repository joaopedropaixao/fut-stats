import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './button';
import { PixelText } from './pixel-text';

type SheetProps = {
  open: boolean;
  /** Pergunta em pixel 24 ("Encerrar o jogo?"). */
  title: string;
  /** Fechar sem confirmar (Voltar, Esc ou toque no fundo). */
  onClose: () => void;
  children: ReactNode;
};

/**
 * Gaveta de baixo para cima (DS v1.3): fundo escurecido, alça, título em pixel 24 e o conteúdo.
 * Usa o <dialog> nativo: o navegador prende o foco, fecha com Esc e devolve o foco a quem abriu.
 */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 mx-auto max-h-[85dvh] w-full max-w-mobile overflow-y-auto bg-transparent p-0 text-text backdrop:bg-scrim"
    >
      {open && (
        <div className="flex flex-col gap-3 bg-surface-3 px-5 pt-3 pb-5 shadow-card">
          <div aria-hidden className="h-1 w-10 self-center bg-border-strong" />
          <PixelText as="h2" size={24} wrap className="pt-1 leading-[34px]">
            {title}
          </PixelText>
          {children}
        </div>
      )}
    </dialog>
  );
}

type ConfirmSheetProps = Pick<SheetProps, 'open' | 'title' | 'onClose'> & {
  /** Explicação em Inter 16. */
  message: string;
  cancelLabel?: string;
  confirmLabel: string;
  /** Confirmar é a tecla amarela, a menos que seja destrutivo (`danger`). */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};

/** Gaveta de confirmação: explica o que vai acontecer, "Voltar" e a ação. */
export function ConfirmSheet({
  message,
  cancelLabel = 'Voltar',
  confirmLabel,
  danger,
  loading,
  onConfirm,
  ...sheet
}: ConfirmSheetProps) {
  return (
    <Sheet {...sheet}>
      <p className="text-base text-text-muted">{message}</p>
      <div className="flex gap-3 pt-1">
        <Button
          variant="outline"
          size={52}
          label={cancelLabel}
          className="flex-1"
          onClick={sheet.onClose}
        />
        <Button
          variant={danger ? 'danger' : 'primary'}
          size={52}
          icon={danger ? 'trash' : undefined}
          label={confirmLabel}
          className="flex-1"
          loading={loading}
          onClick={onConfirm}
        />
      </div>
    </Sheet>
  );
}

import { createPortal } from 'react-dom';
import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

export type NoticeKind = 'success' | 'error';

export type NoticeData = {
  kind: NoticeKind;
  /** Título curto em pixel ("Presença confirmada"). */
  title: string;
  /** Explicação em Inter, para erro da API. */
  message?: string;
  /** "Desfazer": chamado uma vez, e o aviso fecha. */
  onUndo?: () => void;
};

type NoticeProps = NoticeData & { onClose: () => void };

/** Aviso que flutua acima da barra de abas, com ícone e título que dizem o tipo (cor nunca é o único sinal). */
export function Notice({ kind, title, message, onUndo, onClose }: NoticeProps) {
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-(--z-toast) px-4">
      <div
        role={kind === 'error' ? 'alert' : 'status'}
        className={cn(
          'pointer-events-auto mx-auto flex min-h-14 max-w-mobile items-center gap-3 bg-surface-3 py-1.5 pr-2 pl-4 shadow-float',
        )}
      >
        <span
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-full',
            kind === 'success' ? 'bg-success text-[#04210F]' : 'bg-danger text-white',
          )}
        >
          <Icon name={kind === 'success' ? 'check' : 'x'} size={14} strokeWidth={3} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 py-1">
          <PixelText wrap>{title}</PixelText>
          {message && <p className="text-sm text-text-muted">{message}</p>}
        </div>
        {onUndo ? (
          <button
            type="button"
            className="inline-flex h-11 items-center px-2 text-accent"
            onClick={() => {
              onUndo();
              onClose();
            }}
          >
            <PixelText>Desfazer</PixelText>
          </button>
        ) : (
          <button
            type="button"
            aria-label="Fechar aviso"
            className="inline-flex size-11 items-center justify-center"
            onClick={onClose}
          >
            <Icon name="x" size={18} />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

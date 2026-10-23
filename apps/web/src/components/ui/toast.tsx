import { useEffect } from 'react';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

export type ToastData = {
  /** O que aconteceu, inteiro e sem abreviar. */
  text: string;
  /** `error` troca o ícone de ✓ por ! (cor nunca é o único sinal). */
  kind?: 'success' | 'error';
  /** Ação à direita ("Desfazer"), em amarelo. */
  action?: { label: string; onClick: () => void };
};

type ToastProps = {
  data: ToastData;
  onDismiss: () => void;
  /** Some sozinho depois disto (ms). */
  duration?: number;
};

/** Aviso que flutua acima da barra de abas, com "Desfazer" quando a ação dá para voltar. */
export function Toast({ data, onDismiss, duration = 6000 }: ToastProps) {
  const { text, kind = 'success', action } = data;
  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
    // `data` muda a cada aviso novo (mesmo com o mesmo texto): o tempo recomeça
  }, [data, duration, onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] z-(--z-toast) px-4">
      <div
        role={kind === 'error' ? 'alert' : 'status'}
        className="mx-auto flex min-h-14 max-w-mobile items-center gap-3 bg-surface-3 py-1.5 pr-2 pl-4 shadow-float"
      >
        <span
          className={`inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[#04210F] ${
            kind === 'error' ? 'bg-danger' : 'bg-success'
          }`}
        >
          <Icon name={kind === 'error' ? 'alert' : 'check'} size={14} strokeWidth={3} />
        </span>
        <p className="flex-1 text-base font-semibold">{text}</p>
        {action && (
          <button
            type="button"
            onClick={() => {
              action.onClick();
              onDismiss();
            }}
            className="inline-flex h-11 shrink-0 items-center px-2 text-accent"
          >
            <PixelText>{action.label}</PixelText>
          </button>
        )}
      </div>
    </div>
  );
}

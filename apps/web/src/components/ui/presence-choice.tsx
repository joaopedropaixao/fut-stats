import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

type PresenceChoiceProps = {
  /** `true` = Vou, `false` = Não vou, `null` = ainda não respondeu. */
  value: boolean | null;
  onChange: (confirmed: boolean) => void;
  /** Trava os dois (prazo vencido ou sem permissão). */
  disabled?: boolean;
};

/**
 * Presença do DS: CONFIRMAR e AUSÊNCIA empilhados, 64px cada, dentro de um trilho. A resposta atual fica
 * preenchida e com o ícone ✓ ou ×; a outra, só no contorno. Cor nunca é o único sinal.
 */
export function PresenceChoice({ value, onChange, disabled }: PresenceChoiceProps) {
  return (
    <div role="group" aria-label="Sua presença" className="flex flex-col gap-1 bg-bg p-1">
      <button
        type="button"
        aria-pressed={value === true}
        disabled={disabled}
        onClick={() => onChange(true)}
        className={cn(
          'flex h-16 items-center justify-center gap-3 transition-colors duration-(--duration-fast) ease-out',
          disabled && 'opacity-60',
          value === true
            ? 'bg-success text-[#04210F] shadow-[inset_0_0_0_2px_#000]'
            : 'text-[#86efac] shadow-[inset_0_0_0_2px_var(--color-success)]',
        )}
      >
        <Icon name="check" size={24} strokeWidth={3} />
        <PixelText size={24}>Confirmar</PixelText>
      </button>
      <button
        type="button"
        aria-pressed={value === false}
        disabled={disabled}
        onClick={() => onChange(false)}
        className={cn(
          'flex h-16 items-center justify-center gap-3 text-[#f87171] transition-colors duration-(--duration-fast) ease-out',
          disabled && 'opacity-60',
          value === false
            ? 'bg-danger/20 shadow-[inset_0_0_0_4px_var(--color-danger)]'
            : 'shadow-[inset_0_0_0_2px_var(--color-danger)]',
        )}
      >
        <Icon name="x" size={24} strokeWidth={3} />
        <PixelText size={24}>Ausência</PixelText>
      </button>
    </div>
  );
}

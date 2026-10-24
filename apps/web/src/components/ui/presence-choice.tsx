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
 * chapada (verde ou vermelho) com o ícone ✓ ou ×; a outra recua, só no contorno. Cor nunca é o único sinal.
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
          value === false && 'opacity-55',
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
          'flex h-16 items-center justify-center gap-3 transition-colors duration-(--duration-fast) ease-out',
          disabled && 'opacity-60',
          value === false
            ? 'bg-danger text-[#2a0606] shadow-[inset_0_0_0_2px_#000]'
            : 'text-[#f87171] shadow-[inset_0_0_0_2px_var(--color-danger)]',
          value === true && 'opacity-55',
        )}
      >
        <Icon name="x" size={24} strokeWidth={3} />
        <PixelText size={24}>Ausência</PixelText>
      </button>
    </div>
  );
}

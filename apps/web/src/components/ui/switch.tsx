import { useId } from 'react';
import { cn } from '../../lib/cn';
import { Icon, Spinner } from './icons';
import { PixelText } from './pixel-text';

type SwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Travado: o estado aparece, não muda, e o `hint` diz por quê (cadeado, não só cor). */
  disabled?: boolean;
  /** Esperando a resposta: o botão não responde ao toque e a bolinha vira a rodinha. */
  loading?: boolean;
  hint?: string;
  /** Com `loading`: escreve isto (com a rodinha) no lugar de Ligado/Desligado, para a espera não parecer "desligado". */
  loadingLabel?: string;
  className?: string;
};

/**
 * Interruptor com linha: o nome, o estado escrito (✓ LIGADO / × DESLIGADO) e o botão.
 * Cor nunca é o único sinal. Área de toque de 80 x 48.
 */
export function Switch({
  label,
  checked,
  onCheckedChange,
  disabled,
  loading,
  hint,
  loadingLabel,
  className,
}: SwitchProps) {
  const labelId = useId();
  const hintId = useId();

  return (
    <div className={cn('flex min-h-19 items-center justify-between gap-3 px-4 py-3', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <PixelText wrap>{label}</PixelText>
        <span
          id={labelId}
          className={cn('flex items-center gap-1.5', checked ? 'text-success' : 'text-text-muted')}
        >
          {loading && loadingLabel ? (
            <>
              <Spinner size={14} />
              <PixelText>{loadingLabel}</PixelText>
            </>
          ) : (
            <>
              <Icon name={checked ? 'check' : 'x'} size={14} strokeWidth={3} />
              <PixelText>{checked ? 'Ligado' : 'Desligado'}</PixelText>
            </>
          )}
        </span>
        {hint && (
          <p id={hintId} className="flex items-start gap-1.5 text-caption text-text-muted">
            {disabled && <Icon name="lock" size={14} className="mt-0.5 shrink-0" />}
            {hint}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={hint ? `${labelId} ${hintId}` : labelId}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        onClick={() => onCheckedChange(!checked)}
        className="flex h-12 w-20 shrink-0 items-center justify-center disabled:opacity-60"
      >
        <span
          className={cn(
            'relative h-10 w-19 transition-colors duration-(--duration-normal) ease-out',
            checked ? 'bg-success shadow-[inset_0_0_0_2px_#000]' : 'bg-surface-3 shadow-card',
          )}
        >
          {checked ? (
            <Icon
              name="check"
              size={20}
              strokeWidth={3}
              className="absolute top-2.5 left-2.5 text-[#04210f]"
            />
          ) : (
            <Icon
              name="x"
              size={20}
              strokeWidth={2.6}
              className="absolute top-2.5 right-2.5 text-text-muted"
            />
          )}
          <span
            className={cn(
              'absolute top-1 size-8 bg-text shadow-[inset_0_0_0_3px_#000]',
              'transition-[left] duration-(--duration-normal) ease-out',
              checked ? 'left-10' : 'left-1',
            )}
          >
            {loading && (
              <span className="absolute inset-0 flex items-center justify-center text-[#000]">
                <Spinner size={16} />
              </span>
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

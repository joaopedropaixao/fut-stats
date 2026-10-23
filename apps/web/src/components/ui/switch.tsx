import { useId } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

type SwitchProps = {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
};

/**
 * Interruptor com linha: o nome, o estado escrito (✓ LIGADO / × DESLIGADO) e o botão.
 * Cor nunca é o único sinal. Área de toque de 80 x 48.
 */
export function Switch({ label, checked, onCheckedChange, className }: SwitchProps) {
  const labelId = useId();

  return (
    <div className={cn('flex min-h-19 items-center justify-between gap-3 px-4 py-3', className)}>
      <div className="flex flex-col gap-1.5">
        <PixelText>{label}</PixelText>
        <span
          id={labelId}
          className={cn('flex items-center gap-1.5', checked ? 'text-success' : 'text-text-muted')}
        >
          <Icon name={checked ? 'check' : 'x'} size={14} strokeWidth={3} />
          <PixelText>{checked ? 'Ligado' : 'Desligado'}</PixelText>
        </span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        aria-describedby={labelId}
        onClick={() => onCheckedChange(!checked)}
        className="flex h-12 w-20 shrink-0 items-center justify-center"
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
          />
        </span>
      </button>
    </div>
  );
}

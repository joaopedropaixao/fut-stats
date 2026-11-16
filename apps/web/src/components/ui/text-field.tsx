import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  /** Rótulo em pixel, acima do campo. */
  label: string;
  /** Explicação curta abaixo (Inter 13). */
  hint?: string;
  /** Mensagem de erro: troca o contorno e aparece no lugar da explicação. */
  error?: string;
  /** Contador de caracteres ("12/60") no canto de baixo; fica vermelho quando passa do máximo. */
  counter?: FieldCounterValue;
};

export type FieldCounterValue = { current: number; max: number };

/** O "12/60" do canto: o leitor de tela só ouve quando passa do máximo (o erro já fala). */
export function FieldCounter({ current, max }: FieldCounterValue) {
  return (
    <span
      className={cn(
        'shrink-0 text-caption tabular-nums',
        current > max ? 'text-[#fca5a5]' : 'text-text-muted',
      )}
      aria-hidden
    >
      {`${current}/${max}`}
    </span>
  );
}

/** A nota de baixo do campo (explicação ou erro) e o contador, lado a lado. */
export function FieldNote({
  id,
  error,
  hint,
  counter,
}: {
  id: string;
  error?: string;
  hint?: string;
  counter?: FieldCounterValue;
}) {
  const note = error ?? hint;
  if (!note && !counter) return null;
  return (
    <div className="flex items-start justify-between gap-3">
      {note ? (
        <p
          id={id}
          role={error ? 'alert' : undefined}
          className={cn('text-caption', error ? 'text-[#fca5a5]' : 'text-text-muted')}
        >
          {note}
        </p>
      ) : (
        <span />
      )}
      {counter && <FieldCounter {...counter} />}
    </div>
  );
}

/** Campo de texto: o que a pessoa digita fica em Inter. */
export function TextField({ label, hint, error, counter, className, ...rest }: TextFieldProps) {
  const id = useId();
  const noteId = `${id}-nota`;
  const note = error ?? hint;

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id}>
        <PixelText>{label}</PixelText>
      </label>
      <div className="relative">
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={note ? noteId : undefined}
          className={cn(
            'h-13 w-full bg-surface px-4 text-base text-text caret-accent outline-none',
            'placeholder:text-text-muted',
            error
              ? 'pr-12 shadow-[inset_0_0_0_2px_var(--color-danger)] focus:shadow-[inset_0_0_0_2px_var(--color-danger),0_0_0_4px_rgb(239_68_68/24%)]'
              : 'shadow-card focus:shadow-[inset_0_0_0_2px_var(--color-text),0_0_0_4px_rgb(243_234_211/14%)]',
          )}
          {...rest}
        />
        {error && (
          <Icon
            name="error"
            size={20}
            strokeWidth={2.2}
            className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[#f87171]"
          />
        )}
      </div>
      <FieldNote id={noteId} error={error} hint={hint} counter={counter} />
    </div>
  );
}

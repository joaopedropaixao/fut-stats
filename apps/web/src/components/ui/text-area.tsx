import { useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { FieldNote, type FieldCounterValue } from './text-field';
import { PixelText } from './pixel-text';

type TextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  /** Rótulo em pixel, acima do campo. */
  label: string;
  /** Explicação curta abaixo. */
  hint?: string;
  /** Mensagem de erro: troca o contorno e aparece no lugar da explicação. */
  error?: string;
  /** Contador de caracteres ("120/1000"). */
  counter?: FieldCounterValue;
  /** Esconde o rótulo (o leitor de tela ainda lê): campo curto dentro de um card, como o do comentário. */
  hideLabel?: boolean;
};

/** Campo de texto de várias linhas, no padrão do `TextField` (foco, erro e contador). O texto fica em Chakra Petch. */
export function TextArea({
  label,
  hint,
  error,
  counter,
  hideLabel,
  className,
  rows = 5,
  ...rest
}: TextAreaProps) {
  const id = useId();
  const noteId = `${id}-nota`;
  const hasNote = Boolean(error ?? hint);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        <PixelText>{label}</PixelText>
      </label>
      <div className="relative">
        <textarea
          id={id}
          rows={rows}
          aria-invalid={error ? true : undefined}
          aria-describedby={hasNote ? noteId : undefined}
          className={cn(
            'block w-full resize-none bg-surface px-4 py-3 text-base text-text caret-accent outline-none [overflow-wrap:anywhere]',
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
            className="pointer-events-none absolute top-3 right-4 text-[#f87171]"
          />
        )}
      </div>
      <FieldNote id={noteId} error={error} hint={hint} counter={counter} />
    </div>
  );
}

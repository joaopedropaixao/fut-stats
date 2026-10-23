import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Icon, Spinner, type IconName } from './icons';
import { PixelText } from './pixel-text';

/**
 * - primary: a tecla amarela. **Uma por tela**, só para a ação que importa.
 * - secondary: superfície que flutua (contorno + sombra dura).
 * - outline: só contorno.
 * - danger: remover, encerrar; sempre com ícone (cor nunca é o único sinal).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
/** Altura: 56 (padrão da tecla), 52 (secundários), 48 e 44 (mínimo de toque). */
export type ButtonSize = 56 | 52 | 48 | 44;

const PRESS = 'active:translate-x-1 active:translate-y-1';

const VARIANT: Record<ButtonVariant, string> = {
  primary: cn(
    'bg-accent text-on-accent shadow-key',
    'active:bg-accent-pressed active:shadow-key-pressed',
    // Foco da folha: o anel creme fica na sombra (as outras variantes usam o contorno global de :focus-visible)
    'focus-visible:outline-none',
    'focus-visible:shadow-[inset_0_0_0_3px_#000,0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-text)]',
    PRESS,
  ),
  secondary: cn('bg-surface-raised text-text shadow-float active:shadow-card', PRESS),
  outline: 'text-text shadow-card active:bg-highlight',
  // Tons claros do vermelho vêm da folha (texto e ícone legíveis sobre o fundo escuro)
  danger:
    'bg-danger/14 text-[#fca5a5] shadow-[inset_0_0_0_2px_var(--color-danger)] active:bg-danger/24',
};

const DISABLED = 'bg-surface text-disabled shadow-none';

type ButtonStyleOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  disabled?: boolean;
  className?: string;
};

function buttonClasses({
  variant = 'primary',
  size = variant === 'primary' ? 56 : 52,
  block,
  disabled,
  className,
}: ButtonStyleOptions) {
  return cn(
    'inline-flex items-center justify-center gap-2 px-4 select-none',
    'transition-[translate,background-color,box-shadow] duration-(--duration-fast) ease-out',
    { 56: 'h-14', 52: 'h-13', 48: 'h-12', 44: 'h-11' }[size],
    block && 'w-full',
    disabled ? DISABLED : VARIANT[variant],
    className,
  );
}

function Content({
  label,
  icon,
  variant,
  loading,
  disabled,
}: {
  label: string;
  icon?: IconName;
  variant: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const iconColor = variant === 'danger' && !disabled ? 'text-[#f87171]' : undefined;
  return (
    <>
      {loading ? (
        <Spinner />
      ) : disabled ? (
        <Icon name="lock" size={16} />
      ) : icon ? (
        <Icon name={icon} size={18} className={cn('shrink-0', iconColor)} />
      ) : null}
      <PixelText>{label}</PixelText>
    </>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> &
  Omit<ButtonStyleOptions, 'disabled'> & {
    /** Rótulo inteiro, sem abreviar; se não couber, use `block`. */
    label: string;
    icon?: IconName;
    loading?: boolean;
  };

export function Button({
  label,
  icon,
  loading,
  variant = 'primary',
  size,
  block,
  disabled,
  className,
  type = 'button',
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      // Carregando não usa `disabled`: o botão continua focável e o foco não cai para o <body>
      disabled={disabled}
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={loading ? (e) => e.preventDefault() : onClick}
      className={buttonClasses({
        variant,
        size,
        block,
        // Carregando continua amarelo; só o desabilitado de verdade fica apagado
        disabled,
        className,
      })}
      {...rest}
    >
      <Content label={label} icon={icon} variant={variant} loading={loading} disabled={disabled} />
    </button>
  );
}

type ButtonLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children'> &
  Omit<ButtonStyleOptions, 'disabled'> & { label: string; icon?: IconName };

/** Botão que navega com recarga de página (ex.: /api/auth/google). Para rota interna, use o Link do router. */
export function ButtonLink({
  label,
  icon,
  variant = 'primary',
  size,
  block,
  className,
  ...rest
}: ButtonLinkProps) {
  return (
    <a className={buttonClasses({ variant, size, block, className })} {...rest}>
      <Content label={label} icon={icon} variant={variant} />
    </a>
  );
}

type IconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  icon: IconName;
  /** Nome para leitor de tela (obrigatório: o botão só tem ícone). */
  label: string;
};

/** Botão só de ícone: 44 x 44, flutua. */
export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center bg-surface-raised text-text shadow-float',
        'transition-[translate,box-shadow] duration-(--duration-fast) ease-out',
        'active:translate-x-1 active:translate-y-1 active:shadow-card',
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={20} />
    </button>
  );
}

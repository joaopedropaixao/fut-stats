import { cn } from '../../lib/cn';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

/**
 * Selos da folha. Prêmio é ouro, zoeira é madeira; nenhum brilha.
 * Craque, Perna de Pau e prazo vêm com ícone: cor nunca é o único sinal.
 */
export type BadgeVariant = 'white' | 'black' | 'craque' | 'flop' | 'neutral' | 'deadline';

const VARIANT: Record<BadgeVariant, string> = {
  white: 'bg-team-white text-team-black shadow-[inset_0_0_0_2px_var(--color-team-white)]',
  black: 'bg-team-black text-team-white shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]',
  craque: 'bg-gold/14 text-gold shadow-[inset_0_0_0_2px_var(--color-gold)]',
  flop: 'bg-flop/14 text-flop shadow-[inset_0_0_0_2px_var(--color-flop)]',
  neutral: 'text-text shadow-card',
  deadline: 'text-text shadow-card',
};

function Star() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden className="shrink-0 fill-gold">
      <path d="M12 2l3 6.9 7.5.7-5.7 5 1.7 7.4L12 18l-6.5 4 1.7-7.4-5.7-5 7.5-.7z" />
    </svg>
  );
}

/** Pernas de pau (ícone do Perna de Pau). */
function Stilts() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      aria-hidden
      className="shrink-0"
    >
      <path d="M5 2.5v19M15 2.5v19" />
      <path
        d="M5 9h2.6v3.6l2.6 1c.5.2.8.7.8 1.2v.7H5zM15 9h2.6v3.6l2.6 1c.5.2.8.7.8 1.2v.7H15z"
        fill="#b08d6a"
        strokeWidth="1.4"
      />
      <path d="M7.6 9V5.5M17.6 9V5.5" />
    </svg>
  );
}

type BadgeProps = {
  /** Texto inteiro, sem abreviar ("ZAGUEIRO", não "ZAG"). */
  label: string;
  variant?: BadgeVariant;
  className?: string;
};

export function Badge({ label, variant = 'neutral', className }: BadgeProps) {
  return (
    <span className={cn('inline-flex h-8 items-center gap-1.5 px-3', VARIANT[variant], className)}>
      {variant === 'craque' && <Star />}
      {variant === 'flop' && <Stilts />}
      {variant === 'deadline' && (
        <Icon name="clock" size={13} strokeWidth={2.4} className="shrink-0 text-warning" />
      )}
      <PixelText>{label}</PixelText>
    </span>
  );
}

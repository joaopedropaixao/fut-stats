import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ALERT_TONES, DIAGONAL_CUT, type AlertToneKey } from './alert-tone';
import { Icon, type IconName } from './icons';
import { PixelText } from './pixel-text';

/**
 * Moldura do aviso grande do Feed: grande momento (contorno de 3 px na cor do tipo, sombra dura, entrada em
 * degraus). Quem usa põe dentro uma `AlertBand` (cabeçalho) e o corpo, com a tecla amarela.
 */
export function AlertFrame({
  tone,
  label,
  children,
}: {
  tone: AlertToneKey;
  label: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={label}
      data-alert-card={tone}
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ borderColor: ALERT_TONES[tone].frame, boxShadow: '5px 5px 0 var(--color-shadow)' }}
    >
      {children}
    </section>
  );
}

/**
 * Faixa do cabeçalho na cor do tipo, com o traço de 3 px embaixo. Os times saíram: faixa preta e, no lugar do traço,
 * o corte diagonal do placar.
 */
export function AlertBand({
  tone,
  className,
  nowrap,
  children,
}: {
  tone: AlertToneKey;
  className?: string;
  /** Sem quebrar a linha da faixa (miniatura + título lado a lado). */
  nowrap?: boolean;
  children: ReactNode;
}) {
  const { band, bandImage, frame } = ALERT_TONES[tone];
  const teams = tone === 'TEAMS_PUBLISHED';
  return (
    <>
      <div
        className={cn(
          'flex items-center gap-x-3 gap-y-3 px-4 py-4',
          nowrap ? 'flex-nowrap' : 'flex-wrap',
          band,
          className,
        )}
        style={
          teams ? undefined : { boxShadow: `inset 0 -3px 0 0 ${frame}`, backgroundImage: bandImage }
        }
      >
        {children}
      </div>
      {teams && <div aria-hidden className="h-4" style={{ backgroundImage: DIAGONAL_CUT }} />}
    </>
  );
}

/** Ícone na cor do tipo e o título em pixel (h2). */
export function AlertTitle({
  tone,
  icon,
  children,
}: {
  tone: AlertToneKey;
  icon: IconName;
  children: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <Icon
        name={icon}
        size={28}
        strokeWidth={icon === 'check' ? 3 : 2}
        className={cn('shrink-0', ALERT_TONES[tone].ink)}
      />
      <PixelText as="h2" size={24} wrap className="text-text [text-shadow:2px_2px_0_#000]">
        {children}
      </PixelText>
    </span>
  );
}

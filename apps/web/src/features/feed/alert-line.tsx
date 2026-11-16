import type { FeedAlert, FeedAlertType } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { ALERT_TONES } from '../../components/ui/alert-tone';
import { Icon, type IconName } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { alertAriaLabel, alertText } from './alert-text';

const ICONS: Partial<Record<FeedAlertType, IconName>> = {
  RESULT: 'pack',
  VOTING: 'urn',
  PRESENCE: 'check',
  TEAMS_PUBLISHED: 'teams',
  POST_MATCH: 'pencil',
};

type AlertLineProps = {
  alert: FeedAlert;
  /** O resultado já aberto neste aparelho vira "Resultado · Rodada 12". */
  resultOpened?: boolean;
  /** Posição na pilha: escalona a entrada. */
  index?: number;
};

/**
 * Aviso em linha (56 px): faixa à esquerda e ícone na cor do tipo, o tipo escrito em pixel, a situação curta e a
 * seta. O contorno é neutro (2 px, sem amarelo nem a cor inteira: não briga com a tecla do aviso grande) e a
 * sombra é dura; entra deslizando em degraus. Toda a linha é o toque (≥ 44 px) e leva à tela do tipo.
 */
export function AlertLine({ alert, resultOpened = false, index = 0 }: AlertLineProps) {
  const text = alertText(alert, resultOpened);
  const tone = ALERT_TONES[alert.type];
  const icon = ICONS[alert.type];
  return (
    <Link
      to={text.to}
      aria-label={alertAriaLabel(text)}
      data-alert={alert.type}
      className="animate-row-in flex min-h-14 items-stretch gap-3 bg-surface-raised pr-3 active:translate-x-1 active:translate-y-1 active:shadow-none"
      style={
        {
          '--moment-delay': `${index * 80}ms`,
          boxShadow: 'inset 0 0 0 2px var(--color-border-strong), 3px 3px 0 var(--color-shadow)',
        } as CSSProperties
      }
    >
      <span aria-hidden className="w-2 shrink-0" style={{ background: tone.stripe }} />
      <span className="flex min-w-0 flex-1 items-center gap-3 py-2">
        <span className={`inline-flex size-7 shrink-0 items-center justify-center ${tone.ink}`}>
          {icon ? (
            <Icon name={icon} size={24} strokeWidth={alert.type === 'PRESENCE' ? 3 : 2} />
          ) : (
            <span
              aria-hidden
              className="animate-live-blink size-3 rounded-full bg-danger motion-reduce:animate-none"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <PixelText wrap>{text.title}</PixelText>
          <span className="text-caption text-text-muted">{text.situation}</span>
        </span>
        <Icon name="chevronRight" size={20} className="shrink-0 text-text-muted" />
      </span>
    </Link>
  );
}

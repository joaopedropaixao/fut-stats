import { TEAM_LABELS, type TeamBalance } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatAverage, whiteShare } from './balance-format';

/**
 * Card "Equilíbrio": média de cada time em dígitos pixel, barra Branco/Preto proporcional e um veredito em
 * texto e ícone. A conta vem do domain (`draftBalance`); aqui só se mostra.
 */
export function BalanceCard({ balance }: { balance: TeamBalance }) {
  const { WHITE: white, BLACK: black } = balance.average;
  const share = whiteShare(white, black);

  return (
    <section aria-label="Equilíbrio" className="flex flex-col gap-2.5 bg-surface p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <PixelText>{TEAM_LABELS.WHITE}</PixelText>
          <Average value={white} label={`Média do ${TEAM_LABELS.WHITE}`} />
        </span>
        <span className="flex items-center gap-2">
          <Average value={black} label={`Média do ${TEAM_LABELS.BLACK}`} />
          <PixelText>{TEAM_LABELS.BLACK}</PixelText>
        </span>
      </div>
      <div aria-hidden className="flex h-2 shadow-[0_0_0_1px_rgb(255_255_255/25%)]">
        <div className="bg-team-white" style={{ width: `${share}%` }} />
        <div className="bg-team-black" style={{ width: `${100 - share}%` }} />
      </div>
      <Verdict balance={balance} />
    </section>
  );
}

function Average({ value, label }: { value: number | null; label: string }) {
  return value === null ? (
    <PixelText className="text-text-muted">—</PixelText>
  ) : (
    <PixelDigits
      value={formatAverage(value)}
      scale={3}
      label={`${label}: ${formatAverage(value)}`}
    />
  );
}

function Verdict({ balance }: { balance: TeamBalance }) {
  const { balanced, difference, stronger } = balance;
  if (balanced === null || difference === null) {
    return (
      <p className="flex items-center gap-1.5 text-caption text-text-muted">
        Monte os dois times para comparar
      </p>
    );
  }
  return (
    <p className={cn('flex items-center gap-1.5 text-caption text-text-muted')}>
      {balanced ? (
        <Icon name="check" size={14} strokeWidth={2.6} className="shrink-0 text-success" />
      ) : (
        <Icon name="alert" size={14} className="shrink-0 text-warning" />
      )}
      {balanced
        ? `Equilibrado. Diferença de ${formatAverage(difference)}.`
        : `${stronger ? TEAM_LABELS[stronger] : 'Um time'} mais forte por ${formatAverage(difference)}.`}
    </p>
  );
}

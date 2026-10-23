import { Button } from './button';
import { Icon } from './icons';
import { PixelText } from './pixel-text';

type ErrorStateProps = {
  title: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
};

/** Erro com "Tentar de novo": o título diz o que falhou, a mensagem diz o que fazer. */
export function ErrorState({ title, message, onRetry, retrying }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 bg-danger/8 p-4 shadow-[inset_0_0_0_2px_var(--color-danger)]"
    >
      <div className="flex gap-3">
        <Icon name="alert" size={22} strokeWidth={2.2} className="shrink-0 text-[#f87171]" />
        <div className="flex flex-col gap-0.5">
          <p className="text-base font-semibold">{title}</p>
          <p className="text-sm text-text-muted">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button
          variant="outline"
          size={44}
          icon="redo"
          label="Tentar de novo"
          loading={retrying}
          onClick={onRetry}
        />
      )}
    </div>
  );
}

function SkeletonRow({ first, w1, w2 }: { first: boolean; w1: string; w2: string }) {
  return (
    <div
      className={
        first
          ? 'flex items-center gap-3 p-4'
          : 'flex items-center gap-3 p-4 shadow-[inset_0_2px_0_0_var(--color-border)]'
      }
    >
      <div className="size-10 shrink-0 rounded-full bg-surface-3 shadow-card" />
      <div className="flex flex-1 flex-col gap-2">
        <div className="h-4 bg-surface-3 shadow-card" style={{ width: w1 }} />
        <div className="h-3.5 bg-surface-3 shadow-card" style={{ width: w2 }} />
      </div>
      <div className="h-7 w-10 bg-surface-3 shadow-card" />
    </div>
  );
}

const WIDTHS = [
  ['62%', '38%'],
  ['48%', '30%'],
  ['56%', '34%'],
] as const;

/** Esqueleto de lista enquanto carrega. */
export function SkeletonList({
  rows = 2,
  label = 'Carregando',
}: {
  rows?: number;
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="flex flex-col bg-surface shadow-card">
      {Array.from({ length: rows }, (_, i) => {
        const [w1, w2] = WIDTHS[i % WIDTHS.length]!;
        return <SkeletonRow key={i} first={i === 0} w1={w1} w2={w2} />;
      })}
    </div>
  );
}

type EmptyStateProps = {
  /** O que não tem ("Nenhuma rodada marcada"). */
  title: string;
  /** O que vai acontecer ou o que fazer. */
  message: string;
};

/** Vazio: o campinho de giz da folha, com a bola parada. */
export function EmptyState({ title, message }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-8 text-center shadow-card">
      <svg
        width="96"
        height="56"
        viewBox="0 0 96 56"
        fill="none"
        stroke="rgb(255 255 255 / 28%)"
        strokeWidth="2"
        aria-hidden
      >
        <rect x="2" y="2" width="92" height="52" />
        <line x1="48" y1="2" x2="48" y2="54" />
        <circle cx="48" cy="28" r="10" />
        <rect x="66" y="36" width="8" height="8" stroke="none" className="fill-text" />
      </svg>
      <PixelText as="p" wrap className="justify-center">
        {title}
      </PixelText>
      <p className="max-w-65 text-sm text-text-muted">{message}</p>
    </div>
  );
}

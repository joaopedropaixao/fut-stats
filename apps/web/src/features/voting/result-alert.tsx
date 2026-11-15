import type { CSSProperties } from 'react';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { hasOpenedResult } from './result-opened';
import { Link } from 'react-router';

type ResultAlertProps = {
  roundId: string;
  number: number;
  /** Quem vê: o "já abri" é por jogador. */
  membershipId: string;
};

/**
 * Início depois do fechamento: "O RESULTADO SAIU" em ouro, grande momento com o pacote. Depois de aberto uma vez
 * neste aparelho (por rodada e por jogador), vira uma linha simples que leva ao mesmo lugar.
 */
export function ResultAlert({ roundId, number, membershipId }: ResultAlertProps) {
  const to = `/rodadas/${roundId}/resultado`;
  if (hasOpenedResult(roundId, membershipId)) {
    return (
      <Link
        to={to}
        className="flex min-h-14 items-center gap-3 px-4 py-2 shadow-card active:bg-highlight"
      >
        <Icon name="pack" size={22} className="text-gold" />
        <PixelText wrap className="min-w-0 flex-1">{`Resultado da rodada ${number}`}</PixelText>
        <Icon name="chevronRight" size={18} />
      </Link>
    );
  }
  return (
    <section
      aria-label="O resultado saiu"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ borderColor: 'var(--color-gold)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3 text-gold shadow-[inset_0_-3px_0_0_var(--color-gold)]">
        <Icon name="pack" size={26} />
        <PixelText as="h2" size={24} wrap>
          O resultado saiu
        </PixelText>
      </div>
      <div
        className="flex flex-col gap-4 p-4"
        style={{ '--moment-delay': '120ms' } as CSSProperties}
      >
        <p className="animate-row-in text-base text-text-muted">{`Rodada ${number} · notas fechadas. Quem foi o craque?`}</p>
        <RouteButton
          to={to}
          label="Ver resultado"
          block
          className="animate-row-in [--moment-delay:220ms]"
        />
      </div>
    </section>
  );
}

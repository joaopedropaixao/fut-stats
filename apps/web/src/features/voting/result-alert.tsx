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
  if (hasOpenedResult(roundId, membershipId))
    return <ResultLine roundId={roundId} number={number} />;
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

/**
 * O resultado já aberto neste aparelho: uma linha simples. Só texto, sem ícone nem seta, para caber numa linha
 * só de 320 a 430 px ("Resultado" na esquerda, "Rodada 8" na direita, sem o número cair para baixo).
 */
export function ResultLine({ roundId, number }: { roundId: string; number: number }) {
  return (
    <Link
      to={`/rodadas/${roundId}/resultado`}
      aria-label={`Resultado da rodada ${number}`}
      className="flex min-h-14 items-center justify-between gap-2 px-4 py-2 shadow-card active:bg-highlight"
    >
      <PixelText>Resultado</PixelText>
      <PixelText className="text-gold">{`Rodada ${number}`}</PixelText>
    </Link>
  );
}

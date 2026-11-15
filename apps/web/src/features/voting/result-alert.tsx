import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { PackMini } from './pack-mini';
import { hasOpenedResult } from './result-opened';

type ResultAlertProps = {
  roundId: string;
  number: number;
  /** Quem vê: o "já abri" é por jogador. */
  membershipId: string;
};

/**
 * Início depois do fechamento: "O RESULTADO SAIU", o card da recompensa. A cor de destaque é só o ouro (contorno,
 * faixa e o pacote); o título é creme e a única tecla amarela é a de ação, separada do ouro. O pacote fechado
 * em miniatura treme de leve em degraus (parado com "reduzir movimento"). Depois de aberto (por rodada e por
 * jogador), vira a linha do resultado, que leva ao mesmo lugar.
 */
export function ResultAlert({ roundId, number, membershipId }: ResultAlertProps) {
  const to = `/rodadas/${roundId}/resultado`;
  if (hasOpenedResult(roundId, membershipId))
    return <ResultLine roundId={roundId} number={number} />;
  return (
    <section
      aria-label="O resultado saiu"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ borderColor: 'var(--color-gold)', boxShadow: '5px 5px 0 var(--color-shadow)' }}
    >
      <div className="flex items-center gap-3 bg-gold/12 px-4 py-4 shadow-[inset_0_-3px_0_0_var(--color-gold)]">
        <span className="animate-pack-wobble inline-flex">
          <PackMini scale={5} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PixelText className="text-gold">{`Rodada ${number}`}</PixelText>
          <PixelText
            as="h2"
            size={24}
            wrap
            className="text-text [text-shadow:2px_2px_0_#000] min-[400px]:text-pixel-lg"
          >
            O resultado saiu
          </PixelText>
        </div>
      </div>
      <div
        className="flex flex-col gap-4 p-4"
        style={{ '--moment-delay': '120ms' } as CSSProperties}
      >
        <p className="animate-row-in text-base text-text-muted">
          Notas fechadas. Quem foi o craque?
        </p>
        <RouteButton
          to={to}
          label="Abrir pacote"
          icon="pack"
          block
          className="animate-row-in [--moment-delay:220ms]"
        />
      </div>
    </section>
  );
}

/**
 * O resultado já aberto neste aparelho: uma linha de grande momento (contorno grosso e sombra dura), só texto, sem
 * ícone nem seta, para caber numa linha só de 320 a 430 px ("Resultado" na esquerda, "Rodada 8" em ouro na direita).
 */
export function ResultLine({ roundId, number }: { roundId: string; number: number }) {
  return (
    <Link
      to={`/rodadas/${roundId}/resultado`}
      aria-label={`Resultado da rodada ${number}`}
      className="moment-frame animate-moment-in flex min-h-14 items-center justify-between gap-2 bg-surface-raised px-4 py-2 active:translate-x-1 active:translate-y-1 active:shadow-none"
    >
      <PixelText>Resultado</PixelText>
      <PixelText className="text-gold">{`Rodada ${number}`}</PixelText>
    </Link>
  );
}

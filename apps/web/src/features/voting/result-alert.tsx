import type { CSSProperties } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { PackMini } from './pack-mini';
import { hasPack } from '../pack/deck';
import { useResult } from './queries';

type ResultAlertProps = {
  groupId: string;
  roundId: string;
  number: number;
};

/**
 * Aviso grande do resultado: "O RESULTADO SAIU", o card da recompensa. O ouro é só do pacote em miniatura (a
 * recompensa); o rótulo da rodada, o traço do título e o contorno são neutros, e a única tecla amarela é a de ação:
 * ouro e amarelo não competem no mesmo card. O pacote fechado em miniatura treme de leve em degraus (parado com "reduzir
 * movimento"). Depois de aberto (por rodada e por jogador) o Feed troca este card pela linha do resultado.
 * Rodada sem votos não tem pacote: a tecla diz "Ver resultado" e o pacote some.
 */
export function ResultAlert({ groupId, roundId, number }: ResultAlertProps) {
  const to = `/rodadas/${roundId}/resultado`;
  const result = useResult(groupId, roundId);
  // Enquanto não sabe (ou sem votos), o card não promete pacote
  const pack = result.data ? hasPack(result.data) : false;
  return (
    <section
      aria-label="O resultado saiu"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ boxShadow: '5px 5px 0 var(--color-shadow)' }}
    >
      <div className="flex items-center gap-3 bg-surface-3 px-4 py-4 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        {pack && (
          <span className="animate-pack-wobble inline-flex">
            <PackMini scale={5} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <PixelText className="text-text-muted">{`Rodada ${number}`}</PixelText>
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
          {pack ? 'Notas fechadas. Quem foi o craque?' : 'Notas fechadas. Veja como foi a rodada.'}
        </p>
        <RouteButton
          to={to}
          label={pack ? 'Abrir pacote' : 'Ver resultado'}
          icon="pack"
          block
          className="animate-row-in [--moment-delay:220ms]"
        />
      </div>
    </section>
  );
}

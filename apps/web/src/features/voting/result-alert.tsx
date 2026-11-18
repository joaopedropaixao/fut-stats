import type { CSSProperties } from 'react';
import { AlertBand, AlertFrame } from '../../components/ui/alert-frame';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { PackMini } from './pack-mini';

type ResultAlertProps = {
  roundId: string;
  number: number;
  /** Vem do aviso da API (`hasPack`): a rodada tem Craque com nota. Sem o campo, o card não promete pacote. */
  hasPack?: boolean;
};

/**
 * Aviso grande do resultado: "O RESULTADO SAIU", o card da recompensa. A identidade é o ouro (moldura, faixa do
 * cabeçalho, ícone e rótulo da rodada); a única tecla amarela é a de ação, que nunca leva o ouro. O pacote fechado
 * em miniatura treme de leve em degraus (parado com "reduzir movimento"). Depois de aberto (por rodada e por
 * jogador) o Feed troca este card pela linha do resultado.
 * Rodada sem votos não tem pacote: a tecla diz "Ver resultado" e o ícone do pacote fica no lugar da miniatura.
 * O Feed não busca o resultado para saber disso: o aviso da API já diz (`hasPack`).
 */
export function ResultAlert({ roundId, number, hasPack: pack = false }: ResultAlertProps) {
  const to = `/rodadas/${roundId}/resultado`;
  return (
    <AlertFrame tone="RESULT" label="O resultado saiu">
      <AlertBand tone="RESULT" nowrap>
        {pack ? (
          <span className="animate-pack-wobble inline-flex">
            <PackMini scale={5} />
          </span>
        ) : (
          <Icon name="pack" size={28} className="shrink-0 text-gold" />
        )}
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
      </AlertBand>
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
    </AlertFrame>
  );
}

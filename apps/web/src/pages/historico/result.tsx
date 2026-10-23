import type { HistoryItem } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { resultLabel } from '../../features/history/match-view';

type ResultItem = Pick<HistoryItem, 'winner' | 'status'>;

/** Ponto verde de "em jogo" (quadrado: pixel não tem bolinha). */
export function LiveDot() {
  return <span aria-hidden className="size-2 shrink-0 bg-success" />;
}

/**
 * Linha do resultado na lista, quieta: ícone + texto. Cor nunca é o único sinal: o texto diz quem venceu
 * e o ✓ só acompanha.
 */
export function ResultLine({ item }: { item: ResultItem }) {
  const label = resultLabel(item);
  return (
    <span className="inline-flex items-center gap-1.5">
      {item.winner === 'WHITE' || item.winner === 'BLACK' ? (
        <Icon name="check" size={16} strokeWidth={3} className="shrink-0 text-success" />
      ) : item.winner === 'DRAW' ? (
        <Icon name="minus" size={16} strokeWidth={3} className="shrink-0 text-text-muted" />
      ) : item.status === 'IN_PROGRESS' ? (
        <LiveDot />
      ) : null}
      <PixelText
        className={item.winner || item.status === 'IN_PROGRESS' ? 'text-text' : 'text-text-muted'}
      >
        {label}
      </PixelText>
    </span>
  );
}

/** Corte diagonal do placar da folha (112°): Branco à esquerda, Preto à direita. */
export const DIAGONAL_CUT = 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)';

/**
 * Placar pequeno da lista: o mesmo corte diagonal do placar grande. O lado que perdeu fica apagado
 * (o texto ao lado já diz o resultado). Sem placar, um traço em cada lado.
 */
export function ScoreTile({ item }: { item: Pick<HistoryItem, 'score' | 'winner'> }) {
  const { score, winner } = item;
  const dim = (side: 'WHITE' | 'BLACK') => winner !== null && winner !== 'DRAW' && winner !== side;
  return (
    <span
      className="flex h-11 min-w-20 shrink-0 items-center justify-between gap-4 px-2.5 shadow-[inset_0_0_0_2px_rgb(255_255_255/22%)]"
      style={{ backgroundImage: DIAGONAL_CUT }}
      {...(score
        ? { role: 'img', 'aria-label': `Branco ${score.WHITE}, Preto ${score.BLACK}` }
        : { 'aria-hidden': true })}
    >
      {score ? (
        <>
          <PixelDigits
            value={score.WHITE}
            scale={3}
            decorative
            className={cn('text-team-black', dim('WHITE') && 'opacity-40')}
          />
          <PixelDigits
            value={score.BLACK}
            scale={3}
            decorative
            className={cn('text-team-white', dim('BLACK') && 'opacity-40')}
          />
        </>
      ) : (
        <>
          <span className="h-1 w-3 bg-team-black" />
          <span className="h-1 w-3 bg-team-white" />
        </>
      )}
    </span>
  );
}

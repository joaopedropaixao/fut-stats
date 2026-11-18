import type { ResultPlayer } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';
import { YouTag } from '../lineup/you-tag';
import type { PackCard } from '../pack/deck';
import { ShareButton } from '../pack/share-button';
import { TIER_LABELS } from '../pack/tier';

/**
 * "SUA NOTA": a nota grande, a faixa da carta por extenso, a posição na rodada, o "VOCÊ" e o Compartilhar da sua
 * carta. Sem nota, a frase que explica.
 */
export function MyScoreCard({
  me,
  card,
  roundNumber,
}: {
  me: ResultPlayer;
  /** A sua carta (nota, faixa e posição); `null` sem nota. */
  card: PackCard | null;
  roundNumber: number;
}) {
  return (
    <section
      aria-label="Sua nota"
      className="moment-frame animate-moment-in flex flex-col gap-3 bg-surface-raised p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <PixelText as="h2">Sua nota</PixelText>
        <YouTag />
      </div>
      {me.score === null ? (
        <p className="text-base text-text-muted">Ninguém te deu nota nesta rodada.</p>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <PixelDigits
              value={formatRating(me.score)}
              scale={8}
              label={`Sua nota: ${formatRating(me.score)}`}
              className="max-[359px]:hidden"
            />
            <PixelDigits
              value={formatRating(me.score)}
              scale={5}
              decorative
              className="min-[360px]:hidden"
            />
            <div className="flex flex-col items-end gap-1 pb-1 text-right">
              {card && <PixelText>{`Carta ${TIER_LABELS[card.tier]}`}</PixelText>}
              {me.rank !== null && (
                <PixelText wrap className="text-right">{`Posição ${me.rank} da rodada`}</PixelText>
              )}
            </div>
          </div>
          {card && <ShareButton card={card} roundNumber={roundNumber} block />}
        </>
      )}
    </section>
  );
}

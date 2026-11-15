import type { ResultPlayer } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRating } from '../../lib/rating-format';
import { YouTag } from '../lineup/you-tag';

/** "SUA NOTA": a nota grande, a posição na rodada e o "VOCÊ". Sem nota, a frase que explica. */
export function MyScoreCard({ me }: { me: ResultPlayer }) {
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
          {me.rank !== null && (
            <PixelText wrap className="pb-1">{`${me.rank}º da rodada`}</PixelText>
          )}
        </div>
      )}
    </section>
  );
}

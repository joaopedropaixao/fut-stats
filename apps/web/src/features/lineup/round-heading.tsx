import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundWhen } from '../../lib/round-format';

type RoundHeadingProps = {
  title: string;
  /** A rodada, quando já carregou. */
  round?: { number: number; scheduledAt: string; location: string | null };
};

/** Título da tela com o número, a data e o local da rodada logo abaixo. */
export function RoundHeading({ title, round }: RoundHeadingProps) {
  return (
    <header className="flex flex-col gap-2">
      <title>{`${title} · Fut Stats`}</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        {title}
      </PixelText>
      {round && (
        <div className="flex flex-col gap-1">
          <PixelText className="text-gold">{`Rodada ${round.number}`}</PixelText>
          <PixelText wrap className="text-text-muted">
            {formatRoundWhen(round.scheduledAt)}
          </PixelText>
          {round.location && <p className="text-sm text-text-muted">{round.location}</p>}
        </div>
      )}
    </header>
  );
}

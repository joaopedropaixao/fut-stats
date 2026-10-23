import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundWhen } from '../../lib/round-format';

/** Data e hora da rodada e o local, no formato do app ("SÁB, 24 OUT · 9H"). */
export function RoundWhen({
  scheduledAt,
  location,
  as,
}: {
  scheduledAt: string;
  location: string | null;
  /** O título da tela usa `h1`. */
  as?: 'h1' | 'p';
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <PixelText as={as} size={as === 'h1' ? 24 : 16} wrap className="outline-none">
        {formatRoundWhen(scheduledAt)}
      </PixelText>
      <PixelText wrap className="text-text-muted">
        {location ?? 'Local a combinar'}
      </PixelText>
    </div>
  );
}

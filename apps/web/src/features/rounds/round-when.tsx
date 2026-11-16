import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundWhen } from '../../lib/round-format';

/** Número da rodada, data e hora e o local, no formato do app ("RODADA 12", "SÁB, 24 OUT · 9H"). */
export function RoundWhen({
  number,
  scheduledAt,
  location,
  as,
  numberClassName = 'text-gold',
}: {
  number: number;
  scheduledAt: string;
  location: string | null;
  /** O título da tela usa `h1`. */
  as?: 'h1' | 'p';
  /** Cor do "RODADA 12" (ouro nas telas de rodada; card que não é de recompensa passa outra). */
  numberClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <PixelText className={numberClassName}>{`Rodada ${number}`}</PixelText>
      <PixelText as={as} size={as === 'h1' ? 24 : 16} wrap className="outline-none">
        {formatRoundWhen(scheduledAt)}
      </PixelText>
      <PixelText wrap className="text-text-muted">
        {location ?? 'Local a combinar'}
      </PixelText>
    </div>
  );
}

import type { ReactNode } from 'react';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundDate } from './format-round-date';

type RoundHeadingProps = {
  title: string;
  /** A rodada, quando já carregou: data e hora em pixel, local em Inter. */
  round?: { scheduledAt: string; location: string | null };
  children?: ReactNode;
};

/** Título da tela com a data e o local da rodada logo abaixo. */
export function RoundHeading({ title, round, children }: RoundHeadingProps) {
  return (
    <header className="flex flex-col gap-2">
      <title>{`${title} · Fut Stats`}</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        {title}
      </PixelText>
      {round && (
        <div className="flex flex-col gap-0.5">
          <PixelText className="text-text-muted">{formatRoundDate(round.scheduledAt)}</PixelText>
          {round.location && <p className="text-sm text-text-muted">{round.location}</p>}
        </div>
      )}
      {children}
    </header>
  );
}

import type { HistoryDetail } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { formatMatchDay, formatMatchTime } from '../../features/history/format';
import { WinnerSeal } from './winner-seal';

/** Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro. */
export function Scoreboard({ match }: { match: HistoryDetail }) {
  return (
    <section aria-label="Placar" className="bg-surface shadow-card">
      <div
        className="flex flex-col gap-2 px-5 pt-4 pb-5"
        style={{
          backgroundImage: 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
        }}
      >
        <div className="flex items-baseline justify-between">
          <PixelText className="text-[#3a3f3b]">{formatMatchDay(match.scheduledAt)}</PixelText>
          <PixelText className="text-[#b8bcb9]">{formatMatchTime(match.scheduledAt)}</PixelText>
        </div>
        {match.score ? (
          <div className="flex items-end justify-between">
            <PixelDigits
              value={match.score.white}
              scale={12}
              className="text-team-black"
              label={`Branco ${match.score.white}`}
            />
            <PixelDigits
              value={match.score.black}
              scale={12}
              className="text-team-white"
              label={`Preto ${match.score.black}`}
            />
          </div>
        ) : null}
        <div className="flex items-center justify-between">
          <PixelText className="text-team-black">BRANCO</PixelText>
          <PixelText className="text-team-white">PRETO</PixelText>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 py-3.5">
        <WinnerSeal item={match} />
        {match.location && <p className="min-w-0 text-sm text-text-muted">{match.location}</p>}
      </div>
    </section>
  );
}

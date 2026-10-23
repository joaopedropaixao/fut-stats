import { ROUND_STATUS_LABELS, TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { IconButton } from '../../components/ui/button';

/** Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro, dígitos pixel grandes. */
export function Scoreboard({ status, score }: Pick<MatchView, 'status' | 'score'>) {
  const white = score?.WHITE ?? 0;
  const black = score?.BLACK ?? 0;
  // Escala 12 (108px de altura) cabe até 2 dígitos de cada lado; com 3 ou mais, desce para 8
  const scale = Math.max(white, black) >= 100 ? 8 : 12;

  return (
    <section aria-label="Placar" className="bg-surface shadow-card">
      <div
        className="flex flex-col gap-2 px-5 pt-4 pb-5"
        style={{
          backgroundImage: 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
        }}
      >
        <PixelText className="text-[#3a3f3b]">{ROUND_STATUS_LABELS[status]}</PixelText>
        <div className="flex items-end justify-between">
          <PixelDigits
            value={white}
            scale={scale}
            className="text-team-black"
            label={`Branco ${white}`}
          />
          <PixelDigits
            value={black}
            scale={scale}
            className="text-team-white"
            label={`Preto ${black}`}
          />
        </div>
        <div className="flex items-center justify-between">
          <PixelText className="text-team-black">{TEAM_LABELS.WHITE}</PixelText>
          <PixelText className="text-team-white">{TEAM_LABELS.BLACK}</PixelText>
        </div>
      </div>
      {!score && <p className="px-5 py-3 text-caption text-text-muted">Placar ainda não lançado</p>}
    </section>
  );
}

type ScoreStepperProps = {
  score: NonNullable<MatchView['score']> | null;
  /** Salvando: trava os botões para não encavalar duas gravações. */
  busy: boolean;
  onChange: (next: { WHITE: number; BLACK: number }) => void;
};

/** O admin ajusta o placar de cada time com − e +; cada toque salva. */
export function ScoreStepper({ score, busy, onChange }: ScoreStepperProps) {
  const current = { WHITE: score?.WHITE ?? 0, BLACK: score?.BLACK ?? 0 };

  return (
    <section aria-label="Corrigir placar" className="grid grid-cols-2 gap-3">
      {(['WHITE', 'BLACK'] as const).map((team) => (
        <div key={team} className="flex flex-col gap-2 bg-surface p-3 shadow-card">
          <PixelText>{TEAM_LABELS[team]}</PixelText>
          <div className="flex items-center justify-between">
            <IconButton
              icon="minus"
              label={`Tirar um gol do ${TEAM_LABELS[team]}`}
              disabled={busy || current[team] === 0}
              onClick={() => onChange({ ...current, [team]: current[team] - 1 })}
              className="disabled:opacity-40"
            />
            <PixelDigits value={current[team]} scale={3} decorative />
            <IconButton
              icon="plus"
              label={`Somar um gol ao ${TEAM_LABELS[team]}`}
              disabled={busy}
              onClick={() => onChange({ ...current, [team]: current[team] + 1 })}
              className="disabled:opacity-40"
            />
          </div>
        </div>
      ))}
    </section>
  );
}

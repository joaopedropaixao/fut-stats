import {
  ROUND_STATUS_LABELS,
  TEAM_LABELS,
  type MatchPlayer,
  type MatchView,
} from '@fut-stats/shared';
import { IconButton } from '../../components/ui/button';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';

type Team = MatchPlayer['team'];
type Score = Record<Team, number>;

/** "24 OUT": o dia da rodada no canto do placar, como na folha. */
function dayLabel(iso: string): string {
  const parts = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short' }).formatToParts(
    new Date(iso),
  );
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = (parts.find((p) => p.type === 'month')?.value ?? '').replace('.', '');
  return `${day} ${month}`.trim();
}

type ScoreboardProps = Pick<MatchView, 'status' | 'score' | 'scheduledAt'> & {
  /** Admin com o jogo aberto: −/+ de cada time numa faixa embaixo do placar. Cada toque salva. */
  editor?: { busy: boolean; onChange: (next: Score) => void };
};

/**
 * Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro, dígitos pixel escala 12.
 * Sem placar lançado, os dígitos ficam apagados em 0 × 0.
 */
export function Scoreboard({ status, score, scheduledAt, editor }: ScoreboardProps) {
  const current: Score = { WHITE: score?.WHITE ?? 0, BLACK: score?.BLACK ?? 0 };
  // Escala 12 (108px de altura) cabe até 2 dígitos de cada lado; com 3 ou mais, desce para 8
  const scale = Math.max(current.WHITE, current.BLACK) >= 100 ? 8 : 12;
  const live = status === 'IN_PROGRESS';

  return (
    <section aria-label="Placar" className="flex flex-col bg-surface shadow-card">
      <div
        className="flex flex-col gap-2 px-5 pt-4 pb-5"
        style={{
          backgroundImage: 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
        }}
      >
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2">
            {live && <span aria-hidden className="size-2 shrink-0 rounded-full bg-success" />}
            <PixelText className="text-[#3a3f3b]">{ROUND_STATUS_LABELS[status]}</PixelText>
          </span>
          <PixelText className="text-[#b8bcb9]">{dayLabel(scheduledAt)}</PixelText>
        </div>
        <div className="flex items-end justify-between">
          <PixelDigits
            value={current.WHITE}
            scale={scale}
            className={score ? 'text-team-black' : 'text-[#c9cdca]'}
            label={`Branco ${current.WHITE}`}
          />
          <PixelDigits
            value={current.BLACK}
            scale={scale}
            className={score ? 'text-team-white' : 'text-[#3a3f3b]'}
            label={`Preto ${current.BLACK}`}
          />
        </div>
        <div className="flex items-center justify-between">
          <PixelText className="text-team-black">{TEAM_LABELS.WHITE}</PixelText>
          <PixelText className="text-team-white">{TEAM_LABELS.BLACK}</PixelText>
        </div>
      </div>
      {!score && (
        <p className="px-5 pt-3 text-sm text-text-muted">
          {editor ? 'Toque no + para lançar o placar.' : 'O placar ainda não foi lançado.'}
        </p>
      )}
      {editor && <ScoreEditor score={current} {...editor} />}
    </section>
  );
}

const STEP_DISABLED = 'disabled:bg-surface disabled:text-disabled disabled:shadow-card';

/** −/+ embaixo de cada lado do placar: o do Branco à esquerda, o do Preto à direita. */
function ScoreEditor({
  score,
  busy,
  onChange,
}: {
  score: Score;
  busy: boolean;
  onChange: (next: Score) => void;
}) {
  const stepper = (team: Team) => (
    <div className="flex gap-3">
      <IconButton
        icon="minus"
        label={`Tirar um gol do ${TEAM_LABELS[team]}`}
        disabled={busy || score[team] === 0}
        onClick={() => onChange({ ...score, [team]: score[team] - 1 })}
        className={STEP_DISABLED}
      />
      <IconButton
        icon="plus"
        label={`Somar um gol ao ${TEAM_LABELS[team]}`}
        disabled={busy}
        onClick={() => onChange({ ...score, [team]: score[team] + 1 })}
        className={STEP_DISABLED}
      />
    </div>
  );
  return (
    <div
      role="group"
      aria-label="Corrigir placar"
      aria-busy={busy || undefined}
      className="flex items-center justify-between gap-3 px-4 pt-3 pb-4"
    >
      {stepper('WHITE')}
      <PixelText className="text-text-muted">Placar</PixelText>
      {stepper('BLACK')}
    </div>
  );
}

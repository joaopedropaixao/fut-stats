import { ROUND_STATUS_LABELS, TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import { Bump } from '../../components/ui/bump';
import { IconButton } from '../../components/ui/button';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

type Team = 'WHITE' | 'BLACK';
type Score = Record<Team, number>;

const DIAGONAL = {
  backgroundImage: 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
};

/** O traço do placar ainda não lançado, no lugar dos dígitos. */
function Dash({ scale, className }: { scale: number; className: string }) {
  return (
    <span aria-hidden className="flex items-center" style={{ height: scale * 9 }}>
      <span
        style={{ width: scale * 4, height: scale * 2 }}
        className={cn('inline-block', className)}
      />
    </span>
  );
}

type ScoreboardProps = {
  status: MatchView['status'];
  score: MatchView['score'];
  /** Compacto (card do início): dígitos menores. */
  compact?: boolean;
  /** Sem o contorno e a entrada próprios: quem usa já enquadra (o card do início). */
  bare?: boolean;
  /** Admin com o placar aberto: −/+ de cada time embaixo. Cada toque grava. */
  editor?: { busy: boolean; onChange: (next: Score) => void };
};

/**
 * Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro, dígitos pixel. É um grande
 * momento: contorno de 3px, sombra dura e entrada em degraus; o dígito que muda bate. A etapa fica numa faixa
 * própria em cima, longe dos dígitos. Sem placar lançado, o traço "–" no lugar dos dígitos.
 */
export function Scoreboard({ status, score, compact, bare, editor }: ScoreboardProps) {
  const scale = compact ? 6 : Math.max(score?.WHITE ?? 0, score?.BLACK ?? 0) >= 100 ? 8 : 12;
  const live = status === 'IN_PROGRESS';

  return (
    <section
      aria-label="Placar"
      className={cn('flex flex-col bg-surface', !bare && 'moment-frame animate-moment-in')}
    >
      <div className="flex h-11 items-center bg-track px-4 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        <span className="inline-flex items-center gap-2 text-text">
          {live && (
            <span
              aria-hidden
              className="animate-live-blink size-2.5 shrink-0 rounded-full bg-success"
            />
          )}
          <PixelText>{ROUND_STATUS_LABELS[status]}</PixelText>
        </span>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-6 pb-5" style={DIAGONAL}>
        <div className="flex items-end justify-between">
          {score ? (
            <>
              <Bump value={score.WHITE} scale={1.15}>
                <PixelDigits
                  value={score.WHITE}
                  scale={scale}
                  className="text-team-black"
                  label={`Branco ${score.WHITE}`}
                />
              </Bump>
              <Bump value={score.BLACK} scale={1.15}>
                <PixelDigits
                  value={score.BLACK}
                  scale={scale}
                  className="text-team-white"
                  label={`Preto ${score.BLACK}`}
                />
              </Bump>
            </>
          ) : (
            <>
              <Dash scale={scale} className={cn('bg-team-black', live && 'animate-live-blink')} />
              <Dash scale={scale} className={cn('bg-team-white', live && 'animate-live-blink')} />
            </>
          )}
        </div>
        <div className="flex items-center justify-between">
          <PixelText className="px-2 py-0.5 text-team-black shadow-[inset_0_0_0_2px_#000]">
            {TEAM_LABELS.WHITE}
          </PixelText>
          <PixelText className="px-2 py-0.5 text-team-white shadow-[inset_0_0_0_2px_#fff]">
            {TEAM_LABELS.BLACK}
          </PixelText>
        </div>
      </div>
      {!score && !live && (
        <p className="px-5 py-3 shadow-[inset_0_3px_0_0_var(--color-border-strong)]">
          <PixelText className="text-text-muted">Placar não lançado</PixelText>
        </p>
      )}
      {editor && <ScoreEditor score={score ?? { WHITE: 0, BLACK: 0 }} {...editor} />}
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
  return (
    <div
      role="group"
      aria-label="Corrigir placar"
      aria-busy={busy || undefined}
      className="flex items-center justify-between gap-3 bg-surface-raised px-4 pt-3 pb-4 shadow-[inset_0_3px_0_0_var(--color-border-strong)]"
    >
      <Stepper team="WHITE" score={score} busy={busy} onChange={onChange} />
      <PixelText className="text-text-muted">Placar</PixelText>
      <Stepper team="BLACK" score={score} busy={busy} onChange={onChange} />
    </div>
  );
}

function Stepper({
  team,
  score,
  busy,
  onChange,
}: {
  team: Team;
  score: Score;
  busy: boolean;
  onChange: (next: Score) => void;
}) {
  return (
    <div className="flex gap-3">
      <IconButton
        icon="minus"
        label={`Tirar um gol do ${TEAM_LABELS[team]} no placar`}
        disabled={busy || score[team] === 0}
        onClick={() => onChange({ ...score, [team]: score[team] - 1 })}
        className={STEP_DISABLED}
      />
      <IconButton
        icon="plus"
        label={`Somar um gol ao ${TEAM_LABELS[team]} no placar`}
        disabled={busy}
        onClick={() => onChange({ ...score, [team]: score[team] + 1 })}
        className={STEP_DISABLED}
      />
    </div>
  );
}

/** −/+ de um time para a gaveta de finalizar (placar final). */
export function ScoreStepper({
  value,
  onChange,
}: {
  value: Score;
  onChange: (next: Score) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      {(['WHITE', 'BLACK'] as const).map((team) => (
        <div key={team} className="flex items-center justify-between gap-3">
          <PixelText>{TEAM_LABELS[team]}</PixelText>
          <div className="flex items-center gap-3">
            <IconButton
              icon="minus"
              label={`Tirar um gol do ${TEAM_LABELS[team]}`}
              disabled={value[team] === 0}
              onClick={() => onChange({ ...value, [team]: value[team] - 1 })}
              className={STEP_DISABLED}
            />
            <span className="flex w-14 justify-center">
              <Bump value={value[team]}>
                <PixelDigits
                  value={value[team]}
                  scale={4}
                  label={`${TEAM_LABELS[team]} ${value[team]}`}
                  className="text-text"
                />
              </Bump>
            </span>
            <IconButton
              icon="plus"
              label={`Somar um gol ao ${TEAM_LABELS[team]}`}
              onClick={() => onChange({ ...value, [team]: value[team] + 1 })}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

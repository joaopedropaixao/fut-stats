import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  FEED_ALERT_LABELS,
  ROUND_STATUS_LABELS,
  TEAM_LABELS,
  type MatchView,
  type MatchWinner,
} from '@fut-stats/shared';
import { AlertBand } from '../../components/ui/alert-frame';
import { ALERT_TONES } from '../../components/ui/alert-tone';
import { Bump } from '../../components/ui/bump';
import { IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { LiveSeal } from '../../components/ui/live-seal';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { pixelDigitsPath } from '../../components/ui/pixel-glyphs';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { fitScale } from './score-fit';

type Team = 'WHITE' | 'BLACK';
type Score = Record<Team, number>;

const DIAGONAL = {
  backgroundImage: 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
};

/** Largura útil da linha dos dígitos (0 até medir, e em ambiente sem ResizeObserver). */
function useRowWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

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
  /** Sem a faixa da etapa em cima: quem usa já diz a etapa (card do histórico). */
  hideStatus?: boolean;
  /** Aviso do Feed: a faixa da etapa ganha a cor de identidade (vermelho com o selo AO VIVO, ou laranja). */
  alert?: boolean;
  /** Partida encerrada: o time vencedor ganha "✓ Venceu" (empate, "= Empate") embaixo do nome. */
  winner?: MatchWinner;
  /** Admin com o placar aberto: −/+ de cada time embaixo. Cada toque grava. */
  editor?: { busy: boolean; onChange: (next: Score) => void };
};

/**
 * Placar com corte diagonal (assinatura 1 do DS): Branco de um lado, Preto do outro, dígitos pixel. É um grande
 * momento: contorno de 3px, sombra dura e entrada em degraus; o dígito que muda bate. A etapa fica numa faixa
 * própria em cima, longe dos dígitos. Sem placar lançado, o traço "–" no lugar dos dígitos.
 */
export function Scoreboard({
  status,
  score,
  compact,
  bare,
  hideStatus,
  alert,
  winner,
  editor,
}: ScoreboardProps) {
  const baseScale = compact ? 6 : Math.max(score?.WHITE ?? 0, score?.BLACK ?? 0) >= 100 ? 8 : 12;
  const row = useRef<HTMLDivElement>(null);
  const width = useRowWidth(row);
  // Número de 2 ou 3 dígitos em tela estreita: encolhe em degraus inteiros até caber, nunca passa da borda
  const units = score
    ? pixelDigitsPath(String(score.WHITE)).width + pixelDigitsPath(String(score.BLACK)).width
    : 0;
  const scale = fitScale(baseScale, units, width);
  const live = status === 'IN_PROGRESS';

  return (
    <section
      aria-label="Placar"
      className={cn('flex flex-col bg-surface', !bare && 'moment-frame animate-moment-in')}
    >
      {!hideStatus && alert && (status === 'IN_PROGRESS' || status === 'POST_MATCH') ? (
        <AlertBand tone={status} nowrap className="h-14 justify-between py-0">
          <span className="inline-flex min-w-0 items-center gap-2 text-text">
            <Icon
              name={live ? 'clock' : 'pencil'}
              size={22}
              className={`shrink-0 ${ALERT_TONES[status].ink}`}
            />
            <PixelText wrap>{FEED_ALERT_LABELS[status]}</PixelText>
          </span>
          {live && <LiveSeal />}
        </AlertBand>
      ) : (
        !hideStatus && (
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
        )
      )}
      <div
        // Com "Venceu" sobre o nome, o texto do lado branco precisa de todo o espaço até o corte (320 px)
        className={cn('flex flex-col gap-3 pt-6 pb-5', winner ? 'px-4' : 'px-5')}
        style={DIAGONAL}
      >
        <div ref={row} className="flex items-end justify-between">
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
              <span className="sr-only">Placar ainda não lançado</span>
              <Dash scale={scale} className={cn('bg-team-black', live && 'animate-live-blink')} />
              <Dash scale={scale} className={cn('bg-team-white', live && 'animate-live-blink')} />
            </>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="flex flex-col items-start gap-1.5 text-team-black">
            {winner && <WinnerMark team="WHITE" winner={winner} />}
            <PixelText className="px-2 py-0.5 shadow-[inset_0_0_0_2px_#000]">
              {TEAM_LABELS.WHITE}
            </PixelText>
          </div>
          <div className="flex flex-col items-end gap-1.5 text-team-white">
            {winner && <WinnerMark team="BLACK" winner={winner} />}
            <PixelText className="px-2 py-0.5 shadow-[inset_0_0_0_2px_#fff]">
              {TEAM_LABELS.BLACK}
            </PixelText>
          </div>
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

/** "✓ Venceu" sobre o nome do time que ganhou (acima, onde o corte diagonal deixa mais espaço); no empate, "= Empate" nos dois. Quem perdeu não ganha marca. */
function WinnerMark({ team, winner }: { team: Team; winner: MatchWinner }) {
  if (winner !== 'DRAW' && winner !== team) return null;
  return (
    <span className="inline-flex items-center gap-1">
      {winner === 'DRAW' ? (
        <span aria-hidden className="flex w-3.5 flex-col gap-0.75">
          <span className="h-0.5 bg-current" />
          <span className="h-0.5 bg-current" />
        </span>
      ) : (
        <Icon name="check" size={14} strokeWidth={3.5} />
      )}
      <PixelText>{winner === 'DRAW' ? 'Empate' : 'Venceu'}</PixelText>
    </span>
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

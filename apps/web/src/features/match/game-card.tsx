import { matchRotationPlan, rotationStatus, TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { AlertFrame } from '../../components/ui/alert-frame';
import { toneDivider } from '../../components/ui/alert-tone';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { goalsOfScore } from './match-text';
import { Scoreboard } from './scoreboard';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { useRotationClock } from './use-rotation-clock';

/** O texto e a tecla do card, conforme a etapa e quem vê. O que pode vem da visão; aqui só se escolhe a frase. */
function copy(view: MatchView): { message: string; action: string } {
  if (view.status === 'POST_MATCH') {
    if (view.me.isAdmin)
      return { message: 'Confira os lances e abra a votação', action: 'Ir para a Resenha' };
    if (view.me.team)
      return { message: 'Lance seus gols e assistências', action: 'Lançar meus lances' };
    return { message: 'A turma está conferindo os lances', action: 'Ver o jogo' };
  }
  return { message: 'A bola está rolando', action: 'Ir para o jogo' };
}

/**
 * Aviso grande do jogo: em jogo é vermelho, com o selo AO VIVO piscando; na Hora da Resenha é laranja. A identidade
 * fica na moldura de 3px, na faixa da etapa e no ícone; a tecla para a tela do jogo é sempre a amarela. Sombra dura
 * e entrada em degraus, como todo grande momento.
 */
export function GameCard({ view }: { view: MatchView }) {
  const { message, action } = copy(view);
  const showTally = view.status === 'POST_MATCH' && view.me.isAdmin;
  const tone = view.status === 'POST_MATCH' ? 'POST_MATCH' : 'IN_PROGRESS';
  return (
    <AlertFrame
      tone={tone}
      label={view.status === 'POST_MATCH' ? 'Hora da Resenha' : 'Jogo em andamento'}
    >
      <Scoreboard status={view.status} score={view.score} compact bare alert />
      <div
        className="flex flex-col gap-4 p-4"
        style={{ ...toneDivider(tone), '--moment-delay': '120ms' } as CSSProperties}
      >
        <div className="animate-row-in flex flex-col gap-2">
          <PixelText as="h2" size={24} wrap className="text-text [text-shadow:2px_2px_0_#000]">
            {message}
          </PixelText>
          {view.status === 'IN_PROGRESS' && view.rotation && view.me.team && (
            <RotationHomeLine view={view} />
          )}
          {showTally && (
            <ul className="flex flex-col gap-1 text-text-muted">
              {(['WHITE', 'BLACK'] as const).map((team) => (
                <li key={team}>
                  <PixelText>{`${TEAM_LABELS[team]}: ${goalsOfScore(view.tally.goals[team], view.score?.[team])}`}</PixelText>
                </li>
              ))}
            </ul>
          )}
        </div>
        <RouteButton
          to={`/rodadas/${view.roundId}/jogo`}
          label={action}
          block
          className="animate-row-in [--moment-delay:220ms]"
        />
      </div>
    </AlertFrame>
  );
}

function RotationHomeLine({ view }: { view: MatchView }) {
  const rotation = view.rotation;
  const team = view.me.team;
  const { elapsedMs } = useRotationClock(view.serverTime, rotation?.startedAt ?? null);
  if (!rotation || !team) return null;
  const plan = matchRotationPlan(view);
  if (!plan?.[team].turns.length) return null;
  const status = rotationStatus(plan, rotation.minutes, elapsedMs);
  const remaining = status.teams[team].next?.inMs;
  if (remaining === undefined || remaining === null || status.finished) return null;
  const seconds = Math.ceil(remaining / 1000);
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <span className="flex flex-wrap items-center gap-1 text-text-muted">
      <PixelText wrap>RODÍZIO: PRÓXIMA TROCA EM</PixelText>
      <PixelDigits value={time} scale={2} decorative />
    </span>
  );
}

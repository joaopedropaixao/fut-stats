import { TEAM_LABELS, type MatchView } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { goalsOfScore } from './match-text';
import { Scoreboard } from './scoreboard';

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

/** Início com a rodada em jogo ou na Resenha: o placar, o que fazer agora e a tecla para a tela do jogo. */
export function GameCard({ view }: { view: MatchView }) {
  const { message, action } = copy(view);
  const showTally = view.status === 'POST_MATCH' && view.me.isAdmin;
  return (
    <div className="flex flex-col gap-4">
      <Scoreboard status={view.status} score={view.score} compact />
      <div className="flex flex-col gap-2">
        <PixelText wrap>{message}</PixelText>
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
      <RouteButton to={`/rodadas/${view.roundId}/jogo`} label={action} block />
    </div>
  );
}

import type { PlayerProfile } from '@fut-stats/shared';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState } from '../../components/ui/states';
import { LastRounds } from './last-rounds';
import { formatAverage } from './ranking-text';
import { StatsGrid } from './stats-grid';
import { StreakBadge } from './streak-badge';

/**
 * O bloco de estatísticas do jogador, igual na figurinha dele e no meu Perfil: a sequência, a grade, os números de
 * goleiro (quando é goleiro) e as últimas rodadas. Sem jogo encerrado, a grade dá lugar a "Ainda sem jogos encerrados".
 */
export function PlayerStats({ profile }: { profile: PlayerProfile }) {
  const { stats } = profile;
  if (stats.games === 0) {
    return (
      <EmptyState
        title="Ainda sem jogos encerrados"
        message={`As estatísticas de ${profile.nickname} aparecem depois da primeira votação fechada em que ele jogar.`}
      />
    );
  }
  const keeper = stats.goalkeeper;
  return (
    <>
      <section aria-labelledby="estatisticas" className="flex flex-col gap-3">
        <h2 id="estatisticas">
          <PixelText>Estatísticas</PixelText>
        </h2>
        <StreakBadge streak={stats.streak} />
        <StatsGrid
          cells={[
            { label: 'Jogos', value: stats.games },
            { label: 'Vitórias', value: stats.wins },
            { label: 'Empates', value: stats.draws },
            { label: 'Derrotas', value: stats.losses },
            { label: 'Gols', value: stats.goals },
            { label: 'Assistências', value: stats.assists },
            { label: 'Craque', value: stats.mvps },
            { label: 'Perna de Pau', value: stats.flops },
          ]}
        />
      </section>
      {keeper && keeper.games > 0 && (
        <section aria-labelledby="no-gol" className="flex flex-col gap-3">
          <h2 id="no-gol">
            <PixelText>No gol</PixelText>
          </h2>
          <StatsGrid
            cells={[
              { label: 'Jogos no gol', value: keeper.games },
              { label: 'Gols sofridos', value: keeper.conceded },
              { label: 'Sem sofrer gol', value: keeper.cleanSheets },
              {
                label: 'Sofridos por jogo',
                value:
                  keeper.concededPerGame === null ? '0' : formatAverage(keeper.concededPerGame),
              },
            ]}
          />
        </section>
      )}
      <LastRounds rounds={profile.lastRounds} />
    </>
  );
}

import { POSITION_LABELS, type FeedAlert, type Lineup, type PlayerAvatar } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { formatRoundWhen } from '../../lib/round-format';
import { TEAM_KEYS } from '../lineup/lineup-draft';
import { useLineup } from '../lineup/queries';
import { YouBanner } from '../lineup/you-banner';
import { RouteButton } from '../rounds/route-button';

/** A minha posição no time ("Zagueiro"), `null` se sou reserva, `undefined` enquanto os times não chegaram. */
function myPosition(lineup: Lineup | undefined, membershipId: string): string | null | undefined {
  if (!lineup) return undefined;
  for (const key of TEAM_KEYS) {
    const starter = lineup.teams[key].starters.find((p) => p.membershipId === membershipId);
    if (starter) return POSITION_LABELS[starter.position];
    if (lineup.teams[key].reserves.some((p) => p.membershipId === membershipId)) return null;
  }
  return undefined;
}

type Me = { membershipId: string; avatar: PlayerAvatar };

/**
 * Aviso grande dos times: grande momento neutro (contorno de 3px, sombra dura, entrada em degraus) com a faixa do
 * meu bonequinho ("Você joga no Preto") ou "Você não está escalado", e a tecla amarela "Ver os times" (a aba Times).
 */
export function TeamsPublishedCard({
  groupId,
  alert,
  me,
}: {
  groupId: string;
  alert: FeedAlert;
  me: Me;
}) {
  const lineup = useLineup(groupId, alert.roundId);
  const team = alert.me.team ?? null;
  return (
    <section
      aria-label="Times publicados"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
      style={{ boxShadow: '5px 5px 0 var(--color-shadow)' }}
    >
      <div className="flex items-center gap-3 bg-surface-3 px-4 py-4 shadow-[inset_0_-3px_0_0_var(--color-border-strong)]">
        <Icon name="teams" size={28} className="text-text" />
        <PixelText as="h2" size={24} wrap className="text-text [text-shadow:2px_2px_0_#000]">
          Times publicados
        </PixelText>
      </div>
      <div
        className="flex flex-col gap-4 p-4"
        style={{ '--moment-delay': '120ms' } as CSSProperties}
      >
        <div className="animate-row-in flex flex-col gap-1.5">
          <PixelText>{`Rodada ${alert.roundNumber}`}</PixelText>
          <PixelText wrap className="text-text-muted">
            {formatRoundWhen(alert.scheduledAt)}
          </PixelText>
        </div>
        <div className="animate-row-in [--moment-delay:180ms]">
          {team ? (
            <YouBanner
              team={team}
              avatar={me.avatar}
              position={myPosition(lineup.data, me.membershipId)}
            />
          ) : (
            <p className="flex items-center gap-3 bg-surface p-3 shadow-card">
              <Icon name="x" size={20} strokeWidth={3} className="shrink-0 text-text-muted" />
              <PixelText wrap>Você não está escalado</PixelText>
            </p>
          )}
        </div>
        <RouteButton
          to="/times"
          label="Ver os times"
          icon="teams"
          block
          className="animate-row-in [--moment-delay:260ms]"
        />
      </div>
    </section>
  );
}

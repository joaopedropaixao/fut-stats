import { POSITION_LABELS, ROUND_TRANSITION_ERROR_LABELS, type Lineup } from '@fut-stats/shared';
import { useMemo, useState } from 'react';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { draftFromLineup, membersOf, TEAM_KEYS, type TeamKey } from './lineup-draft';
import { Pitch } from './pitch';
import { Reserves } from './reserves';
import { TeamSegmented } from './team-segmented';
import { VsBoard } from './vs-board';
import { YouBanner } from './you-banner';

type PublishedTeamsProps = {
  lineup: Lineup;
  /** A rodada: o VS só toca na primeira vez de cada rodada. Sem ela (tela do admin), não há quadro de VS. */
  roundId?: string;
  /** Quem está vendo: o time dele abre primeiro, com a faixa "Você joga no ...". */
  myMembershipId?: string;
};

/** Os times publicados: o mesmo campo 1-2-3-1 da montagem, só para ver, um time de cada vez. */
export function PublishedTeams({ lineup, roundId, myMembershipId }: PublishedTeamsProps) {
  const draft = useMemo(() => draftFromLineup(lineup), [lineup]);
  const members = useMemo(() => membersOf(lineup), [lineup]);
  const me = TEAM_KEYS.flatMap((key) => [
    ...lineup.teams[key].starters.map((p) => ({ key, player: p, reserve: false })),
    ...lineup.teams[key].reserves.map((p) => ({ key, player: p, reserve: true })),
  ]).find((x) => x.player.membershipId === myMembershipId);
  const myTeam: TeamKey | null = me?.key ?? null;
  const counts = {
    WHITE: lineup.teams.WHITE.starters.length,
    BLACK: lineup.teams.BLACK.starters.length,
  };
  const [chosen, setChosen] = useState<TeamKey | null>(null);
  const team = chosen ?? myTeam ?? 'WHITE';

  return (
    <div className="flex flex-col gap-4">
      <Mismatch lineup={lineup} />
      {roundId && <VsBoard roundId={roundId} counts={counts} myTeam={myTeam} />}
      {me && (
        <YouBanner
          team={me.key}
          position={me.reserve ? null : POSITION_LABELS[me.player.position]}
        />
      )}
      <TeamSegmented value={team} onChange={setChosen} />
      <Pitch team={team} draft={draft[team]} members={members} meId={myMembershipId} />
      <Reserves
        team={team}
        reserves={draft[team].reserves}
        members={members}
        meId={myMembershipId}
      />
    </div>
  );
}

/**
 * Aviso para o admin: a presença mudou depois de publicar e os times não batem com os confirmados.
 * Quem desconfirmou aparece marcado "Sem presença" no campo; quem confirmou e ficou de fora aparece aqui.
 */
function Mismatch({ lineup }: { lineup: Lineup }) {
  if (lineup.errors.length === 0) return null;
  const reasons = [...new Set(lineup.errors.map((code) => ROUND_TRANSITION_ERROR_LABELS[code]))];
  return (
    <section
      role="alert"
      aria-label="Os times precisam de ajuste"
      className="flex flex-col gap-3 bg-warning/10 p-4 shadow-[inset_0_0_0_2px_var(--color-warning)]"
    >
      <div className="flex gap-3">
        <Icon name="alert" size={22} strokeWidth={2.2} className="shrink-0 text-warning" />
        <div className="flex flex-col gap-1.5">
          <PixelText wrap>Os times precisam de ajuste</PixelText>
          {reasons.map((reason) => (
            <p key={reason} className="text-sm text-text-muted">
              {reason}.
            </p>
          ))}
        </div>
      </div>
      {lineup.unassigned.length > 0 && (
        <div className="flex flex-col gap-1">
          <PixelText wrap className="text-text-muted">
            Confirmaram e estão fora dos times
          </PixelText>
          <p className="text-sm">{lineup.unassigned.map((m) => m.nickname).join(', ')}</p>
        </div>
      )}
      <p className="text-sm text-text-muted">
        Quem desconfirmou aparece com &quot;Sem presença&quot;. Despublique, acerte os times e
        publique de novo.
      </p>
    </section>
  );
}

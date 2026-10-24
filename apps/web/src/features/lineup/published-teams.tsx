import { ROUND_TRANSITION_ERROR_LABELS, TEAM_LABELS, type Lineup } from '@fut-stats/shared';
import { useMemo, useState } from 'react';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { draftFromLineup, membersOf, TEAM_KEYS, type TeamKey } from './lineup-draft';
import { Pitch } from './pitch';
import { Reserves } from './reserves';
import { TeamSegmented } from './team-segmented';

type PublishedTeamsProps = {
  lineup: Lineup;
  /** Quem está vendo: o time dele abre primeiro, com o selo "Você está no ...". */
  myMembershipId?: string;
};

/** Os times publicados: o mesmo campo 1-2-3-1 da montagem, só para ver, um time de cada vez. */
export function PublishedTeams({ lineup, myMembershipId }: PublishedTeamsProps) {
  const draft = useMemo(() => draftFromLineup(lineup), [lineup]);
  const members = useMemo(() => membersOf(lineup), [lineup]);
  const myTeam: TeamKey | null =
    TEAM_KEYS.find((key) =>
      [...lineup.teams[key].starters, ...lineup.teams[key].reserves].some(
        (p) => p.membershipId === myMembershipId,
      ),
    ) ?? null;
  const [chosen, setChosen] = useState<TeamKey | null>(null);
  const team = chosen ?? myTeam ?? 'WHITE';

  return (
    <div className="flex flex-col gap-4">
      <Mismatch lineup={lineup} />
      <TeamSegmented value={team} onChange={setChosen} />
      {team === myTeam && (
        <Badge
          label={`Você está no ${TEAM_LABELS[team]}`}
          variant={team === 'WHITE' ? 'white' : 'black'}
          className="self-start"
        />
      )}
      <Pitch team={team} draft={draft[team]} members={members} />
      <Reserves team={team} reserves={draft[team].reserves} members={members} />
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
          <PixelText className="text-text-muted">Confirmaram e estão fora dos times</PixelText>
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

import type { Lineup } from '@fut-stats/shared';
import { useMemo, useState } from 'react';
import { draftFromLineup, membersOf, type TeamKey } from './lineup-draft';
import { Pitch } from './pitch';
import { Reserves } from './reserves';
import { TeamSegmented } from './team-segmented';

/** Os times publicados: o mesmo campo 1-2-3-1 da montagem, só para ver, um time de cada vez. */
export function PublishedTeams({ lineup }: { lineup: Lineup }) {
  const [team, setTeam] = useState<TeamKey>('WHITE');
  const draft = useMemo(() => draftFromLineup(lineup), [lineup]);
  const members = useMemo(() => membersOf(lineup), [lineup]);
  return (
    <div className="flex flex-col gap-4">
      <TeamSegmented value={team} onChange={setTeam} />
      <Pitch team={team} draft={draft[team]} members={members} />
      <Reserves team={team} reserves={draft[team].reserves} members={members} />
    </div>
  );
}

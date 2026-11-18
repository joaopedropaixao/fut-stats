import type { RosterMember, UpdateMemberInput } from '@fut-stats/shared';

/** A mudança do menu ⋯ aparece na lista na hora (a resposta da API confirma ou desfaz). */
export function applyRosterChange(
  roster: readonly RosterMember[],
  membershipId: string,
  change: Pick<UpdateMemberInput, 'role' | 'active'>,
): RosterMember[] {
  return roster.map((member) =>
    member.id === membershipId
      ? {
          ...member,
          ...(change.role === undefined ? {} : { role: change.role }),
          ...(change.active === undefined ? {} : { active: change.active }),
        }
      : member,
  );
}

/** Ativos e inativos, na ordem em que a API mandou (ativos primeiro, cada bloco por apelido). */
export function splitRoster(roster: readonly RosterMember[]): {
  active: RosterMember[];
  inactive: RosterMember[];
} {
  return {
    active: roster.filter((member) => member.active),
    inactive: roster.filter((member) => !member.active),
  };
}

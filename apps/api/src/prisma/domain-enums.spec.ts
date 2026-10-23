import {
  MATCH_EVENT_TYPES,
  POSITIONS,
  ROLES,
  TEAMS,
  type MatchEventType,
  type Position,
  type Role,
  type Team,
} from '@fut-stats/domain';
import {
  MatchEventType as DbMatchEventType,
  Position as DbPosition,
  Role as DbRole,
  Team as DbTeam,
} from '../generated/prisma/enums';

// O Prisma gera os próprios enums a partir do schema. Estes testes garantem que eles continuam
// iguais aos do domain: se alguém mudar um lado só, o typecheck e o teste quebram.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const positionTypesMatch: Equals<DbPosition, Position> = true;
const teamTypesMatch: Equals<DbTeam, Team> = true;
const roleTypesMatch: Equals<DbRole, Role> = true;
const matchEventTypesMatch: Equals<DbMatchEventType, MatchEventType> = true;

describe('enums do banco x domain', () => {
  it('Position tem os mesmos valores, na mesma ordem', () => {
    expect(positionTypesMatch).toBe(true);
    expect(Object.values(DbPosition)).toEqual([...POSITIONS]);
  });

  it('Team tem os mesmos valores, na mesma ordem', () => {
    expect(teamTypesMatch).toBe(true);
    expect(Object.values(DbTeam)).toEqual([...TEAMS]);
  });

  it('Role tem os mesmos valores, na mesma ordem', () => {
    expect(roleTypesMatch).toBe(true);
    expect(Object.values(DbRole)).toEqual([...ROLES]);
  });

  it('MatchEventType tem os mesmos valores, na mesma ordem', () => {
    expect(matchEventTypesMatch).toBe(true);
    expect(Object.values(DbMatchEventType)).toEqual([...MATCH_EVENT_TYPES]);
  });
});

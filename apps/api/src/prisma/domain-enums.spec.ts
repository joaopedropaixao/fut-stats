import { POSITIONS, TEAMS, type Position, type Team } from '@fut-stats/domain';
import { Position as DbPosition, Team as DbTeam } from '../generated/prisma/enums';

// O Prisma gera os próprios enums a partir do schema. Estes testes garantem que eles continuam
// iguais aos do domain: se alguém mudar um lado só, o typecheck e o teste quebram.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const positionTypesMatch: Equals<DbPosition, Position> = true;
const teamTypesMatch: Equals<DbTeam, Team> = true;

describe('enums do banco x domain', () => {
  it('Position tem os mesmos valores, na mesma ordem', () => {
    expect(positionTypesMatch).toBe(true);
    expect(Object.values(DbPosition)).toEqual([...POSITIONS]);
  });

  it('Team tem os mesmos valores, na mesma ordem', () => {
    expect(teamTypesMatch).toBe(true);
    expect(Object.values(DbTeam)).toEqual([...TEAMS]);
  });
});

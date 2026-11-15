import {
  AVATAR_HAIR_COLORS,
  AVATAR_HAIRS,
  AVATAR_SKINS,
  MATCH_EVENT_TYPES,
  POSITIONS,
  ROLES,
  ROUND_STATUSES,
  TEAMS,
  type AvatarHair,
  type AvatarHairColor,
  type AvatarSkin,
  type MatchEventType,
  type Position,
  type Role,
  type RoundStatus,
  type Team,
} from '@fut-stats/domain';
import {
  AvatarHair as DbAvatarHair,
  AvatarHairColor as DbAvatarHairColor,
  AvatarSkin as DbAvatarSkin,
  MatchEventType as DbMatchEventType,
  Position as DbPosition,
  Role as DbRole,
  RoundStatus as DbRoundStatus,
  Team as DbTeam,
} from '../generated/prisma/enums';

// O Prisma gera os próprios enums a partir do schema. Estes testes garantem que eles continuam
// iguais aos do domain: se alguém mudar um lado só, o typecheck e o teste quebram.
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const positionTypesMatch: Equals<DbPosition, Position> = true;
const teamTypesMatch: Equals<DbTeam, Team> = true;
const roleTypesMatch: Equals<DbRole, Role> = true;
const roundStatusTypesMatch: Equals<DbRoundStatus, RoundStatus> = true;
const avatarSkinTypesMatch: Equals<DbAvatarSkin, AvatarSkin> = true;
const avatarHairTypesMatch: Equals<DbAvatarHair, AvatarHair> = true;
const avatarHairColorTypesMatch: Equals<DbAvatarHairColor, AvatarHairColor> = true;
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

  it('RoundStatus tem os mesmos valores, na mesma ordem', () => {
    expect(roundStatusTypesMatch).toBe(true);
    expect(Object.values(DbRoundStatus)).toEqual([...ROUND_STATUSES]);
  });

  it('AvatarSkin tem os mesmos valores, na mesma ordem', () => {
    expect(avatarSkinTypesMatch).toBe(true);
    expect(Object.values(DbAvatarSkin)).toEqual([...AVATAR_SKINS]);
  });

  it('AvatarHair tem os mesmos valores, na mesma ordem', () => {
    expect(avatarHairTypesMatch).toBe(true);
    expect(Object.values(DbAvatarHair)).toEqual([...AVATAR_HAIRS]);
  });

  it('AvatarHairColor tem os mesmos valores, na mesma ordem', () => {
    expect(avatarHairColorTypesMatch).toBe(true);
    expect(Object.values(DbAvatarHairColor)).toEqual([...AVATAR_HAIR_COLORS]);
  });
});

import type { PlayerAvatar, UpdateMemberInput } from '@fut-stats/shared';
import { sameAvatar } from '../../lib/avatar';
import type { Position } from './position-picker';

/** Os campos do formulário de perfil (e, para o admin, os três de baixo). */
export type MemberFormValues = {
  nickname: string;
  avatar: PlayerAvatar;
  primaryPosition: Position;
  secondaryPositions: readonly Position[];
  /** Só o admin muda os três campos abaixo. */
  initialRating: number;
  isHiredGoalkeeper: boolean;
  isAdmin: boolean;
};

function samePositions(a: readonly Position[], b: readonly Position[]): boolean {
  return a.length === b.length && a.every((position) => b.includes(position));
}

/**
 * O corpo do PATCH: só o que mudou. As duas posições vão juntas (a API valida o estado final). Os campos de admin
 * só entram quando `adminFields` (o jogador comum recebe 403 se mandar); o papel nunca vai na edição de si mesmo.
 */
export function memberChanges(
  initial: MemberFormValues,
  current: MemberFormValues,
  { adminFields, isMe }: { adminFields: boolean; isMe: boolean },
): UpdateMemberInput {
  const changes: UpdateMemberInput = {};
  const nickname = current.nickname.trim();
  if (nickname !== initial.nickname) changes.nickname = nickname;
  if (!sameAvatar(initial.avatar, current.avatar)) changes.avatar = current.avatar;
  if (
    initial.primaryPosition !== current.primaryPosition ||
    !samePositions(initial.secondaryPositions, current.secondaryPositions)
  ) {
    changes.primaryPosition = current.primaryPosition;
    changes.secondaryPositions = [...current.secondaryPositions];
  }
  if (adminFields) {
    if (initial.initialRating !== current.initialRating) {
      changes.initialRating = current.initialRating;
    }
    if (initial.isHiredGoalkeeper !== current.isHiredGoalkeeper) {
      changes.isHiredGoalkeeper = current.isHiredGoalkeeper;
    }
    if (!isMe && initial.isAdmin !== current.isAdmin) {
      changes.role = current.isAdmin ? 'ADMIN' : 'PLAYER';
    }
  }
  return changes;
}

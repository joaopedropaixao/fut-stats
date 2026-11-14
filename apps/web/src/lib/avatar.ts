import { avatarSchema, joinGroupSchema, type PlayerAvatar } from '@fut-stats/shared';

/**
 * As listas do bonequinho vêm do contrato (`avatarSchema`): o domain é quem define as opções e o web
 * só as desenha. O `DEFAULT_AVATAR` é o que a API devolve quando o cliente não manda `avatar`.
 */
export const AVATAR_SKINS = avatarSchema.shape.skin.options;
export const AVATAR_HAIRS = avatarSchema.shape.hair.options;
export const AVATAR_HAIR_COLORS = avatarSchema.shape.hairColor.options;

export type AvatarSkin = PlayerAvatar['skin'];
export type AvatarHair = PlayerAvatar['hair'];
export type AvatarHairColor = PlayerAvatar['hairColor'];

export const DEFAULT_AVATAR: PlayerAvatar = joinGroupSchema.shape.avatar.parse(undefined);

/** Dois bonequinhos são o mesmo? */
export function sameAvatar(a: PlayerAvatar, b: PlayerAvatar): boolean {
  return a.skin === b.skin && a.hair === b.hair && a.hairColor === b.hairColor;
}

/**
 * Uma combinação qualquer das listas, diferente de `avoid` (o "Sortear" sempre muda alguma coisa).
 * `pick` devolve um número em [0, 1): injetável para testar.
 */
export function randomAvatar(avoid?: PlayerAvatar, pick: () => number = Math.random): PlayerAvatar {
  const at = <T>(list: readonly T[]): T =>
    list[Math.min(Math.floor(pick() * list.length), list.length - 1)]!;
  for (let tries = 0; ; tries += 1) {
    const next = {
      skin: at(AVATAR_SKINS),
      hair: at(AVATAR_HAIRS),
      hairColor: at(AVATAR_HAIR_COLORS),
    };
    if (!avoid || !sameAvatar(next, avoid) || tries >= 20) return next;
  }
}

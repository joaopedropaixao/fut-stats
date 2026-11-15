import type { PlayerAvatar } from '@fut-stats/domain';

/** As três colunas do bonequinho na `Membership`: junte ao `select` de quem devolve `avatar`. */
export const AVATAR_SELECT = {
  avatarSkin: true,
  avatarHair: true,
  avatarHairColor: true,
} as const;

interface AvatarColumns {
  avatarSkin: PlayerAvatar['skin'];
  avatarHair: PlayerAvatar['hair'];
  avatarHairColor: PlayerAvatar['hairColor'];
}

/** As colunas da `Membership` no formato do contrato (`avatar`). */
export function toAvatar(row: AvatarColumns): PlayerAvatar {
  return { skin: row.avatarSkin, hair: row.avatarHair, hairColor: row.avatarHairColor };
}

/** O `avatar` do contrato nas colunas da `Membership` (para criar e atualizar). */
export function fromAvatar(avatar: PlayerAvatar): AvatarColumns {
  return { avatarSkin: avatar.skin, avatarHair: avatar.hair, avatarHairColor: avatar.hairColor };
}

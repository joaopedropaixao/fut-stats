/** Bonequinho pixel do jogador: o rosto dele no app. Fica na participação (é o jogador naquela pelada). */

/** Tons de pele, do mais claro ao mais escuro. */
export const AVATAR_SKINS = ['LIGHT', 'FAIR', 'TAN', 'BROWN', 'DARK'] as const;
/** Estilos de cabelo. Careca ignora a cor do cabelo. */
export const AVATAR_HAIRS = ['BALD', 'SHORT', 'CURLY', 'AFRO', 'LONG', 'MOHAWK'] as const;
/** Cores de cabelo. */
export const AVATAR_HAIR_COLORS = ['BLACK', 'BROWN', 'BLOND', 'RED', 'GRAY'] as const;

export type AvatarSkin = (typeof AVATAR_SKINS)[number];
export type AvatarHair = (typeof AVATAR_HAIRS)[number];
export type AvatarHairColor = (typeof AVATAR_HAIR_COLORS)[number];

export interface PlayerAvatar {
  skin: AvatarSkin;
  hair: AvatarHair;
  hairColor: AvatarHairColor;
}

/** Bonequinho de quem ainda não montou o seu. */
export const DEFAULT_AVATAR: PlayerAvatar = { skin: 'TAN', hair: 'SHORT', hairColor: 'BLACK' };

/**
 * Nota inicial de quem entra no grupo (pelo convite ou criando). Só referência visual e ponto de partida do
 * seletor de times até o admin ajustar no perfil; a primeira média medida sai da primeira rodada com votos.
 */
export const DEFAULT_INITIAL_RATING = 6;

/** Apelido do jogador no grupo: até 10 caracteres, sem contar espaço nas pontas. */
export const NICKNAME_MAX_LENGTH = 10;

/** Nome do grupo (pelada): até 50 caracteres, sem contar espaço nas pontas. */
export const GROUP_NAME_MAX_LENGTH = 50;

/** Por que um texto (apelido, nome do grupo) é inválido. Textos de UI no shared. */
export const TEXT_FIELD_ERRORS = ['EMPTY', 'TOO_LONG'] as const;

export type TextFieldError = (typeof TEXT_FIELD_ERRORS)[number];

/** Por que o usuário não pode entrar no grupo pelo convite. Textos em `JOIN_GROUP_ERROR_LABELS` (shared). */
export const JOIN_GROUP_ERRORS = ['MEMBERSHIP_INACTIVE'] as const;

export type JoinGroupError = (typeof JOIN_GROUP_ERRORS)[number];

/** Slug de quem não tem letra nem número no nome (ex.: só emoji). */
const FALLBACK_SLUG = 'pelada';

// Conta caracteres, não unidades UTF-16: emoji conta como um.
function validateText(value: string, max: number): TextFieldError | null {
  const length = [...value.trim()].length;
  if (length === 0) return 'EMPTY';
  if (length > max) return 'TOO_LONG';
  return null;
}

export function validateNickname(value: string): TextFieldError | null {
  return validateText(value, NICKNAME_MAX_LENGTH);
}

export function validateGroupName(value: string): TextFieldError | null {
  return validateText(value, GROUP_NAME_MAX_LENGTH);
}

/** Slug do nome: minúsculo, sem acento, só letras/números separados por hífen. Ex.: "Pelada do Zé" → "pelada-do-ze". */
export function toSlug(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || FALLBACK_SLUG;
}

/** A base, se livre; senão a base com o menor sufixo livre a partir de 2 (`pelada-2`, `pelada-3`...). */
export function nextAvailableSlug(base: string, taken: readonly string[]): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Pode entrar pelo convite? Sem participação ou já ativo → `null` (ativo não duplica: a entrada é reaproveitada).
 * Inativo → `'MEMBERSHIP_INACTIVE'`: desativação é do admin, o convite não reativa.
 */
export function validateJoinGroup(existing: { active: boolean } | null): JoinGroupError | null {
  return existing && !existing.active ? 'MEMBERSHIP_INACTIVE' : null;
}

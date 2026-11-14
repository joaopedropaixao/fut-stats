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
export const TEXT_FIELD_ERRORS = ['EMPTY', 'TOO_LONG', 'INVALID_CHARACTERS'] as const;

export type TextFieldError = (typeof TEXT_FIELD_ERRORS)[number];

/** Por que o usuário não pode entrar no grupo pelo convite. Textos em `JOIN_GROUP_ERROR_LABELS` (shared). */
export const JOIN_GROUP_ERRORS = ['MEMBERSHIP_INACTIVE'] as const;

export type JoinGroupError = (typeof JOIN_GROUP_ERRORS)[number];

/** Slug de quem não tem letra nem número no nome (ex.: só emoji). */
const FALLBACK_SLUG = 'pelada';

// Caractere inválido em apelido/nome: controle (C0 e C1, inclui o \0 que o Postgres recusa), surrogate solto,
// quebra de linha e parágrafo Unicode, formatação invisível (espaço de largura zero, BOM, inversão de direção) e os
// que parecem vazios (preenchedores Hangul, Braille em branco). Ficam de fora os "cola-emoji" (EMOJI_JOINERS), que
// só valem dentro de um emoji (ver validateText).
const INVALID_CHARACTERS =
  /[\p{Cc}\p{Cs}\p{Zl}\p{Zp}\u115F\u1160\u2800\u3164\uFFA0]|(?![\u200D\u{E0020}-\u{E007F}])\p{Cf}/u;

/** ZWJ, seletores de variação e tags: invisíveis, só fazem sentido montando um emoji. */
const EMOJI_JOINERS = /\u200D|\p{Variation_Selector}|[\u{E0020}-\u{E007F}]/u;

/** Base de emoji: pictograma, bandeira (indicador regional) ou tecla numérica (U+20E3). */
const EMOJI_BASE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;

/** Todo caractere visível tem uma letra, número, pontuação, símbolo ou espaço; ZWJ/tag/acento soltos, não. */
const VISIBLE = /[\p{L}\p{N}\p{P}\p{S}\p{Zs}]/u;

/** Teto de pontos de código num caractere visível: cobre emoji composto (família com tom = 11), barra acento empilhado. */
const MAX_CODE_POINTS_PER_CHARACTER = 12;

/**
 * O texto tem caractere que não pode aparecer em apelido, nome ou caminho de URL (controle, quebra de linha,
 * invisível)? Fonte única da regra: a API usa no caminho das rotas; `validateNickname`/`validateGroupName` aqui.
 */
export function hasInvalidCharacters(text: string): boolean {
  return INVALID_CHARACTERS.test(text);
}

let graphemeSegmenter: Intl.Segmenter | null | undefined;

// Criado só no primeiro uso: navegador sem Intl.Segmenter não quebra ao importar o pacote.
function splitCharacters(text: string): string[] {
  if (graphemeSegmenter === undefined) {
    graphemeSegmenter =
      typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter('pt', { granularity: 'grapheme' })
        : null;
  }
  // Sem Segmenter, conta ponto de código: mais rígido (emoji composto conta mais), nunca mais frouxo.
  if (!graphemeSegmenter) return [...text];
  return Array.from(graphemeSegmenter.segment(text), ({ segment }) => segment);
}

// Conta o caractere visível (grafema): acento decomposto e emoji com tom de pele contam como um.
function validateText(value: string, max: number): TextFieldError | null {
  const text = value.trim();
  if (hasInvalidCharacters(text)) return 'INVALID_CHARACTERS';
  if (text.length === 0) return 'EMPTY';
  // Corta antes de segmentar: mais pontos de código que isso já não cabe no limite.
  if ([...text].length > max * MAX_CODE_POINTS_PER_CHARACTER) return 'TOO_LONG';
  const characters = splitCharacters(text);
  const hidden = (c: string) => !VISIBLE.test(c) || (EMOJI_JOINERS.test(c) && !EMOJI_BASE.test(c));
  if (characters.some(hidden)) return 'INVALID_CHARACTERS';
  if (characters.some((c) => [...c].length > MAX_CODE_POINTS_PER_CHARACTER)) return 'TOO_LONG';
  if (characters.length > max) return 'TOO_LONG';
  return null;
}

/** Ordem alfabética do português: ignora maiúscula e acento ("Ávila" junto de "avião"). */
const nicknameCollator = new Intl.Collator('pt-BR', { sensitivity: 'base' });

/**
 * Compara apelidos para ordenar a lista de membros. Iguais → 0: com `Array.sort` (estável), o desempate é a ordem
 * de chegada (quem entrou primeiro).
 */
export function compareNicknames(a: string, b: string): number {
  return nicknameCollator.compare(a, b);
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
    .replace(/[\u0300-\u036F]/g, '')
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

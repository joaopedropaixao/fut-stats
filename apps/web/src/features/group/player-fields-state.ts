import { joinGroupSchema, type JoinGroupInput, type PlayerAvatar } from '@fut-stats/shared';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import type { Position } from './position-picker';

export type PlayerFieldErrors = { nickname?: string; primaryPosition?: string };

export type PlayerFieldsState = {
  nickname: string;
  position: Position | null;
  /** O bonequinho montado: já começa com o padrão selecionado. */
  avatar: PlayerAvatar;
  errors: PlayerFieldErrors;
};

export type PlayerFieldsAction =
  | { type: 'nickname'; value: string }
  | { type: 'position'; value: Position }
  | { type: 'avatar'; value: PlayerAvatar }
  | { type: 'errors'; errors: PlayerFieldErrors };

export const initialPlayerFields: PlayerFieldsState = {
  nickname: '',
  position: null,
  avatar: DEFAULT_AVATAR,
  errors: {},
};

/** Mexer num campo apaga o erro dele (e só dele): o aviso não fica na tela depois de corrigido. */
export function playerFieldsReducer(
  state: PlayerFieldsState,
  action: PlayerFieldsAction,
): PlayerFieldsState {
  switch (action.type) {
    case 'nickname':
      return { ...state, nickname: action.value, errors: { ...state.errors, nickname: undefined } };
    case 'position':
      return {
        ...state,
        position: action.value,
        errors: { ...state.errors, primaryPosition: undefined },
      };
    case 'avatar':
      return { ...state, avatar: action.value };
    case 'errors':
      return { ...state, errors: action.errors };
  }
}

/** Valida com o contrato compartilhado: devolve os dados prontos ou um erro por campo. */
export function validatePlayerFields(
  state: Pick<PlayerFieldsState, 'nickname' | 'position' | 'avatar'>,
): { data: JoinGroupInput } | { errors: PlayerFieldErrors } {
  const parsed = joinGroupSchema.safeParse({
    nickname: state.nickname,
    primaryPosition: state.position ?? undefined,
    avatar: state.avatar,
  });
  if (parsed.success) return { data: parsed.data };
  const errors: PlayerFieldErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (key === 'nickname') errors.nickname ??= issue.message;
    if (key === 'primaryPosition') errors.primaryPosition ??= 'Escolha sua posição';
  }
  return { errors };
}

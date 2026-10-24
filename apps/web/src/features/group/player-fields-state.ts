import { joinGroupSchema, type JoinGroupInput } from '@fut-stats/shared';
import type { Position } from './position-picker';

export type PlayerFieldErrors = { nickname?: string; primaryPosition?: string };

export type PlayerFieldsState = {
  nickname: string;
  position: Position | null;
  errors: PlayerFieldErrors;
};

export type PlayerFieldsAction =
  | { type: 'nickname'; value: string }
  | { type: 'position'; value: Position }
  | { type: 'errors'; errors: PlayerFieldErrors };

export const initialPlayerFields: PlayerFieldsState = { nickname: '', position: null, errors: {} };

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
    case 'errors':
      return { ...state, errors: action.errors };
  }
}

/** Valida com o contrato compartilhado: devolve os dados prontos ou um erro por campo. */
export function validatePlayerFields(
  state: Pick<PlayerFieldsState, 'nickname' | 'position'>,
): { data: JoinGroupInput } | { errors: PlayerFieldErrors } {
  const parsed = joinGroupSchema.safeParse({
    nickname: state.nickname,
    primaryPosition: state.position ?? undefined,
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

import type { JoinGroupInput } from '@fut-stats/shared';
import { useReducer } from 'react';
import { TextField } from '../../components/ui/text-field';
import { AvatarBuilder } from './avatar-builder';
import {
  initialPlayerFields,
  playerFieldsReducer,
  validatePlayerFields,
} from './player-fields-state';
import { PositionPicker } from './position-picker';

type PlayerFieldsOptions = {
  /** Erro que veio da API para o apelido (ex.: "Esse apelido já está em uso no grupo"). */
  nicknameError?: string;
  /** A pessoa mexeu no apelido: quem enviou pode limpar o erro da API. */
  onNicknameInput?: () => void;
};

/**
 * Apelido, bonequinho e posição: o que quem entra numa pelada preenche. A validação é a do contrato
 * compartilhado. O bonequinho e o resto ficam no estado mesmo quando a API recusa o apelido.
 */
export function usePlayerFields({ nicknameError, onNicknameInput }: PlayerFieldsOptions = {}) {
  const [state, dispatch] = useReducer(playerFieldsReducer, initialPlayerFields);

  function validate(): JoinGroupInput | null {
    const result = validatePlayerFields(state);
    dispatch({ type: 'errors', errors: 'errors' in result ? result.errors : {} });
    return 'data' in result ? result.data : null;
  }

  const fields = (
    <>
      <TextField
        label="Seu apelido"
        hint="Até 10 letras. É como o pessoal vai te ver."
        value={state.nickname}
        onChange={(e) => {
          dispatch({ type: 'nickname', value: e.target.value });
          onNicknameInput?.();
        }}
        autoCapitalize="words"
        error={state.errors.nickname ?? nicknameError}
        data-field="nickname"
        autoComplete="off"
      />
      <AvatarBuilder
        value={state.avatar}
        nickname={state.nickname}
        onChange={(value) => dispatch({ type: 'avatar', value })}
      />
      <PositionPicker
        value={state.position}
        onChange={(value) => dispatch({ type: 'position', value })}
        error={state.errors.primaryPosition}
      />
    </>
  );

  const errors = {
    nickname: state.errors.nickname ?? nicknameError,
    primaryPosition: state.errors.primaryPosition,
  };
  return { fields, validate, errors };
}

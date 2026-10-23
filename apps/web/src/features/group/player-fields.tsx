import type { JoinGroupInput } from '@fut-stats/shared';
import { useReducer } from 'react';
import { TextField } from '../../components/ui/text-field';
import {
  initialPlayerFields,
  playerFieldsReducer,
  validatePlayerFields,
} from './player-fields-state';
import { PositionPicker } from './position-picker';

/** Apelido + posição, os dois campos de quem entra numa pelada. A validação é a do contrato compartilhado. */
export function usePlayerFields() {
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
        onChange={(e) => dispatch({ type: 'nickname', value: e.target.value })}
        autoCapitalize="words"
        error={state.errors.nickname}
        autoComplete="off"
      />
      <PositionPicker
        value={state.position}
        onChange={(value) => dispatch({ type: 'position', value })}
        error={state.errors.primaryPosition}
      />
    </>
  );

  return { fields, validate };
}

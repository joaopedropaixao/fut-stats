import { describe, expect, it } from 'vitest';
import {
  initialPlayerFields,
  playerFieldsReducer,
  validatePlayerFields,
} from './player-fields-state';

describe('validatePlayerFields', () => {
  it('aponta o erro de cada campo vazio', () => {
    expect(validatePlayerFields(initialPlayerFields)).toEqual({
      errors: { nickname: 'Informe o apelido', primaryPosition: 'Escolha sua posição' },
    });
  });

  it('devolve os dados com o apelido sem espaço nas pontas', () => {
    expect(validatePlayerFields({ nickname: '  Bia ', position: 'DEFENDER' })).toEqual({
      data: { nickname: 'Bia', primaryPosition: 'DEFENDER' },
    });
  });
});

describe('playerFieldsReducer', () => {
  const withErrors = playerFieldsReducer(initialPlayerFields, {
    type: 'errors',
    errors: { nickname: 'Informe o apelido', primaryPosition: 'Escolha sua posição' },
  });

  // Bug: depois de enviar vazio, o "Informe o apelido" continuava na tela com o apelido já digitado
  it('digitar o apelido apaga só o erro do apelido', () => {
    const next = playerFieldsReducer(withErrors, { type: 'nickname', value: 'Bia' });
    expect(next.errors).toEqual({ nickname: undefined, primaryPosition: 'Escolha sua posição' });
  });

  it('escolher a posição apaga só o erro da posição', () => {
    const next = playerFieldsReducer(withErrors, { type: 'position', value: 'GOALKEEPER' });
    expect(next.errors).toEqual({ nickname: 'Informe o apelido', primaryPosition: undefined });
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_AVATAR } from '../../lib/avatar';
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
    expect(
      validatePlayerFields({ nickname: '  Bia ', position: 'DEFENDER', avatar: DEFAULT_AVATAR }),
    ).toEqual({
      data: { nickname: 'Bia', primaryPosition: 'DEFENDER', avatar: DEFAULT_AVATAR },
    });
  });

  it('leva o bonequinho montado para o corpo do pedido', () => {
    const avatar = { skin: 'DARK', hair: 'AFRO', hairColor: 'RED' } as const;
    expect(validatePlayerFields({ nickname: 'Bia', position: 'WINGER', avatar })).toEqual({
      data: { nickname: 'Bia', primaryPosition: 'WINGER', avatar },
    });
  });
});

describe('playerFieldsReducer', () => {
  it('começa com o bonequinho padrão e guarda o que a pessoa monta', () => {
    expect(initialPlayerFields.avatar).toEqual(DEFAULT_AVATAR);
    const avatar = { skin: 'LIGHT', hair: 'LONG', hairColor: 'BLOND' } as const;
    expect(
      playerFieldsReducer(initialPlayerFields, { type: 'avatar', value: avatar }).avatar,
    ).toEqual(avatar);
  });

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

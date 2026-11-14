import { describe, expect, it } from 'vitest';
import { isNicknameTaken, validateMemberAdminChange } from './members';

describe('isNicknameTaken', () => {
  const others = ['Zé', 'Beto'];

  it('C6: ignora maiúscula e acento', () => {
    expect(isNicknameTaken('ze', others)).toBe(true);
    expect(isNicknameTaken('BETO', others)).toBe(true);
  });

  it('C6: ignora espaço nas pontas', () => {
    expect(isNicknameTaken('ZÉ ', others)).toBe(true);
  });

  it('C6: apelido diferente passa', () => {
    expect(isNicknameTaken('Zeca', others)).toBe(false);
  });

  it('C6: grupo sem outros apelidos', () => {
    expect(isNicknameTaken('Zé', [])).toBe(false);
  });
});

describe('validateMemberAdminChange', () => {
  it('C7: admin mudando o papel ou o ativo de outro membro', () => {
    expect(validateMemberAdminChange('a', 'b', { role: 'ADMIN' })).toEqual([]);
    expect(validateMemberAdminChange('a', 'b', { role: 'PLAYER' })).toEqual([]);
    expect(validateMemberAdminChange('a', 'b', { active: false })).toEqual([]);
    expect(validateMemberAdminChange('a', 'b', { role: 'PLAYER', active: false })).toEqual([]);
  });

  it('C8: admin mudando o próprio papel', () => {
    expect(validateMemberAdminChange('a', 'a', { role: 'PLAYER' })).toEqual(['SELF_CHANGE']);
  });

  it('C8: admin mudando o próprio ativo', () => {
    expect(validateMemberAdminChange('a', 'a', { active: false })).toEqual(['SELF_CHANGE']);
  });

  it('C8: os dois ao mesmo tempo não repete o código', () => {
    expect(validateMemberAdminChange('a', 'a', { role: 'PLAYER', active: false })).toEqual([
      'SELF_CHANGE',
    ]);
  });

  it('C8: mudar o próprio ativo para true também é SELF_CHANGE', () => {
    expect(validateMemberAdminChange('a', 'a', { active: true })).toEqual(['SELF_CHANGE']);
  });

  it('C8: sem mudar papel nem ativo (nota inicial, goleiro contratado) não há erro', () => {
    expect(validateMemberAdminChange('a', 'a', {})).toEqual([]);
  });
});

import { NICKNAME_TAKEN_LABEL } from '@fut-stats/shared';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_AVATAR } from '../../lib/avatar';
import { ApiError } from '../../lib/api';
import {
  firstFieldError,
  nicknameErrorFromIssues,
  revealField,
  submitNotice,
} from './field-errors';
import { validatePlayerFields } from './player-fields-state';
import { nicknameTakenMessage } from './use-enter-group';

const ORDER = ['name', 'nickname', 'primaryPosition'];

describe('primeiro campo com erro (C55)', () => {
  it('C55: escolhe o campo mais acima na ordem da tela, não o primeiro a falhar', () => {
    const errors = { primaryPosition: 'Escolha sua posição', nickname: 'Digite seu apelido' };
    expect(firstFieldError(ORDER, errors)).toEqual({
      field: 'nickname',
      message: 'Digite seu apelido',
    });
  });

  it('C55: o nome da pelada vem antes do apelido em /comecar', () => {
    expect(firstFieldError(ORDER, { nickname: 'x', name: 'Dê um nome à pelada' })?.field).toBe(
      'name',
    );
  });

  it('C55: sem erro, ou com erro vazio, não há campo para ir', () => {
    expect(firstFieldError(ORDER, {})).toBeNull();
    expect(firstFieldError(ORDER, { nickname: undefined, name: '' })).toBeNull();
  });

  it('C55: campo fora da ordem da tela é ignorado', () => {
    expect(firstFieldError(['nickname'], { outro: 'erro' })).toBeNull();
  });

  it('C55: apelido em uso (409 NICKNAME_TAKEN da API) é o erro do campo apelido', () => {
    const error = new ApiError(409, '/invites/x/join', { code: 'NICKNAME_TAKEN' });
    const message = nicknameTakenMessage(error);
    expect(message).toBe(NICKNAME_TAKEN_LABEL);
    expect(firstFieldError(ORDER, { nickname: message })).toEqual({
      field: 'nickname',
      message: NICKNAME_TAKEN_LABEL,
    });
  });

  it('C55: outro erro da API (rede, 500) não é erro de campo e não vira aviso', () => {
    expect(nicknameTakenMessage(new ApiError(500, '/groups'))).toBeUndefined();
    expect(nicknameTakenMessage(new Error('rede'))).toBeUndefined();
  });

  it('C55: formulário vazio de começar: o primeiro campo é o apelido e o aviso traz o texto dele', () => {
    const result = validatePlayerFields({ nickname: '', position: null, avatar: DEFAULT_AVATAR });
    const errors = 'errors' in result ? result.errors : {};
    const first = firstFieldError(['nickname', 'primaryPosition'], errors);
    expect(first?.field).toBe('nickname');
    expect(submitNotice(['nickname', 'primaryPosition'], errors, true)).toBe(first?.message);
  });

  it('C55: só a posição faltando: o campo é a posição e o aviso diz "Escolha sua posição"', () => {
    const errors = { primaryPosition: 'Escolha sua posição' };
    expect(firstFieldError(['nickname', 'primaryPosition'], errors)?.field).toBe('primaryPosition');
    expect(submitNotice(['nickname', 'primaryPosition'], errors, true)).toBe('Escolha sua posição');
  });

  it('C55: o aviso só aparece depois de tentar enviar', () => {
    expect(submitNotice(ORDER, { nickname: 'Muito longo' }, false)).toBeUndefined();
    expect(submitNotice(ORDER, { nickname: 'Muito longo' }, true)).toBe('Muito longo');
    expect(submitNotice(ORDER, {}, true)).toBeUndefined();
  });

  it('C55: na edição, o erro de apelido da validação (ou o primeiro que vier) vai para o campo apelido', () => {
    const issues = [
      { path: ['isAdmin'], message: 'outro' },
      { path: ['nickname'], message: 'Até 10 letras' },
    ];
    expect(nicknameErrorFromIssues(issues)).toBe('Até 10 letras');
    expect(nicknameErrorFromIssues([{ path: ['isAdmin'], message: 'outro' }])).toBe('outro');
    expect(nicknameErrorFromIssues([])).toBeUndefined();
  });
});

function fakeElement(options: { focusable: boolean; inner?: ReturnType<typeof fakeElement> }) {
  return {
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
    matches: vi.fn(() => options.focusable),
    querySelector: vi.fn(() => options.inner ?? null),
  };
}

describe('rolar e focar o campo com erro (C55)', () => {
  it('C55: rola centralizado e põe o foco no campo de texto, sem o foco brigar com a rolagem', () => {
    const input = fakeElement({ focusable: true });
    const root = { querySelector: vi.fn(() => input) };
    expect(revealField(root, 'nickname', false)).toBe(true);
    expect(root.querySelector).toHaveBeenCalledWith('[data-field="nickname"]');
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
    expect(input.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('C55: com "reduzir movimento" a rolagem é sem animação', () => {
    const input = fakeElement({ focusable: true });
    revealField({ querySelector: () => input }, 'nickname', true);
    expect(input.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' });
  });

  it('C55: num grupo de opções (posição) o foco vai para a opção de dentro', () => {
    const option = fakeElement({ focusable: true });
    const group = fakeElement({ focusable: false, inner: option });
    revealField({ querySelector: () => group }, 'primaryPosition', false);
    expect(group.scrollIntoView).toHaveBeenCalled();
    expect(group.focus).not.toHaveBeenCalled();
    expect(option.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('C55: campo que não está na tela: não faz nada e avisa', () => {
    expect(revealField({ querySelector: () => null }, 'nickname', false)).toBe(false);
    expect(revealField(null, 'nickname', false)).toBe(false);
  });
});

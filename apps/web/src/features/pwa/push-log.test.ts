import { afterEach, describe, expect, it, vi } from 'vitest';
import { logPushError } from './push-log';

describe('logPushError: o erro mudo do card de avisos aparece no console', () => {
  afterEach(() => vi.restoreAllMocks());

  it('registra o escopo, o nome e a mensagem reais (o "service worker indisponível" do dev sem SW)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logPushError('enable', new Error('service worker indisponível'));
    expect(spy).toHaveBeenCalledWith('[push] enable falhou: Error: service worker indisponível');
  });

  it('não repassa o objeto do erro (o endereço da assinatura e as chaves não vazam para o console)', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('falhou'), { endpoint: 'https://push.example/segredo' });
    logPushError('sync', error);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]).toEqual(['[push] sync falhou: Error: falhou']);
  });

  it('aceita um valor que não é Error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    logPushError('disable', 'texto solto');
    expect(spy).toHaveBeenCalledWith('[push] disable falhou: erro que não é um Error');
  });
});

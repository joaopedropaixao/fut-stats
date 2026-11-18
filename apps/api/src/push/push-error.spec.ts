import { describePushError, endpointHost } from './push-error';

describe('describePushError', () => {
  it('WebPushError: nome, statusCode, body (cortado) e só o host do endereço', () => {
    const error = Object.assign(new Error('Received unexpected response code'), {
      name: 'WebPushError',
      statusCode: 413,
      body: 'x'.repeat(1000),
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      headers: { authorization: 'vapid t=segredo' },
    });
    const detail = describePushError(error);
    expect(detail).toMatchObject({
      name: 'WebPushError',
      statusCode: 413,
      host: 'fcm.googleapis.com',
    });
    expect((detail.body as string).length).toBe(300);
    expect(JSON.stringify(detail)).not.toMatch(/abc|segredo/);
  });

  it('AggregateError de rede (mensagem vazia): code, errors[] e cause', () => {
    const inner = Object.assign(new Error('connect ETIMEDOUT 1.2.3.4:443'), { code: 'ETIMEDOUT' });
    const error = Object.assign(new AggregateError([inner], '', { cause: new Error('causa') }), {
      code: 'ETIMEDOUT',
    });
    expect(describePushError(error)).toEqual({
      name: 'AggregateError',
      message: '',
      code: 'ETIMEDOUT',
      cause: { name: 'Error', message: 'causa' },
      errors: [{ name: 'Error', message: 'connect ETIMEDOUT 1.2.3.4:443', code: 'ETIMEDOUT' }],
    });
  });

  it('valor que não é erro vira só a mensagem', () => {
    expect(describePushError('quebrou')).toEqual({ message: 'quebrou' });
    expect(describePushError(undefined)).toEqual({ message: 'undefined' });
  });

  it('endpointHost lê só o host (e nada de texto que não é endereço)', () => {
    expect(endpointHost('https://Updates.Push.Services.Mozilla.com/wpush/v2/x')).toBe(
      'updates.push.services.mozilla.com',
    );
    expect(endpointHost('nao é endereço')).toBeUndefined();
    expect(endpointHost(42)).toBeUndefined();
  });
});

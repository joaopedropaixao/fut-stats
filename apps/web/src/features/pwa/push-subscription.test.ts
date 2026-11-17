import { describe, expect, it } from 'vitest';
import { urlBase64ToUint8Array } from './push-subscription';

describe('urlBase64ToUint8Array', () => {
  it('converte a chave VAPID (base64url, sem preenchimento) em bytes', () => {
    // "hello?>" em base64url: aGVsbG8_Pg
    expect([...urlBase64ToUint8Array('aGVsbG8_Pg')]).toEqual([104, 101, 108, 108, 111, 63, 62]);
  });

  it('troca - e _ por + e /', () => {
    expect([...urlBase64ToUint8Array('-_8')]).toEqual([251, 255]);
  });

  it('a chave pública P-256 tem 65 bytes', () => {
    // 87 caracteres base64url, como uma chave real
    expect(urlBase64ToUint8Array(`B${'A'.repeat(86)}`)).toHaveLength(65);
  });
});

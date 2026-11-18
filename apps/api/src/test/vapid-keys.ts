import { createECDH } from 'node:crypto';

/**
 * Um par VAPID de mentira (P-256, base64url, o formato de `npx web-push generate-vapid-keys`), só para a validação do
 * ambiente dos testes passar: não assina nada de verdade e não vale em lugar nenhum. Fixo (e não gerado a cada
 * carga) para o teste e a app enxergarem a mesma chave.
 */
export const TEST_VAPID_KEYS = {
  publicKey:
    'BC8qiYaUOtcVFmwUEf1SnQ2tG8uulNyNrwWkop_pgrAoz5QOViCYy3yEokyL8xtRM_tcQuGqOoNCnHPx3C0vLKA',
  privateKey: 'rexwrSpbE6CpVEq6YQmUcilgGlQJIQoyvK1caD93Ns4',
} as const;

/** Um par novo, para os testes de formato do ambiente. */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    publicKey: ecdh.getPublicKey().toString('base64url'),
    privateKey: ecdh.getPrivateKey().toString('base64url'),
  };
}

import { generateVapidKeys } from '../test/vapid-keys';
import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fut_stats';
const JWT_SECRET = 'a'.repeat(32);
const google = {
  GOOGLE_CLIENT_ID: 'id.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'segredo',
  APP_URL: 'http://localhost:5173',
};
const valid = { DATABASE_URL, JWT_SECRET, ...google };

describe('validateEnv', () => {
  it('converte PORT para número', () => {
    expect(validateEnv({ ...valid, PORT: '4000' }).PORT).toBe(4000);
  });

  it('usa a porta 3000 quando PORT não é informada', () => {
    expect(validateEnv(valid).PORT).toBe(3000);
  });

  it('falha quando PORT é inválida', () => {
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('falha sem DATABASE_URL', () => {
    expect(() => validateEnv({ JWT_SECRET, ...google })).toThrow(/DATABASE_URL/);
  });

  it('falha quando DATABASE_URL não é do Postgres', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://localhost/fut_stats' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('falha sem JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL, ...google })).toThrow(/JWT_SECRET/);
  });

  it('falha com JWT_SECRET de menos de 32 caracteres', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'a'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('sessão vale 30 dias por padrão e aceita outro valor', () => {
    expect(validateEnv(valid).SESSION_TTL_DAYS).toBe(30);
    expect(validateEnv({ ...valid, SESSION_TTL_DAYS: '7' }).SESSION_TTL_DAYS).toBe(7);
  });

  it('o relógio de fechar votações roda a cada minuto por padrão, aceita outro valor e 0 desliga', () => {
    expect(validateEnv(valid).VOTING_CLOSER_INTERVAL_MS).toBe(60_000);
    expect(
      validateEnv({ ...valid, VOTING_CLOSER_INTERVAL_MS: '5000' }).VOTING_CLOSER_INTERVAL_MS,
    ).toBe(5000);
    expect(
      validateEnv({ ...valid, VOTING_CLOSER_INTERVAL_MS: '0' }).VOTING_CLOSER_INTERVAL_MS,
    ).toBe(0);
  });

  it('falha quando VOTING_CLOSER_INTERVAL_MS é negativo', () => {
    expect(() => validateEnv({ ...valid, VOTING_CLOSER_INTERVAL_MS: '-1' })).toThrow(
      /VOTING_CLOSER_INTERVAL_MS/,
    );
  });

  it('falha quando SESSION_TTL_DAYS não é inteiro positivo', () => {
    expect(() => validateEnv({ ...valid, SESSION_TTL_DAYS: '0' })).toThrow(/SESSION_TTL_DAYS/);
  });

  it('sem NODE_ENV, assume production', () => {
    expect(validateEnv(valid).NODE_ENV).toBe('production');
  });

  it('falha com NODE_ENV desconhecido', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });

  it.each(['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'APP_URL'] as const)(
    'falha sem %s',
    (key) => {
      expect(() => validateEnv({ ...valid, [key]: undefined })).toThrow(new RegExp(key));
    },
  );

  it('falha quando APP_URL não é http(s)', () => {
    expect(() => validateEnv({ ...valid, APP_URL: 'fut-stats-three.vercel.app' })).toThrow(
      /APP_URL/,
    );
    expect(() => validateEnv({ ...valid, APP_URL: 'ftp://exemplo.com' })).toThrow(/APP_URL/);
  });

  it('tira a barra do fim da APP_URL', () => {
    expect(validateEnv({ ...valid, APP_URL: 'https://fut-stats-three.vercel.app/' }).APP_URL).toBe(
      'https://fut-stats-three.vercel.app',
    );
  });

  describe('VAPID (avisos push)', () => {
    const keys = generateVapidKeys();
    const vapid = {
      VAPID_PUBLIC_KEY: keys.publicKey,
      VAPID_PRIVATE_KEY: keys.privateKey,
      VAPID_SUBJECT: 'mailto:dono@example.com',
    };

    it('C8: as três juntas passam e a API sobe com push ligado', () => {
      expect(validateEnv({ ...valid, ...vapid })).toMatchObject(vapid);
    });

    it('C8: nenhuma das três passa e deixa o push desligado', () => {
      const env = validateEnv(valid);
      expect(env.VAPID_PUBLIC_KEY).toBeUndefined();
      expect(env.VAPID_PRIVATE_KEY).toBeUndefined();
      expect(env.VAPID_SUBJECT).toBeUndefined();
    });

    it('C8: valores vazios (o .env.example) valem como ausentes', () => {
      const env = validateEnv({
        ...valid,
        VAPID_PUBLIC_KEY: '',
        VAPID_PRIVATE_KEY: '',
        VAPID_SUBJECT: '',
      });
      expect(env.VAPID_PUBLIC_KEY).toBeUndefined();
    });

    it.each(['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT'] as const)(
      'C8: só duas das três (sem %s) não sobe e diz qual falta',
      (missing) => {
        const partial = { ...vapid, [missing]: undefined };
        expect(() => validateEnv({ ...valid, ...partial })).toThrow(new RegExp(missing));
      },
    );

    it('C8: só uma das três não sobe e diz quais faltam', () => {
      expect(() => validateEnv({ ...valid, VAPID_PUBLIC_KEY: keys.publicKey })).toThrow(
        /VAPID_PRIVATE_KEY[\s\S]*VAPID_SUBJECT/,
      );
    });

    describe('formato das chaves (sem imprimir o valor)', () => {
      const withKey = (name: 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY', value: string) => ({
        ...valid,
        ...vapid,
        [name]: value,
      });

      it.each([
        ['aspas em volta', `"${keys.publicKey}"`, /VAPID_PUBLIC_KEY.*aspas/],
        ['espaço no fim', `${keys.publicKey} `, /VAPID_PUBLIC_KEY.*espaço/],
        ['preenchimento "="', `${keys.publicKey}=`, /VAPID_PUBLIC_KEY.*base64url/],
        ['base64 comum (+ e /)', 'ab+/cd'.padEnd(87, 'a'), /VAPID_PUBLIC_KEY.*base64url/],
        ['cortada', keys.publicKey.slice(0, 80), /VAPID_PUBLIC_KEY.*decodifica para/],
        ['32 bytes (é a privada)', keys.privateKey, /VAPID_PUBLIC_KEY.*65/],
      ])('a pública recusa: %s', (_caso, value, message) => {
        expect(() => validateEnv(withKey('VAPID_PUBLIC_KEY', value))).toThrow(message);
      });

      it('a pública de 65 bytes que não começa com 0x04 não é um ponto P-256', () => {
        const compressed = Buffer.concat([Buffer.from([0x03]), Buffer.alloc(64, 7)]);
        expect(() =>
          validateEnv(withKey('VAPID_PUBLIC_KEY', compressed.toString('base64url'))),
        ).toThrow(/VAPID_PUBLIC_KEY.*0x04/);
      });

      it.each([
        ['aspas em volta', `'${keys.privateKey}'`, /VAPID_PRIVATE_KEY.*aspas/],
        [
          'espaço no meio',
          `${keys.privateKey.slice(0, 10)} ${keys.privateKey.slice(10)}`,
          /espaço/,
        ],
        ['a pública no lugar', keys.publicKey, /VAPID_PRIVATE_KEY.*decodifica para 65 bytes.*32/],
        ['cortada', keys.privateKey.slice(0, 20), /VAPID_PRIVATE_KEY.*decodifica para/],
      ])('a privada recusa: %s', (_caso, value, message) => {
        expect(() => validateEnv(withKey('VAPID_PRIVATE_KEY', value))).toThrow(message);
      });

      it('a mensagem de erro nunca traz o valor da chave', () => {
        const secret = `"${keys.privateKey}"`;
        let message = '';
        try {
          validateEnv(withKey('VAPID_PRIVATE_KEY', secret));
        } catch (error) {
          message = (error as Error).message;
        }
        expect(message).toMatch(/VAPID_PRIVATE_KEY/);
        expect(message).not.toContain(keys.privateKey);
      });

      it('o contato recusa aspas e espaço', () => {
        expect(() =>
          validateEnv({ ...valid, ...vapid, VAPID_SUBJECT: '"mailto:dono@example.com"' }),
        ).toThrow(/VAPID_SUBJECT/);
        expect(() =>
          validateEnv({ ...valid, ...vapid, VAPID_SUBJECT: 'mailto:dono@example.com ' }),
        ).toThrow(/VAPID_SUBJECT/);
      });
    });

    it('C8: o contato precisa ser mailto: ou https', () => {
      expect(() => validateEnv({ ...valid, ...vapid, VAPID_SUBJECT: 'dono@example.com' })).toThrow(
        /VAPID_SUBJECT/,
      );
      expect(
        validateEnv({ ...valid, ...vapid, VAPID_SUBJECT: 'https://example.com/contato' })
          .VAPID_SUBJECT,
      ).toBe('https://example.com/contato');
    });
  });
  describe('Sentry e despertador (produção)', () => {
    const DSN = 'https://abc123@o1.ingest.sentry.io/42';

    it('C2: SENTRY_DSN é opcional; vazio (o .env.example) vale como ausente', () => {
      expect(validateEnv(valid).SENTRY_DSN).toBeUndefined();
      expect(validateEnv({ ...valid, SENTRY_DSN: '' }).SENTRY_DSN).toBeUndefined();
      expect(validateEnv({ ...valid, SENTRY_DSN: DSN }).SENTRY_DSN).toBe(DSN);
    });

    it('C2: SENTRY_DSN que não é URL não sobe e diz qual variável, sem imprimir o valor', () => {
      const bad = 'isto-nao-e-uma-url-segredo';
      let message = '';
      try {
        validateEnv({ ...valid, SENTRY_DSN: bad });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/SENTRY_DSN/);
      expect(message).not.toContain(bad);
    });

    it('C2: SENTRY_ENVIRONMENT é opcional e aceita texto', () => {
      expect(validateEnv(valid).SENTRY_ENVIRONMENT).toBeUndefined();
      expect(validateEnv({ ...valid, SENTRY_ENVIRONMENT: 'staging' }).SENTRY_ENVIRONMENT).toBe(
        'staging',
      );
    });

    it('C23: TICK_SECRET é opcional; vazio vale como ausente', () => {
      expect(validateEnv(valid).TICK_SECRET).toBeUndefined();
      expect(validateEnv({ ...valid, TICK_SECRET: '' }).TICK_SECRET).toBeUndefined();
    });

    it('C23: TICK_SECRET com 32 caracteres passa; com 31 a API não sobe, sem imprimir o valor', () => {
      expect(validateEnv({ ...valid, TICK_SECRET: 's'.repeat(32) }).TICK_SECRET).toBe(
        's'.repeat(32),
      );
      let message = '';
      try {
        validateEnv({ ...valid, TICK_SECRET: 's'.repeat(31) });
      } catch (error) {
        message = (error as Error).message;
      }
      expect(message).toMatch(/TICK_SECRET/);
      expect(message).not.toContain('s'.repeat(31));
    });
  });
});

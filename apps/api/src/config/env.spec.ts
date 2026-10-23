import { validateEnv } from './env';

const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/fut_stats';
const JWT_SECRET = 'a'.repeat(32);
const valid = { DATABASE_URL, JWT_SECRET };

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
    expect(() => validateEnv({ JWT_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('falha quando DATABASE_URL não é do Postgres', () => {
    expect(() => validateEnv({ ...valid, DATABASE_URL: 'mysql://localhost/fut_stats' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('falha sem JWT_SECRET', () => {
    expect(() => validateEnv({ DATABASE_URL })).toThrow(/JWT_SECRET/);
  });

  it('falha com JWT_SECRET de menos de 32 caracteres', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'a'.repeat(31) })).toThrow(/JWT_SECRET/);
  });

  it('sessão vale 30 dias por padrão e aceita outro valor', () => {
    expect(validateEnv(valid).SESSION_TTL_DAYS).toBe(30);
    expect(validateEnv({ ...valid, SESSION_TTL_DAYS: '7' }).SESSION_TTL_DAYS).toBe(7);
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
});

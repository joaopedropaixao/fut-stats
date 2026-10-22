import { validateEnv } from './env';

describe('validateEnv', () => {
  it('converte PORT para número', () => {
    expect(validateEnv({ PORT: '4000' }).PORT).toBe(4000);
  });

  it('usa a porta 3000 quando PORT não é informada', () => {
    expect(validateEnv({}).PORT).toBe(3000);
  });

  it('falha quando PORT é inválida', () => {
    expect(() => validateEnv({ PORT: 'abc' })).toThrow(/PORT/);
  });
});

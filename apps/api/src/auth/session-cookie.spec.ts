import { sessionCookieOptions } from './session.service';

describe('sessionCookieOptions', () => {
  it('é httpOnly, SameSite=Lax e vale para o site todo', () => {
    expect(sessionCookieOptions('production')).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  });

  it('é Secure em produção', () => {
    expect(sessionCookieOptions('production').secure).toBe(true);
  });

  it('não é Secure em development nem em test (http://localhost)', () => {
    expect(sessionCookieOptions('development').secure).toBe(false);
    expect(sessionCookieOptions('test').secure).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  extractInviteCode,
  inviteUrl,
  isInvitePath,
  whatsappShareUrl,
  isPendingDestination,
  isReturnPath,
} from './invite-code';

describe('extractInviteCode', () => {
  it.each([
    ['https://fut.app/convite/abc123', 'abc123'],
    ['  /convite/abc-123?x=1  ', 'abc-123'],
    ['abc123', 'abc123'],
  ])('%s → %s', (input, code) => {
    expect(extractInviteCode(input)).toBe(code);
  });

  it('rejeita vazio e texto com espaço', () => {
    expect(extractInviteCode('   ')).toBeNull();
    expect(extractInviteCode('oi tudo bem')).toBeNull();
  });
});

describe('isInvitePath', () => {
  it('só aceita /convite/<código>', () => {
    expect(isInvitePath('/convite/abc')).toBe(true);
    expect(isInvitePath('//evil.com')).toBe(false);
    expect(isInvitePath('/perfil')).toBe(false);
    expect(isInvitePath(null)).toBe(false);
  });
});

describe('links', () => {
  it('monta o link do convite e o do WhatsApp com a mensagem codificada', () => {
    const link = inviteUrl('https://fut.app', 'abc');
    expect(link).toBe('https://fut.app/convite/abc');
    const wa = whatsappShareUrl('Pelada do Zé', link);
    expect(wa.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(wa.split('text=')[1]!)).toContain('Pelada do Zé');
    expect(decodeURIComponent(wa.split('text=')[1]!)).toContain(link);
  });
});

describe('isReturnPath (link de aviso aberto sem sessão)', () => {
  it('aceita caminho interno com ?grupo=', () => {
    expect(isReturnPath('/rodadas/r13/resultado?grupo=g1')).toBe(true);
    expect(isReturnPath('/times?grupo=g1')).toBe(true);
    expect(isPendingDestination('/convite/abc123')).toBe(true);
  });

  it('recusa outro site, o próprio /entrar, /api, a raiz e lixo', () => {
    for (const path of [
      '//evil.com/x',
      'https://evil.com',
      '/entrar',
      '/entrar?next=/x',
      '/api/auth/logout',
      '/',
      '/x y',
      '',
      null,
    ])
      expect(isReturnPath(path), String(path)).toBe(false);
  });
});

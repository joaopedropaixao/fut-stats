import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from './privacy-content';

/** Todo o texto da política numa string só, para conferir o que o C31 pede. */
const text = PRIVACY_SECTIONS.flatMap((s) => [
  s.title,
  ...s.paragraphs,
  ...(s.items ?? []),
  s.contact ?? '',
]).join('\n');

describe('texto da Política de Privacidade (C31)', () => {
  it('diz quais dados são guardados', () => {
    for (const item of [
      'nome, e-mail e foto',
      'apelido e bonequinho',
      'presença, times, lances, notas, votos, resenhas, comentários e reações',
      'inscrições de aviso',
    ]) {
      expect(text).toContain(item);
    }
  });

  it('diz para que os dados servem', () => {
    expect(text).toContain('fazer a pelada funcionar');
  });

  it('diz que o voto é anônimo para os outros jogadores', () => {
    expect(text).toContain('Seu voto é anônimo');
    expect(text).toContain('Os outros jogadores não veem em quem você votou');
  });

  it('diz que não vende nem compartilha, salvo os provedores', () => {
    expect(text).toContain('não vende e não compartilha');
    for (const provider of ['Google', 'Vercel', 'Render', 'Neon', 'Sentry', 'push']) {
      expect(text).toContain(provider);
    }
    expect(text).toContain('sem e-mail e sem nome');
  });

  it('diz do backup cifrado por 30 dias', () => {
    expect(text).toContain('cifrada');
    expect(text).toContain('30 dias');
  });

  it('diz como sair ou apagar os dados (admin ou e-mail do dono), sem prometer botão', () => {
    expect(text).toContain('admin da sua pelada');
    expect(text).toContain('A gente apaga');
    expect(text.toLowerCase()).not.toContain('botão');
    expect(text.toLowerCase()).not.toContain('excluir conta');
  });

  it('o e-mail de contato é um marcador visível até o dono preencher, e a data está no texto', () => {
    expect(CONTACT_EMAIL).toBe('[e-mail de contato do dono]');
    expect(text).toContain(CONTACT_EMAIL);
    expect(PRIVACY_UPDATED_AT).toBe('18 de novembro de 2026');
  });
});

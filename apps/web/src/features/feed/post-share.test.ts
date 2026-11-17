import { describe, expect, it } from 'vitest';
import { postShareText, whatsappUrl } from './post-share';

describe('compartilhar resenha no WhatsApp (C44)', () => {
  it('leva o título em negrito, o texto com as quebras e o link do app', () => {
    expect(postShareText({ title: 'Que jogão', body: 'Linha 1\nLinha 2' }, 'https://fut.app')).toBe(
      '*Que jogão*\n\nLinha 1\nLinha 2\n\nFut Stats: https://fut.app',
    );
  });

  it('sem título, só o texto e o link', () => {
    expect(postShareText({ title: null, body: 'Oi' }, 'https://fut.app')).toBe(
      'Oi\n\nFut Stats: https://fut.app',
    );
  });

  it('o link é um wa.me com o texto codificado', () => {
    const url = whatsappUrl({ title: 'A & B', body: 'x y' }, 'https://fut.app');
    expect(url.startsWith('https://wa.me/?text=')).toBe(true);
    expect(decodeURIComponent(url.slice('https://wa.me/?text='.length))).toBe(
      '*A & B*\n\nx y\n\nFut Stats: https://fut.app',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { installMode, isIos } from './install-state';

describe('installMode (C22 a C24)', () => {
  it('app aberto instalado: nada a instalar (C24)', () => {
    expect(installMode({ standalone: true, ios: false, hasPrompt: true })).toBe('installed');
    expect(installMode({ standalone: true, ios: true, hasPrompt: false })).toBe('installed');
  });

  it('o navegador ofereceu o pedido: a tecla chama ele (C22)', () => {
    expect(installMode({ standalone: false, ios: false, hasPrompt: true })).toBe('prompt');
  });

  it('iPhone não tem pedido: a gaveta ensina o caminho (C23)', () => {
    expect(installMode({ standalone: false, ios: true, hasPrompt: false })).toBe('ios');
  });

  it('sem pedido e fora do iPhone: não há como instalar daqui', () => {
    expect(installMode({ standalone: false, ios: false, hasPrompt: false })).toBe('none');
  });
});

describe('isIos', () => {
  it('reconhece iPhone, iPod e iPad pelo user agent', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Safari/604.1')).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_4 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0)')).toBe(true);
  });

  it('o iPadOS se diz Macintosh: com toque é iPad, sem toque é Mac', () => {
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0)).toBe(false);
  });

  it('Android e desktop não são iOS', () => {
    expect(isIos('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126.0')).toBe(false);
    expect(isIos('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126.0')).toBe(false);
  });
});

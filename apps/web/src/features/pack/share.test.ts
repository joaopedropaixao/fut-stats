import { describe, expect, it, vi } from 'vitest';
import { shareCard } from './share';

const file = () => Promise.resolve(new File(['x'], 'carta.png', { type: 'image/png' }));

describe('Compartilhar a carta', () => {
  it('C19: com arquivo aceito, compartilha a imagem e o texto', async () => {
    const share = vi.fn(() => Promise.resolve());
    const open = vi.fn();
    const outcome = await shareCard('oi', file, { nav: { share, canShare: () => true }, open });
    expect(outcome).toBe('files');
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'oi', files: [expect.any(File)] }),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('C20: sem arquivo, compartilha só o texto', async () => {
    const share = vi.fn(() => Promise.resolve());
    const outcome = await shareCard('oi', file, {
      nav: { share, canShare: () => false },
      open: vi.fn(),
    });
    expect(outcome).toBe('text');
    expect(share).toHaveBeenCalledWith({ text: 'oi' });
  });

  it('C20: sem navigator.share, abre o wa.me com o texto', async () => {
    const open = vi.fn();
    const outcome = await shareCard('Craque da rodada 12: Zé, nota 9,1', file, { nav: {}, open });
    expect(outcome).toBe('whatsapp');
    expect(open).toHaveBeenCalledWith(
      'https://wa.me/?text=Craque%20da%20rodada%2012%3A%20Z%C3%A9%2C%20nota%209%2C1',
    );
  });

  it('C21: cancelar não faz nada nem estoura', async () => {
    const share = vi.fn(() => Promise.reject(new DOMException('cancelado', 'AbortError')));
    const open = vi.fn();
    await expect(
      shareCard('oi', file, { nav: { share, canShare: () => true }, open }),
    ).resolves.toBe('cancelled');
    expect(open).not.toHaveBeenCalled();
  });

  it('outro erro sobe para quem chamou', async () => {
    const share = vi.fn(() => Promise.reject(new Error('quebrou')));
    await expect(shareCard('oi', file, { nav: { share }, open: vi.fn() })).rejects.toThrow(
      'quebrou',
    );
  });
});

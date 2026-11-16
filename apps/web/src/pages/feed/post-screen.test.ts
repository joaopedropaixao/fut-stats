import { describe, expect, it } from 'vitest';
import { postScreen } from './post-screen';

describe('postScreen', () => {
  it('nova abre o formulário de criação', () => {
    expect(postScreen('nova')).toEqual({ screen: 'new' });
  });

  it('<id>/editar abre a edição daquela resenha', () => {
    expect(postScreen('abc-123/editar')).toEqual({ screen: 'edit', postId: 'abc-123' });
  });

  it('o resto não é tela: volta para o Feed', () => {
    for (const rest of [undefined, '', 'editar', 'abc/editar/x', 'nova/x', '/editar'])
      expect(postScreen(rest)).toBeNull();
  });
});

import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AdminBlock } from './admin-block';

const html = (canClose: boolean) =>
  renderToString(
    <AdminBlock pending={[]} canClose={canClose} onClose={() => {}} closing={false} />,
  );

describe('bloco do admin na votação', () => {
  it('"Encerrar votação" é a tecla amarela (ação), com o rótulo ADMIN e o divisor separando da ação de quem vota', () => {
    const out = html(true);
    expect(out).toContain('Encerrar votação');
    expect(out).toContain('bg-accent');
    expect(out).toContain('Admin');
    expect(out).toContain('mt-4');
  });

  it('sem permissão para encerrar, não há tecla', () => {
    expect(html(false)).not.toContain('bg-accent');
  });
});

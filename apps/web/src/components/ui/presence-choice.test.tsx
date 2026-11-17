import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresenceChoice } from './presence-choice';

const html = (value: boolean | null) =>
  renderToString(<PresenceChoice value={value} onChange={() => {}} />);

describe('Confirmar / Ausência', () => {
  it('nunca usa a tecla amarela, em nenhuma resposta (Feed e detalhe da rodada são iguais)', () => {
    for (const value of [null, true, false]) {
      const out = html(value);
      expect(out).not.toContain('bg-accent');
      expect(out).not.toContain('shadow-key');
    }
  });

  it('Confirmar respondido é verde chapado e a Ausência recua', () => {
    const out = html(true);
    expect(out.match(/bg-success/g)).toHaveLength(1);
    expect(out).not.toContain('bg-danger');
  });

  it('Ausência respondida é vermelha chapada, e o Confirmar recua no contorno verde, sem amarelo aceso', () => {
    const out = html(false);
    expect(out.match(/bg-danger/g)).toHaveLength(1);
    expect(out).not.toContain('bg-success');
    expect(out).toContain('shadow-[inset_0_0_0_2px_var(--color-success)]');
    expect(out).not.toContain('bg-accent');
  });
});

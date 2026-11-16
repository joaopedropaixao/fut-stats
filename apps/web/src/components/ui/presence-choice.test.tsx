import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PresenceChoice } from './presence-choice';

const html = (props: { keyed?: boolean; value?: boolean | null }) =>
  renderToString(<PresenceChoice value={props.value ?? null} onChange={() => {}} {...props} />);

describe('Confirmar / Ausência', () => {
  it('no aviso grande do Feed o Confirmar é a tecla amarela e a Ausência segue no contorno vermelho', () => {
    const out = html({ keyed: true });
    expect(out.match(/bg-accent/g)).toHaveLength(1);
    expect(out).toContain('shadow-key');
  });

  it('fora do Feed não há amarelo: o Confirmar respondido é verde chapado', () => {
    expect(html({ value: true })).not.toContain('bg-accent');
    expect(html({ value: true })).toContain('bg-success');
  });
});

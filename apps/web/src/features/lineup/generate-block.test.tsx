import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GenerateBlock, SlowWaitNotice } from './generate-block';

const html = (props: { regenerate?: boolean; loading: boolean }) =>
  renderToString(
    <GenerateBlock
      regenerate={props.regenerate ?? false}
      loading={props.loading}
      onGenerate={() => {}}
    />,
  );

describe('bloco Gerar times', () => {
  it('parado: "Gerar times" (ou "Regerar"), botão habilitado, sem movimento de espera', () => {
    const out = html({ loading: false });
    expect(out).toContain('Gerar times');
    expect(out).not.toContain('disabled');
    expect(out).not.toContain('animate-block-bump');
    expect(html({ loading: false, regenerate: true })).toContain('Regerar');
  });

  it('gerando: botão desabilitado com aria-busy, texto "Gerando", bloco batendo e moeda em loop (C1)', () => {
    const out = html({ loading: true });
    expect(out).toContain('disabled');
    expect(out).toContain('aria-busy="true"');
    expect(out).toContain('Gerando');
    expect(out).toContain('animate-block-bump');
    expect(out).toContain('animate-coin-loop');
    expect(out).toContain('animate-dot-2');
    expect(out).toContain('animate-dot-3');
  });

  it('gerando, Reduzir movimento: tudo que anda tem a variante que para (C4)', () => {
    const out = html({ loading: true });
    expect(out).toContain('motion-reduce:animate-none');
    expect(out).toContain('motion-reduce:hidden');
  });

  it('o bloco continua dourado quando gera: não vira o "usado"', () => {
    expect(html({ loading: true })).toContain('fill-gold');
  });

  it('com menos de 5 s a linha do servidor não aparece, mas a região aria-live já existe (C3)', () => {
    const out = html({ loading: true });
    expect(out).toContain('aria-live="polite"');
    expect(out).not.toContain('Acordando o servidor');
  });
});

describe('aviso "Acordando o servidor" (C2)', () => {
  it('escreve o aviso e tem o quadradinho que pisca sem anunciar', () => {
    const out = renderToString(<SlowWaitNotice />);
    expect(out).toContain('Acordando o servidor, pode levar até 1 min');
    expect(out).toContain('animate-live-blink');
    expect(out).toContain('motion-reduce:animate-none');
  });
});

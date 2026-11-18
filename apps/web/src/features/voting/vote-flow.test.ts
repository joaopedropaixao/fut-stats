import { describe, expect, it } from 'vitest';
import {
  canAdvance,
  flowReducer,
  initFlow,
  isReadyToSend,
  openAt,
  ratedCount,
  toSubmit,
  type FlowAction,
  type FlowState,
} from './vote-flow';

const IDS = ['a', 'b', 'c'] as const;

function run(actions: FlowAction[], from: FlowState = initFlow(IDS)): FlowState {
  return actions.reduce(flowReducer, from);
}

const ratedAll: FlowAction[] = [
  { type: 'rate', targetId: 'a', value: 7 },
  { type: 'next' },
  { type: 'rate', targetId: 'b', value: 5.5 },
  { type: 'next' },
  { type: 'rate', targetId: 'c', value: 9 },
  { type: 'next' },
];

describe('fluxo de votar: notas', () => {
  it('começa no primeiro jogador, sem nota', () => {
    const state = initFlow(IDS);
    expect(state).toMatchObject({ step: 'rate', index: 0, mvpId: null, flopId: null });
    expect(ratedCount(state)).toBe(0);
    expect(canAdvance(state)).toBe(false);
  });

  it('não dá para pular: Próximo sem nota não anda', () => {
    expect(run([{ type: 'next' }]).index).toBe(0);
  });

  it('com a nota dada, anda para o próximo e o Anterior volta mantendo as notas', () => {
    const state = run([{ type: 'rate', targetId: 'a', value: 7 }, { type: 'next' }]);
    expect(state.index).toBe(1);
    const back = run([{ type: 'previous' }], state);
    expect(back.index).toBe(0);
    expect(back.ratings).toEqual({ a: 7 });
  });

  it('no primeiro jogador, Anterior não faz nada', () => {
    expect(run([{ type: 'previous' }]).index).toBe(0);
  });

  it('no último jogador, o próximo passo é a revisão', () => {
    expect(run(ratedAll).step).toBe('review');
  });

  it('ignora nota de quem não está na lista', () => {
    expect(run([{ type: 'rate', targetId: 'x', value: 8 }]).ratings).toEqual({});
  });
});

describe('fluxo de votar: revisão', () => {
  it('tocar numa linha volta àquele jogador e, ao confirmar, retorna à revisão', () => {
    const edited = run(
      [{ type: 'edit', index: 1 }, { type: 'rate', targetId: 'b', value: 8 }, { type: 'next' }],
      run(ratedAll),
    );
    expect(edited.step).toBe('review');
    expect(edited.ratings.b).toBe(8);
    expect(edited.backToReview).toBe(false);
  });

  it('Anterior numa linha aberta pela revisão volta à revisão', () => {
    const state = run([{ type: 'edit', index: 2 }, { type: 'previous' }], run(ratedAll));
    expect(state.step).toBe('review');
  });

  it('só continua para o voto com todas as notas', () => {
    const partial = run([{ type: 'rate', targetId: 'a', value: 7 }]);
    expect(run([{ type: 'toVote' }], { ...partial, step: 'review' }).step).toBe('review');
    expect(run([{ type: 'toVote' }], run(ratedAll)).step).toBe('mvp');
  });

  it('linha fora da lista é ignorada', () => {
    expect(run([{ type: 'edit', index: 9 }], run(ratedAll)).step).toBe('review');
  });
});

describe('fluxo de votar: Craque e Perna de Pau', () => {
  const atMvp = run([{ type: 'toVote' }], run(ratedAll));

  it('o Próximo só vale com o Craque escolhido', () => {
    expect(run([{ type: 'forward' }], atMvp).step).toBe('mvp');
    expect(run([{ type: 'pickMvp', id: 'a' }, { type: 'forward' }], atMvp).step).toBe('flop');
  });

  it('o Craque trava no Perna de Pau: não dá para ser os dois', () => {
    const atFlop = run([{ type: 'pickMvp', id: 'a' }, { type: 'forward' }], atMvp);
    expect(run([{ type: 'pickFlop', id: 'a' }], atFlop).flopId).toBeNull();
    expect(run([{ type: 'pickFlop', id: 'b' }], atFlop).flopId).toBe('b');
  });

  it('trocar o Craque pelo escolhido como Perna de Pau limpa o Perna de Pau', () => {
    const state = run(
      [
        { type: 'pickMvp', id: 'a' },
        { type: 'forward' },
        { type: 'pickFlop', id: 'b' },
        { type: 'back' },
        { type: 'pickMvp', id: 'b' },
      ],
      atMvp,
    );
    expect(state).toMatchObject({ mvpId: 'b', flopId: null });
  });

  it('Voltar anda um passo para trás até a revisão', () => {
    const atFlop = run([{ type: 'pickMvp', id: 'a' }, { type: 'forward' }], atMvp);
    expect(run([{ type: 'back' }], atFlop).step).toBe('mvp');
    expect(run([{ type: 'back' }, { type: 'back' }], atFlop).step).toBe('review');
  });

  it('só envia com tudo escolhido, e o pacote sai na ordem dos jogadores', () => {
    expect(toSubmit(atMvp)).toBeNull();
    const ready = run(
      [{ type: 'pickMvp', id: 'c' }, { type: 'forward' }, { type: 'pickFlop', id: 'b' }],
      atMvp,
    );
    expect(isReadyToSend(ready)).toBe(true);
    expect(toSubmit(ready)).toEqual({
      ratings: [
        { targetId: 'a', value: 7 },
        { targetId: 'b', value: 5.5 },
        { targetId: 'c', value: 9 },
      ],
      mvpId: 'c',
      flopId: 'b',
    });
  });
});

describe('fluxo de votar: editar o voto enviado', () => {
  const vote = {
    ratings: [
      { targetId: 'a', value: 7 },
      { targetId: 'b', value: 5.5 },
      { targetId: 'c', value: 9 },
      { targetId: 'gone', value: 4 },
    ],
    mvpId: 'c',
    flopId: 'b',
  };

  it('abre na revisão com tudo preenchido (quem saiu da lista não entra)', () => {
    const state = initFlow(IDS, vote);
    expect(state.step).toBe('review');
    expect(ratedCount(state)).toBe(3);
    expect(state.ratings).not.toHaveProperty('gone');
    expect(isReadyToSend(state)).toBe(true);
  });

  it('voto que não cobre todo mundo volta para as notas', () => {
    const state = initFlow(['a', 'b', 'c', 'd'], vote);
    expect(state.step).toBe('rate');
    expect(ratedCount(state)).toBe(3);
  });
});

describe('fluxo de votar: lápis do "Seus votos"', () => {
  const vote = {
    ratings: IDS.map((targetId) => ({ targetId, value: 6 })),
    mvpId: 'a',
    flopId: 'b',
  };

  it('abre direto no Craque, no Perna de Pau ou na revisão', () => {
    const state = initFlow(IDS, vote);
    expect(openAt(state, 'mvp').step).toBe('mvp');
    expect(openAt(state, 'flop').step).toBe('flop');
    expect(openAt(state, 'review').step).toBe('review');
  });

  it('sem tudo preenchido, não pula passo', () => {
    const state = initFlow(IDS);
    expect(openAt(state, 'mvp').step).toBe('rate');
  });
});

import type { SubmitVoteInput } from '@fut-stats/shared';

/**
 * O fluxo de votar, sem tela: o passo, o jogador da vez, as notas e as escolhas. A tela só dispara ações; quem
 * pode e quem não pode avançar é decidido aqui. A validação do pacote em si (nota de 0 a 10 em 0,5, jogadores
 * diferentes) é do shared/domain e roda na API; aqui só se impede o que a tela já sabe que a API recusaria.
 */
export type FlowStep = 'rate' | 'review' | 'mvp' | 'flop';

export type FlowState = {
  step: FlowStep;
  /** Quem recebe nota: todos que jogaram, menos eu, na ordem da API. */
  targetIds: readonly string[];
  /** O jogador da vez no passo das notas. */
  index: number;
  ratings: Readonly<Record<string, number>>;
  mvpId: string | null;
  flopId: string | null;
  /** Veio de uma linha da revisão: ao confirmar a nota, volta para a revisão. */
  backToReview: boolean;
};

export type FlowAction =
  | { type: 'rate'; targetId: string; value: number }
  | { type: 'next' }
  | { type: 'previous' }
  | { type: 'edit'; index: number }
  | { type: 'toVote' }
  | { type: 'pickMvp'; id: string }
  | { type: 'pickFlop'; id: string }
  | { type: 'forward' }
  | { type: 'back' };

/** A nota que a primeira batida no − ou no + (ou no ponto da régua, sem preferência) começa a contar. */
export const FIRST_RATING = 6;

/** Começo do fluxo, ou o voto já enviado para editar (cai na revisão, com tudo preenchido). */
export function initFlow(
  targetIds: readonly string[],
  vote?: Pick<SubmitVoteInput, 'ratings' | 'mvpId' | 'flopId'> | null,
): FlowState {
  const ratings: Record<string, number> = {};
  for (const entry of vote?.ratings ?? []) {
    if (targetIds.includes(entry.targetId)) ratings[entry.targetId] = entry.value;
  }
  const state: FlowState = {
    step: 'rate',
    targetIds,
    index: 0,
    ratings,
    mvpId: vote && targetIds.includes(vote.mvpId) ? vote.mvpId : null,
    flopId: vote && targetIds.includes(vote.flopId) ? vote.flopId : null,
    backToReview: false,
  };
  return vote && allRated(state) ? { ...state, step: 'review' } : state;
}

/** Abre o fluxo já num passo (o lápis do "Seus votos"): só vale com tudo preenchido; senão, fica onde está. */
export function openAt(state: FlowState, step: 'review' | 'mvp' | 'flop'): FlowState {
  if (!allRated(state)) return state;
  if (step === 'flop' && state.mvpId === null) return state;
  return { ...state, step, backToReview: false };
}

export function allRated(state: Pick<FlowState, 'targetIds' | 'ratings'>): boolean {
  return state.targetIds.every((id) => state.ratings[id] !== undefined);
}

export function ratedCount(state: Pick<FlowState, 'targetIds' | 'ratings'>): number {
  return state.targetIds.filter((id) => state.ratings[id] !== undefined).length;
}

/** O jogador da vez no passo das notas. */
export function currentTargetId(state: FlowState): string | undefined {
  return state.targetIds[state.index];
}

/** Pode avançar do jogador da vez? Só com nota dada: não dá para pular. */
export function canAdvance(state: FlowState): boolean {
  const id = currentTargetId(state);
  return id !== undefined && state.ratings[id] !== undefined;
}

/** Pronto para enviar: todas as notas, o Craque e o Perna de Pau, em jogadores diferentes. */
export function isReadyToSend(state: FlowState): boolean {
  return (
    allRated(state) && state.mvpId !== null && state.flopId !== null && state.mvpId !== state.flopId
  );
}

/** O pacote que vai para a API, ou `null` enquanto faltar algo. */
export function toSubmit(state: FlowState): SubmitVoteInput | null {
  if (!isReadyToSend(state)) return null;
  return {
    ratings: state.targetIds.map((targetId) => ({ targetId, value: state.ratings[targetId]! })),
    mvpId: state.mvpId!,
    flopId: state.flopId!,
  };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'rate':
      if (!state.targetIds.includes(action.targetId)) return state;
      return { ...state, ratings: { ...state.ratings, [action.targetId]: action.value } };
    case 'next': {
      if (state.step !== 'rate' || !canAdvance(state)) return state;
      if (state.backToReview || state.index >= state.targetIds.length - 1) {
        return { ...state, step: 'review', backToReview: false };
      }
      return { ...state, index: state.index + 1 };
    }
    case 'previous': {
      if (state.step !== 'rate') return state;
      // Vindo da revisão, "Anterior" é o jeito de desistir da mudança e voltar a ela
      if (state.backToReview) return { ...state, step: 'review', backToReview: false };
      return state.index > 0 ? { ...state, index: state.index - 1 } : state;
    }
    case 'edit':
      if (state.step !== 'review' || action.index < 0 || action.index >= state.targetIds.length) {
        return state;
      }
      return { ...state, step: 'rate', index: action.index, backToReview: true };
    case 'toVote':
      return state.step === 'review' && allRated(state) ? { ...state, step: 'mvp' } : state;
    case 'pickMvp': {
      if (state.step !== 'mvp' || !state.targetIds.includes(action.id)) return state;
      // O Craque e o Perna de Pau são pessoas diferentes: escolher o Craque tira o mesmo do Perna de Pau
      return {
        ...state,
        mvpId: action.id,
        flopId: state.flopId === action.id ? null : state.flopId,
      };
    }
    case 'pickFlop':
      if (state.step !== 'flop' || !state.targetIds.includes(action.id)) return state;
      if (action.id === state.mvpId) return state;
      return { ...state, flopId: action.id };
    case 'forward':
      return state.step === 'mvp' && state.mvpId !== null ? { ...state, step: 'flop' } : state;
    case 'back':
      if (state.step === 'flop') return { ...state, step: 'mvp' };
      if (state.step === 'mvp') return { ...state, step: 'review' };
      return state;
  }
}

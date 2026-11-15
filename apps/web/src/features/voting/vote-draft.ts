import { ratingSchema } from '@fut-stats/shared';
import type { FlowState, FlowStep } from './vote-flow';

/**
 * O rascunho do voto no aparelho: quem fecha o app no meio volta no jogador em que parou, com as notas já dadas.
 * Por rodada e por jogador (membershipId), no padrão de `result-opened.ts`. Sem armazenamento, nada quebra: o
 * voto só não é lembrado.
 */
const key = (roundId: string, membershipId: string) =>
  `fut-stats:voto-rascunho:${roundId}:${membershipId}`;

const STEPS: readonly FlowStep[] = ['rate', 'review', 'mvp', 'flop'];

type DraftBody = Pick<
  FlowState,
  'step' | 'index' | 'ratings' | 'mvpId' | 'flopId' | 'backToReview'
>;

export function saveDraft(
  roundId: string,
  membershipId: string,
  state: FlowState,
  storage?: Pick<Storage, 'setItem'>,
): void {
  const body: DraftBody = {
    step: state.step,
    index: state.index,
    ratings: state.ratings,
    mvpId: state.mvpId,
    flopId: state.flopId,
    backToReview: state.backToReview,
  };
  try {
    (storage ?? window.localStorage).setItem(key(roundId, membershipId), JSON.stringify(body));
  } catch {
    // sem armazenamento: o rascunho não é lembrado
  }
}

export function clearDraft(
  roundId: string,
  membershipId: string,
  storage?: Pick<Storage, 'removeItem'>,
): void {
  try {
    (storage ?? window.localStorage).removeItem(key(roundId, membershipId));
  } catch {
    // sem armazenamento: nada a limpar
  }
}

/**
 * Lê o rascunho e o confere com quem joga hoje (a lista pode ter mudado): nota de quem saiu da lista e valor
 * inválido caem fora. Sem rascunho, ou com rascunho ilegível, devolve `null`.
 */
export function loadDraft(
  roundId: string,
  membershipId: string,
  targetIds: readonly string[],
  storage?: Pick<Storage, 'getItem'>,
): FlowState | null {
  let raw: string | null;
  try {
    raw = (storage ?? window.localStorage).getItem(key(roundId, membershipId));
  } catch {
    return null;
  }
  if (raw === null) return null;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof json !== 'object' || json === null) return null;
  const draft = json as Record<string, unknown>;

  const step = STEPS.find((s) => s === draft.step);
  if (!step) return null;

  const ratings: Record<string, number> = {};
  if (typeof draft.ratings === 'object' && draft.ratings !== null) {
    for (const [id, value] of Object.entries(draft.ratings)) {
      if (targetIds.includes(id) && ratingSchema.safeParse(value).success) {
        ratings[id] = value as number;
      }
    }
  }
  const pick = (value: unknown) =>
    typeof value === 'string' && targetIds.includes(value) ? value : null;
  const index =
    typeof draft.index === 'number' && Number.isInteger(draft.index)
      ? Math.min(Math.max(draft.index, 0), Math.max(targetIds.length - 1, 0))
      : 0;

  let state: FlowState = {
    step,
    targetIds,
    index,
    ratings,
    mvpId: pick(draft.mvpId),
    flopId: pick(draft.flopId),
    backToReview: draft.backToReview === true,
  };
  // Um rascunho que ficou à frente do que existe (nota que sumiu) recua para o passo das notas
  const allRated = targetIds.every((id) => ratings[id] !== undefined);
  if (step !== 'rate' && !allRated) {
    state = {
      ...state,
      step: 'rate',
      index: targetIds.findIndex((id) => ratings[id] === undefined),
    };
  } else if (step === 'flop' && state.mvpId === null) {
    state = { ...state, step: 'mvp' };
  }
  if (state.flopId !== null && state.flopId === state.mvpId) state = { ...state, flopId: null };
  return state;
}

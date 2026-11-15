import { useEffect, useMemo, useState } from 'react';
import { hasSeenRanking, markRankingSeen } from './rank-seen';
import { planReveal, REVEAL_STEP_MS, type RevealPlan } from './rank-reveal';

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

type Reveal = {
  /** A posição que o card mostra agora (na animação, passa pelos degraus até a nova). */
  shown: number | null;
  /** A contagem terminou (ou não houve): a seta pode dar o pulo. */
  finished: boolean;
  /** Subiu ou desceu, só enquanto há animação; `null` quando nada acontece. */
  kind: RevealPlan['kind'] | null;
  /** Subiu e a contagem chegou: hora do confete. */
  celebrate: boolean;
};

/**
 * A animação do card "VOCÊ ESTÁ EM Nº" na primeira vez que abro o ranking depois de uma rodada nova: o número troca em
 * degraus da posição antiga para a nova. Uma vez por jogador e por número de rodadas encerradas (`rank-seen.ts`).
 * Só decide e conta o tempo; quem desenha é o card.
 */
export function useRankReveal(input: {
  membershipId: string;
  closedRounds: number;
  rank: number | null;
  trend: number | null;
}): Reveal {
  const { membershipId, closedRounds, rank, trend } = input;
  // Decide uma vez por chave (jogador + rodadas) e dados: marcar como visto não refaz a conta e não corta a animação
  const { plan, shouldMark } = useMemo(
    () =>
      planReveal({
        rank,
        trend,
        seen: hasSeenRanking(membershipId, closedRounds),
        reducedMotion: prefersReducedMotion(),
      }),
    [membershipId, closedRounds, rank, trend],
  );
  const [progress, setProgress] = useState<{ plan: RevealPlan | null; index: number }>({
    plan: null,
    index: 0,
  });

  useEffect(() => {
    if (shouldMark) markRankingSeen(membershipId, closedRounds);
    if (!plan) return;
    const last = plan.steps.length - 1;
    const timer = setInterval(() => {
      setProgress((p) => {
        const index = p.plan === plan ? p.index : 0;
        if (index >= last) return p;
        return { plan, index: index + 1 };
      });
    }, REVEAL_STEP_MS);
    return () => clearInterval(timer);
  }, [plan, shouldMark, membershipId, closedRounds]);

  if (!plan) return { shown: rank, finished: true, kind: null, celebrate: false };
  const index = progress.plan === plan ? progress.index : 0;
  const finished = index >= plan.steps.length - 1;
  return {
    shown: plan.steps[index] ?? rank,
    finished,
    kind: plan.kind,
    celebrate: finished && plan.kind === 'up',
  };
}

import type { VotingEndReason } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';

/**
 * "A VOTAÇÃO FECHOU" (folha: Erro/Votação fechou): o prazo acabou, ou o admin encerrou, enquanto a pessoa votava.
 * O rascunho já foi descartado por quem mostra este card.
 */
const WHY: Record<VotingEndReason, string> = {
  DEADLINE_PASSED: 'O prazo acabou enquanto você votava.',
  ADMIN_CLOSED: 'O admin encerrou a votação enquanto você votava.',
  ALL_VOTED: 'Todo mundo já tinha votado.',
};

export function VoteClosed({
  roundId,
  reason,
}: {
  roundId: string;
  /** Por que fechou, quando a API já disse; sem ela vale o prazo (o caso mais comum). */
  reason: VotingEndReason | null;
}) {
  return (
    <section
      role="alert"
      aria-label="A votação fechou"
      className="animate-moment-in flex flex-col gap-4 bg-danger/8 p-4 shadow-[inset_0_0_0_2px_var(--color-danger)]"
    >
      <div className="flex items-center gap-3">
        <Icon name="lock" size={28} strokeWidth={2.2} className="text-[#f87171]" />
        <PixelText as="h2" size={24} wrap className="min-w-0 flex-1">
          A votação fechou
        </PixelText>
      </div>
      <p className="text-sm text-text-muted">
        {WHY[reason ?? 'DEADLINE_PASSED']} Os votos que ainda não tinham sido enviados não entram na
        conta.
      </p>
      <RouteButton to={`/rodadas/${roundId}/resultado`} label="Ver o resultado" block />
      <RouteButton to="/" variant="outline" size={52} label="Voltar para o início" block />
    </section>
  );
}

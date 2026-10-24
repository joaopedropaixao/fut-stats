import type { RoundDetail } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';

/**
 * Placar de presença (como o "12 DE 14 CONFIRMADOS" da folha): quantos vão em dígito grande, uma barra com um
 * quadradinho por membro e quantos não vão / ainda não responderam. Não há número-alvo: a barra é o grupo todo.
 */
export function PresenceTally({ round }: { round: RoundDetail }) {
  const { confirmed, declined, pending } = round.attendance;
  const going = confirmed.length;
  const segments = [
    ...confirmed.map(() => 'bg-success'),
    ...declined.map(() => 'bg-danger/45'),
    ...pending.map(() => 'bg-track'),
  ];

  return (
    <div className="flex flex-col gap-3">
      <PixelText as="p" size={24}>
        {going === 1 ? '1 confirmado' : `${going} confirmados`}
      </PixelText>
      {segments.length > 0 && (
        <div aria-hidden className="flex h-2.5 gap-0.5">
          {segments.map((color, i) => (
            <span key={i} className={cn('min-w-0 flex-1', color)} />
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="x" size={16} strokeWidth={3} className="text-[#f87171]" />
          <PixelText>{`${declined.length} não ${declined.length === 1 ? 'vai' : 'vão'}`}</PixelText>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Icon name="clock" size={16} strokeWidth={2.4} className="text-warning" />
          <PixelText>{`${pending.length} sem resposta`}</PixelText>
        </span>
      </div>
    </div>
  );
}

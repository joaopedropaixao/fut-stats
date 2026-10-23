import type { HistoryItem } from '@fut-stats/shared';
import { Badge } from '../../components/ui/badge';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';

/**
 * Selo do resultado. Cor nunca é o único sinal: o texto diz quem venceu e o ✓ acompanha a vitória.
 * Sem placar lançado, o selo diz isso por escrito.
 */
export function WinnerSeal({ item }: { item: Pick<HistoryItem, 'winner' | 'status'> }) {
  switch (item.winner) {
    case 'WHITE':
    case 'BLACK':
      return (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="check" size={16} strokeWidth={3} className="shrink-0 text-success" />
          <Badge
            label={item.winner === 'WHITE' ? 'BRANCO VENCEU' : 'PRETO VENCEU'}
            variant={item.winner === 'WHITE' ? 'white' : 'black'}
          />
        </span>
      );
    case 'DRAW':
      return (
        <span className="inline-flex items-center gap-1.5">
          <Icon name="minus" size={16} strokeWidth={3} className="shrink-0 text-text-muted" />
          <Badge label="EMPATE" />
        </span>
      );
    default:
      return (
        <PixelText className="text-text-muted">
          {item.status === 'IN_PROGRESS' ? 'EM JOGO' : 'SEM PLACAR'}
        </PixelText>
      );
  }
}

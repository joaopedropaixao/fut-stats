import { Link } from 'react-router';
import type { HistoryItem } from '@fut-stats/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { formatMatchDay, formatMatchTime, formatScore } from '../../features/history/format';
import { useHistoryList } from '../../features/history/queries';
import { WinnerSeal } from './winner-seal';

function MatchRow({ item, first }: { item: HistoryItem; first: boolean }) {
  return (
    <li className={first ? undefined : 'shadow-[inset_0_2px_0_0_var(--color-border)]'}>
      <Link
        to={`/historico/${item.roundId}`}
        className="flex min-h-20 items-center gap-3 px-4 py-3 hover:bg-highlight"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <PixelText>{formatMatchDay(item.scheduledAt)}</PixelText>
              <PixelText className="text-text-muted">{formatMatchTime(item.scheduledAt)}</PixelText>
            </div>
            {item.score && (
              <PixelDigits
                value={formatScore(item.score)}
                scale={3}
                label={`Branco ${item.score.white}, Preto ${item.score.black}`}
              />
            )}
          </div>
          <WinnerSeal item={item} />
        </div>
        <Icon name="chevronRight" size={20} strokeWidth={2.4} className="shrink-0" />
      </Link>
    </li>
  );
}

export function HistoryPage() {
  const { group, isPending: sessionPending } = useCurrentGroup();
  const list = useHistoryList(group?.id);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <>
      <title>Histórico · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Histórico
      </PixelText>

      {!sessionPending && !group && (
        <EmptyState title="Nenhum grupo ainda" message="Entre num grupo para ver as partidas." />
      )}
      {(sessionPending || (group && list.isPending && !list.isError)) && <SkeletonList rows={4} />}
      {list.isError && (
        <ErrorState
          title="Não deu para abrir o histórico"
          message="Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes."
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      )}
      {list.isSuccess && items.length === 0 && (
        <EmptyState
          title="Nenhuma partida ainda"
          message="Quando a primeira pelada rolar, o placar aparece aqui."
        />
      )}
      {items.length > 0 && (
        <>
          <ul className="bg-surface shadow-card">
            {items.map((item, i) => (
              <MatchRow key={item.roundId} item={item} first={i === 0} />
            ))}
          </ul>
          {list.hasNextPage && (
            <Button
              variant="outline"
              size={48}
              block
              label="Ver mais partidas"
              loading={list.isFetchingNextPage}
              onClick={() => void list.fetchNextPage()}
            />
          )}
        </>
      )}
    </>
  );
}

import { Link } from 'react-router';
import type { HistoryItem } from '@fut-stats/shared';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { EmptyState, ErrorState } from '../../components/ui/states';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { formatMatchDay, groupByMonth } from '../../features/history/format';
import { useHistoryList } from '../../features/history/queries';
import { resultLabel } from '../../features/history/match-view';
import { ResultLine, ScoreTile } from './result';

const OFFLINE_MESSAGE =
  'Parece que a internet caiu ou o servidor está acordando. Tente de novo em instantes.';

function MatchRow({ item, first }: { item: HistoryItem; first: boolean }) {
  const day = formatMatchDay(item.scheduledAt);
  const score = item.score ? `, Branco ${item.score.WHITE} a ${item.score.BLACK} Preto` : '';
  return (
    <li className={first ? undefined : 'shadow-[inset_0_2px_0_0_var(--color-border)]'}>
      <Link
        to={`/historico/${item.roundId}`}
        aria-label={`${day}${score}. ${resultLabel(item)}`}
        className="flex min-h-19 items-center gap-3 py-3 pr-2 pl-4 transition-colors duration-(--duration-fast) hover:bg-highlight focus-visible:-outline-offset-4"
      >
        <div className="flex min-w-0 flex-1 flex-col gap-2 overflow-hidden">
          <PixelText>{day}</PixelText>
          <ResultLine item={item} />
        </div>
        <ScoreTile item={item} />
        <Icon
          name="chevronRight"
          size={20}
          strokeWidth={2.4}
          className="-ml-1.5 shrink-0 text-text-muted"
        />
      </Link>
    </li>
  );
}

/** Esqueleto no formato da lista: mês, data, resultado e o placar pequeno. */
function HistorySkeleton() {
  return (
    <div role="status" aria-label="Carregando as partidas" className="flex flex-col gap-2">
      <div className="h-5 w-36 bg-surface-3" />
      <div className="flex flex-col bg-surface shadow-card">
        {[56, 44, 52, 40].map((width, i) => (
          <div
            key={width}
            className={
              i === 0
                ? 'flex min-h-19 items-center gap-3 px-4 py-3'
                : 'flex min-h-19 items-center gap-3 px-4 py-3 shadow-[inset_0_2px_0_0_var(--color-border)]'
            }
          >
            <div className="flex flex-1 flex-col gap-2">
              <div className="h-4 bg-surface-3" style={{ width: `${width}%` }} />
              <div className="h-4 w-1/3 bg-surface-3" />
            </div>
            <div className="h-11 w-20 bg-surface-3" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HistoryPage() {
  const { group, isPending: sessionPending } = useCurrentGroup();
  const list = useHistoryList(group?.id);
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  // O TanStack volta para "pending" ao tentar de novo sem dado: o erro fica na tela até a resposta chegar
  const failed = !list.data && list.errorUpdateCount > 0;

  return (
    <>
      <title>Histórico · Fut Stats</title>
      <header className="flex flex-col gap-1">
        <PixelText as="h1" size={24} wrap className="outline-none">
          Histórico
        </PixelText>
        {group && <p className="text-sm text-text-muted">{group.name}</p>}
      </header>

      {!sessionPending && !group && (
        <EmptyState
          title="Nenhum grupo ainda"
          message="Entre numa pelada pelo convite para ver as partidas."
        />
      )}
      {(sessionPending || (group && !list.data && !failed)) && <HistorySkeleton />}
      {failed && (
        <ErrorState
          title="Não deu para abrir o histórico"
          message={OFFLINE_MESSAGE}
          onRetry={() => void list.refetch()}
          retrying={list.isFetching}
        />
      )}
      {list.isSuccess && items.length === 0 && (
        <EmptyState
          title="Nenhuma partida ainda"
          message="Depois da primeira pelada, o placar e quem fez os gols ficam guardados aqui."
        />
      )}
      {groupByMonth(items).map(({ month, items: monthItems }) => (
        <section key={month} aria-label={month} className="flex flex-col gap-2">
          <PixelText as="h2" className="text-text-muted">
            {month}
          </PixelText>
          <ul className="bg-surface shadow-card">
            {monthItems.map((item, i) => (
              <MatchRow key={item.roundId} item={item} first={i === 0} />
            ))}
          </ul>
        </section>
      ))}
      {list.isFetchNextPageError ? (
        <ErrorState
          title="Não deu para carregar mais partidas"
          message={OFFLINE_MESSAGE}
          onRetry={() => void list.fetchNextPage()}
          retrying={list.isFetchingNextPage}
        />
      ) : (
        list.hasNextPage && (
          <Button
            variant="outline"
            size={48}
            block
            label="Ver mais partidas"
            loading={list.isFetchingNextPage}
            onClick={() => void list.fetchNextPage()}
          />
        )
      )}
    </>
  );
}

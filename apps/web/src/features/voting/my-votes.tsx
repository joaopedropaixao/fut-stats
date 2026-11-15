import type { VotingPlayer, VotingView } from '@fut-stats/shared';
import type { ReactNode } from 'react';
import { Badge, Star, Stilts } from '../../components/ui/badge';
import { IconButton } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { closesInLabel } from './deadline';
import { Meter } from './meter';
import type { openAt } from './vote-flow';

type MyVotesProps = {
  view: VotingView;
  remaining: number | null;
  onEdit: (step: Parameters<typeof openAt>[1]) => void;
};

/**
 * "SEUS VOTOS" (folha: Card/Seus votos/Edição): Craque, Perna de Pau e quantas notas foram enviadas, cada um com
 * lápis de 44 x 44 para mudar até a votação fechar. O voto é anônimo para os outros; aqui é o meu.
 */
export function MyVotes({ view, remaining, onEdit }: MyVotesProps) {
  const vote = view.me.vote;
  if (!vote) return null;
  const byId = (id: string): VotingPlayer | undefined =>
    view.players.find((p) => p.membershipId === id);
  const mvp = byId(vote.mvpId);
  const flop = byId(vote.flopId);
  return (
    <section
      aria-label="Seus votos"
      className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
    >
      <div className="flex flex-col gap-2 px-4 pt-4 pb-3">
        <PixelText as="h2" size={24}>
          Seus votos
        </PixelText>
        {remaining !== null && (
          <Badge variant="deadline" label={closesInLabel(remaining)} className="self-start" />
        )}
      </div>
      <Item
        icon={<Star size={24} />}
        label="Craque"
        value={mvp?.nickname ?? ''}
        valueClass="text-gold"
        editLabel="Mudar o craque"
        onEdit={() => onEdit('mvp')}
      />
      <Item
        icon={<Stilts size={24} />}
        label="Perna de pau"
        value={flop?.nickname ?? ''}
        valueClass="text-flop"
        editLabel="Mudar o perna de pau"
        onEdit={() => onEdit('flop')}
      />
      <Item
        icon={<Icon name="urn" size={24} />}
        label="Notas"
        value={`${vote.ratings.length} notas enviadas`}
        editLabel="Mudar as notas"
        onEdit={() => onEdit('review')}
      />
      <div className="p-4 shadow-[inset_0_2px_0_0_var(--color-border)]">
        <Meter voted={view.progress.voted} total={view.progress.total} showMissing />
      </div>
    </section>
  );
}

function Item({
  icon,
  label,
  value,
  valueClass,
  editLabel,
  onEdit,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  valueClass?: string;
  editLabel: string;
  onEdit: () => void;
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 py-2 pr-2 pl-4 shadow-[inset_0_2px_0_0_var(--color-border)]">
      <span className="shrink-0">{icon}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <PixelText wrap className="text-text-muted">
          {label}
        </PixelText>
        <PixelText wrap className={valueClass}>
          {value}
        </PixelText>
      </div>
      <IconButton icon="pencil" label={editLabel} onClick={onEdit} />
    </div>
  );
}

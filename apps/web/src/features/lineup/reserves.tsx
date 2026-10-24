import { TEAM_LABELS } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { RESERVE_BOXES, type LineupMember, type TeamKey } from './lineup-draft';
import { NoPresence } from './no-presence';
import { YOU_RING, YouTag } from './you-tag';

type ReservesProps = {
  team: TeamKey;
  /** Ids dos reservas, na ordem. */
  reserves: readonly string[];
  members: ReadonlyMap<string, LineupMember>;
  pickedId?: string | null;
  /** Sem `onBox`, é só para olhar. */
  onBox?: (index: number) => void;
  /** Quem está vendo (times publicados): ganha o anel forte e a etiqueta "Você". */
  meId?: string;
};

/** As caixas de reserva do time, embaixo do campo. Publicado, só aparecem as ocupadas. */
export function Reserves({ team, reserves, members, pickedId = null, onBox, meId }: ReservesProps) {
  const boxes = onBox ? RESERVE_BOXES : reserves.length;
  if (boxes === 0) return null;
  return (
    <section aria-label={`Reservas do ${TEAM_LABELS[team]}`} className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <PixelText as="h2">{`Reservas do ${TEAM_LABELS[team]}`}</PixelText>
        {onBox && (
          <PixelText className="text-text-muted">{`${reserves.length} de ${RESERVE_BOXES}`}</PixelText>
        )}
      </div>
      <ul className={cn('grid gap-3', onBox ? 'grid-cols-2' : 'grid-cols-1')}>
        {Array.from({ length: boxes }, (_, i) => {
          const id = reserves[i];
          const member = id ? members.get(id) : undefined;
          const me = id !== undefined && id === meId;
          const selected = id !== undefined && id === pickedId;
          const content = member ? (
            <>
              <span className={cn('inline-flex rounded-full', me && `-m-2 p-2 ${YOU_RING}`)}>
                <Avatar
                  nickname={member.nickname}
                  team={team === 'WHITE' ? 'white' : 'black'}
                  size={32}
                  gap="surface"
                />
              </span>
              <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                <PixelText>{member.nickname}</PixelText>
                {me && <YouTag />}
                {!member.confirmed && <NoPresence />}
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-text-muted shadow-[inset_0_0_0_2px_rgb(255_255_255/35%)]"
              >
                <Icon name="plus" size={14} strokeWidth={2.2} />
              </span>
              <PixelText className="text-text-muted">Livre</PixelText>
            </>
          );
          const className = cn(
            'flex min-h-14 w-full items-center bg-surface py-1.5 text-left',
            me ? 'gap-3 pr-2 pl-4' : 'gap-2 px-2',
            selected ? 'bg-surface-3 shadow-[inset_0_0_0_3px_var(--color-text)]' : 'shadow-card',
          );
          const name = member
            ? `Reserva: ${member.nickname}${me ? ' (você)' : ''}${member.confirmed ? '' : ', sem presença'}`
            : 'Reserva: vaga livre';
          return (
            <li key={i}>
              {onBox ? (
                <button
                  type="button"
                  onClick={() => onBox(i)}
                  aria-pressed={selected}
                  aria-label={name}
                  className={className}
                >
                  {content}
                </button>
              ) : (
                <div className={className}>{content}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

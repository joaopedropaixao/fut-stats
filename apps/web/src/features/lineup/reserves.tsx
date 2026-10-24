import { TEAM_LABELS } from '@fut-stats/shared';
import { Avatar } from '../../components/ui/avatar';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { RESERVE_BOXES, type LineupMember, type TeamKey } from './lineup-draft';
import { NoPresence } from './no-presence';

type ReservesProps = {
  team: TeamKey;
  /** Ids dos reservas, na ordem. */
  reserves: readonly string[];
  members: ReadonlyMap<string, LineupMember>;
  pickedId?: string | null;
  /** Sem `onBox`, é só para olhar. */
  onBox?: (index: number) => void;
};

/** As caixas de reserva do time, embaixo do campo. Publicado, só aparecem as ocupadas. */
export function Reserves({ team, reserves, members, pickedId = null, onBox }: ReservesProps) {
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
      <ul className="grid grid-cols-2 gap-3">
        {Array.from({ length: boxes }, (_, i) => {
          const id = reserves[i];
          const member = id ? members.get(id) : undefined;
          const selected = id !== undefined && id === pickedId;
          const content = member ? (
            <>
              <Avatar
                nickname={member.nickname}
                team={team === 'WHITE' ? 'white' : 'black'}
                size={32}
                gap="surface"
              />
              <span className="flex min-w-0 flex-col items-start gap-1">
                <PixelText>{member.nickname}</PixelText>
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
            'flex min-h-14 w-full items-center gap-3 bg-surface px-3 py-1.5 text-left',
            selected ? 'bg-surface-3 shadow-[inset_0_0_0_3px_var(--color-text)]' : 'shadow-card',
          );
          const name = member
            ? `Reserva: ${member.nickname}${member.confirmed ? '' : ', sem presença'}`
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

import { POSITION_LABELS, type AttendanceMember, type RoundDetail } from '@fut-stats/shared';
import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { MemberAvatar } from './member-avatar';

type SetAttendance = (membershipId: string, confirmed: boolean, nickname: string) => void;

function Dots() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <rect x="3" y="10" width="4" height="4" />
      <rect x="10" y="10" width="4" height="4" />
      <rect x="17" y="10" width="4" height="4" />
    </svg>
  );
}

function MenuItem({
  icon,
  label,
  className,
  onClick,
}: {
  icon: IconName;
  label: string;
  className?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex h-13 items-center gap-3 px-4 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none',
        className,
      )}
    >
      <Icon name={icon} size={20} strokeWidth={2.2} />
      <PixelText>{label}</PixelText>
    </button>
  );
}

/** Linha de elenco: avatar, apelido, posição e (para o admin) o menu ⋯ com a presença do membro. */
function MemberRow({
  member,
  answer,
  menu,
  onSet,
}: {
  member: AttendanceMember;
  answer: boolean | null;
  /** Admin pode marcar a presença de qualquer membro. */
  menu: boolean;
  onSet: SetAttendance;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return;
      if (e.type === 'pointerdown' && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  const choose = (confirmed: boolean) => {
    setOpen(false);
    onSet(member.membershipId, confirmed, member.nickname);
  };

  return (
    <li
      ref={ref}
      className="relative flex min-h-18 items-center gap-2.5 py-2 pr-2 pl-3 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none"
    >
      <MemberAvatar nickname={member.nickname} goalkeeper={member.isHiredGoalkeeper} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <PixelText>{member.nickname}</PixelText>
        <PixelText className="text-text-muted">{POSITION_LABELS[member.primaryPosition]}</PixelText>
      </div>
      {menu && (
        <button
          type="button"
          aria-label={`Presença de ${member.nickname}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="inline-flex size-11 shrink-0 items-center justify-center shadow-card"
        >
          <Dots />
        </button>
      )}
      {open && (
        <div
          role="menu"
          className="absolute top-full right-2 z-(--z-sheet) flex w-56 flex-col bg-surface-3 shadow-float"
        >
          {answer !== true && (
            <MenuItem
              icon="check"
              label="Confirmar"
              className="text-text"
              onClick={() => choose(true)}
            />
          )}
          {answer !== false && (
            <MenuItem
              icon="x"
              label="Ausência"
              className="text-[#fca5a5]"
              onClick={() => choose(false)}
            />
          )}
        </div>
      )}
    </li>
  );
}

function Group({
  title,
  icon,
  iconClass,
  members,
  answer,
  menu,
  onSet,
  empty,
}: {
  title: string;
  icon: IconName;
  iconClass: string;
  members: AttendanceMember[];
  answer: boolean | null;
  menu: boolean;
  onSet: SetAttendance;
  empty: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2">
        <Icon name={icon} size={20} strokeWidth={3} className={iconClass} />
        <PixelText>{`${title} · ${members.length}`}</PixelText>
      </h2>
      {members.length === 0 ? (
        <p className="px-1 text-sm text-text-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col bg-surface shadow-card">
          {members.map((member) => (
            <MemberRow
              key={member.membershipId}
              member={member}
              answer={answer}
              menu={menu}
              onSet={onSet}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** As três listas de presença: vão, não vão e sem resposta. O admin ganha o menu ⋯ em cada linha. */
export function AttendanceLists({ round, onSet }: { round: RoundDetail; onSet: SetAttendance }) {
  const menu = round.permissions.setAnyAttendance;
  const { confirmed, declined, pending } = round.attendance;
  return (
    <div className="flex flex-col gap-6">
      <Group
        title="Vão"
        icon="check"
        iconClass="text-success"
        members={confirmed}
        answer
        menu={menu}
        onSet={onSet}
        empty="Ninguém confirmou ainda."
      />
      <Group
        title="Não vão"
        icon="x"
        iconClass="text-[#f87171]"
        members={declined}
        answer={false}
        menu={menu}
        onSet={onSet}
        empty="Ninguém avisou que não vai."
      />
      <Group
        title="Sem resposta"
        icon="clock"
        iconClass="text-warning"
        members={pending}
        answer={null}
        menu={menu}
        onSet={onSet}
        empty="Todo mundo respondeu."
      />
    </div>
  );
}

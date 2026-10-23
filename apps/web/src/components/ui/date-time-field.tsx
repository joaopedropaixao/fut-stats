import { useState } from 'react';
import { cn } from '../../lib/cn';
import { formatRoundDay, formatRoundTime } from '../../lib/round-format';
import { Icon, type IconName } from './icons';
import { PixelText } from './pixel-text';

const DAYS_AHEAD = 14;
const FIRST_HOUR = 6;
const LAST_HOUR = 23;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/** Hoje e os próximos dias; mais o dia já escolhido, se for fora dessa janela (rodada antiga ou distante). */
function dayOptions(value: Date): Date[] {
  const today = startOfDay(new Date());
  const days = Array.from(
    { length: DAYS_AHEAD },
    (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
  );
  if (!days.some((d) => sameDay(d, value))) days.unshift(startOfDay(value));
  return days.sort((a, b) => a.getTime() - b.getTime());
}

/** De meia em meia hora; mais a hora já escolhida, se não estiver na grade (ex.: 20h15). */
function timeOptions(value: Date): { hours: number; minutes: number }[] {
  const options: { hours: number; minutes: number }[] = [];
  for (let hours = FIRST_HOUR; hours <= LAST_HOUR; hours++) {
    options.push({ hours, minutes: 0 }, { hours, minutes: 30 });
  }
  const current = { hours: value.getHours(), minutes: value.getMinutes() };
  if (!options.some((o) => o.hours === current.hours && o.minutes === current.minutes)) {
    options.push(current);
    options.sort((a, b) => a.hours * 60 + a.minutes - (b.hours * 60 + b.minutes));
  }
  return options;
}

type Open = 'day' | 'time' | null;

type DateTimeFieldProps = {
  value: Date;
  onChange: (value: Date) => void;
};

function Trigger({
  label,
  icon,
  text,
  open,
  className,
  onClick,
}: {
  label: string;
  icon: IconName;
  text: string;
  open: boolean;
  className?: string;
  onClick: () => void;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <PixelText className="text-text-muted">{label}</PixelText>
      <button
        type="button"
        aria-label={`${label}: ${text}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onClick}
        className={cn(
          'flex h-14 items-center justify-between gap-2 bg-surface px-3.5',
          open
            ? 'shadow-[inset_0_0_0_3px_var(--color-text)]'
            : 'shadow-[inset_0_0_0_2px_var(--color-border-strong)]',
        )}
      >
        <PixelText>{text}</PixelText>
        <Icon name={icon} size={22} />
      </button>
    </div>
  );
}

/**
 * Data e hora da rodada (peça do DS): dois campos, Data e Hora; cada um abre uma lista logo abaixo.
 * A lista de dias vai de hoje a 14 dias; a de horas, de meia em meia hora. O dia da pelada não é fixo.
 */
export function DateTimeField({ value, onChange }: DateTimeFieldProps) {
  const [open, setOpen] = useState<Open>(null);
  const toggle = (which: Exclude<Open, null>) => setOpen((o) => (o === which ? null : which));

  const pickDay = (day: Date) => {
    onChange(
      new Date(
        day.getFullYear(),
        day.getMonth(),
        day.getDate(),
        value.getHours(),
        value.getMinutes(),
      ),
    );
    setOpen(null);
  };
  const pickTime = (hours: number, minutes: number) => {
    onChange(new Date(value.getFullYear(), value.getMonth(), value.getDate(), hours, minutes));
    setOpen(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3">
        <Trigger
          label="Data"
          icon="calendar"
          text={formatRoundDay(value)}
          open={open === 'day'}
          className="min-w-0 flex-1"
          onClick={() => toggle('day')}
        />
        <Trigger
          label="Hora"
          icon="clock"
          text={formatRoundTime(value)}
          open={open === 'time'}
          className="w-32 shrink-0"
          onClick={() => toggle('time')}
        />
      </div>
      {open && (
        <div
          role="listbox"
          aria-label={open === 'day' ? 'Escolha o dia' : 'Escolha a hora'}
          className="flex max-h-72 flex-col overflow-y-auto bg-surface-3 shadow-float"
        >
          <div className="px-4 pt-3 pb-2">
            <PixelText className="text-text-muted">
              {open === 'day' ? 'Escolha o dia' : 'Escolha a hora'}
            </PixelText>
          </div>
          {open === 'day'
            ? dayOptions(value).map((day) => {
                const selected = sameDay(day, value);
                return (
                  <Option key={day.getTime()} selected={selected} onClick={() => pickDay(day)}>
                    {formatRoundDay(day)}
                  </Option>
                );
              })
            : timeOptions(value).map(({ hours, minutes }) => {
                const selected = hours === value.getHours() && minutes === value.getMinutes();
                return (
                  <Option
                    key={hours * 60 + minutes}
                    selected={selected}
                    onClick={() => pickTime(hours, minutes)}
                  >
                    {formatRoundTime(new Date(2000, 0, 1, hours, minutes))}
                  </Option>
                );
              })}
        </div>
      )}
    </div>
  );
}

function Option({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex h-13 shrink-0 items-center justify-between px-4 shadow-[inset_0_2px_0_0_var(--color-border)]',
        selected && 'bg-surface-raised shadow-[inset_0_0_0_3px_var(--color-text)]',
      )}
    >
      <PixelText>{children}</PixelText>
      {selected && <Icon name="check" size={22} strokeWidth={3} className="text-success" />}
    </button>
  );
}

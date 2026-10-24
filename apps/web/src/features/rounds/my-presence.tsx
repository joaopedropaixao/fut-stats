import { ATTENDANCE_ERROR_LABELS, type RoundDetail } from '@fut-stats/shared';
import { Icon, type IconName } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { PresenceChoice } from '../../components/ui/presence-choice';
import { cn } from '../../lib/cn';

/** Por que a pessoa não pode mudar a própria presença agora (a API decide; aqui só o texto). */
function lockedReason(round: RoundDetail): string {
  return round.status === 'TEAMS_PUBLISHED'
    ? ATTENDANCE_ERROR_LABELS.TEAMS_ALREADY_PUBLISHED
    : ATTENDANCE_ERROR_LABELS.ATTENDANCE_CLOSED;
}

type Stamp = { icon: IconName; title: string; text: string; tone: string };

/** O carimbo da resposta: muda de cor, ícone e frase com o que a pessoa respondeu. */
function stampFor(round: RoundDetail, locked: boolean): Stamp {
  const going = round.confirmedCount;
  const canChange = locked ? '' : ' Dá pra mudar até os times saírem.';
  if (round.myAttendance === true) {
    return {
      icon: 'check',
      title: 'Você está dentro',
      text: `Seu nome está na lista.${canChange}`,
      tone: 'bg-success/12 text-[#86efac] shadow-[inset_0_0_0_2px_var(--color-success)]',
    };
  }
  if (round.myAttendance === false) {
    return {
      icon: 'x',
      title: 'Ficou de fora',
      text: locked ? 'Fica pra próxima.' : 'Mudou de ideia? Dá pra voltar até os times saírem.',
      tone: 'bg-danger/10 text-[#f87171] shadow-[inset_0_0_0_2px_var(--color-danger)]',
    };
  }
  return {
    icon: 'clock',
    title: 'Falta você',
    text:
      going === 0
        ? 'Ninguém confirmou ainda. Seja o primeiro.'
        : `${going === 1 ? '1 já confirmou' : `${going} já confirmaram`}. Vai ou não vai?`,
    tone: 'bg-warning/10 text-warning shadow-[inset_0_0_0_2px_var(--color-warning)]',
  };
}

/** CONFIRMAR / AUSÊNCIA de 64px e o carimbo do que foi respondido; travado, mostra o motivo. */
export function MyPresence({
  round,
  onChange,
}: {
  round: RoundDetail;
  onChange: (confirmed: boolean) => void;
}) {
  const locked = !round.permissions.setOwnAttendance;
  const stamp = stampFor(round, locked);
  const order = round.attendance.confirmed.findIndex(
    (m) => m.membershipId === round.myMembershipId,
  );
  return (
    <div className="flex flex-col gap-3">
      <PresenceChoice value={round.myAttendance} onChange={onChange} disabled={locked} />
      <div
        // Troca de chave a cada resposta: o carimbo entra de novo, em degraus
        key={String(round.myAttendance)}
        role="status"
        className={cn('flex animate-stamp items-center gap-3 p-3', stamp.tone)}
      >
        <Icon name={stamp.icon} size={22} strokeWidth={3} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <PixelText wrap>{stamp.title}</PixelText>
          <p className="text-sm text-text">{stamp.text}</p>
        </div>
        {order >= 0 && (
          <div
            className="flex shrink-0 flex-col items-center gap-1"
            aria-label={`Você é o ${order + 1}º da lista`}
          >
            <PixelDigits value={order + 1} scale={3} decorative />
            <PixelText className="text-text-muted">da lista</PixelText>
          </div>
        )}
      </div>
      {locked && (
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
          {lockedReason(round)}
        </p>
      )}
    </div>
  );
}

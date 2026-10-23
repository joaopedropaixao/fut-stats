import { ATTENDANCE_ERROR_LABELS, type RoundDetail } from '@fut-stats/shared';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { PresenceChoice } from '../../components/ui/presence-choice';

/** Por que a pessoa não pode mudar a própria presença agora (a API decide; aqui só o texto). */
function lockedReason(round: RoundDetail): string {
  return round.status === 'TEAMS_PUBLISHED'
    ? ATTENDANCE_ERROR_LABELS.TEAMS_ALREADY_PUBLISHED
    : ATTENDANCE_ERROR_LABELS.ATTENDANCE_CLOSED;
}

const ANSWER_LABEL = {
  yes: 'Você vai',
  no: 'Você não vai',
  none: 'Você ainda não respondeu',
} as const;

/** CONFIRMAR / AUSÊNCIA de 64px com o que já foi respondido; travado, mostra o motivo. */
export function MyPresence({
  round,
  onChange,
}: {
  round: RoundDetail;
  onChange: (confirmed: boolean) => void;
}) {
  const locked = !round.permissions.setOwnAttendance;
  const answer =
    ANSWER_LABEL[round.myAttendance === null ? 'none' : round.myAttendance ? 'yes' : 'no'];
  return (
    <div className="flex flex-col gap-3">
      <PresenceChoice value={round.myAttendance} onChange={onChange} disabled={locked} />
      <PixelText wrap className="text-text-muted">
        {answer}
      </PixelText>
      {locked && (
        <p className="flex items-start gap-2 text-sm text-text-muted">
          <Icon name="lock" size={16} className="mt-0.5 shrink-0" />
          {lockedReason(round)}
        </p>
      )}
    </div>
  );
}

import type { RoundDetail } from '@fut-stats/shared';
import { useNotice } from '../../components/ui/use-notice';
import { apiErrorMessage } from '../../lib/api';
import { answerOf } from './apply-attendance';
import { useSetAttendance } from './queries';

/**
 * Marcar presença com aviso: confirma o que mudou (com "Desfazer" se a pessoa já tinha respondido, porque a
 * API não volta para "sem resposta") e mostra o `{ code, message }` da API como aviso quando ela recusa.
 */
export function usePresence(groupId: string, round: RoundDetail) {
  const notice = useNotice();
  const { mutate, isPending } = useSetAttendance(groupId, round.id);
  const { show } = notice;

  /** `undoTo`: a resposta anterior, para o "Desfazer" (`null` = não havia, e a API não volta a "sem resposta"). */
  const send = (
    membershipId: string,
    confirmed: boolean,
    nickname: string | undefined,
    undoTo: boolean | null,
  ) =>
    mutate(
      { membershipId, confirmed },
      {
        onSuccess: () => {
          const who = nickname ? ` de ${nickname}` : '';
          show({
            kind: 'success',
            title: confirmed ? `Presença${who} confirmada` : `Ausência${who} marcada`,
            onUndo: undoTo === null ? undefined : () => send(membershipId, undoTo, nickname, null),
          });
        },
        onError: (err) =>
          show({
            kind: 'error',
            title: 'Não deu para marcar',
            message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
          }),
      },
    );

  const setAttendance = (membershipId: string, confirmed: boolean, nickname?: string) => {
    const previous = answerOf(round, membershipId);
    if (previous !== confirmed) send(membershipId, confirmed, nickname, previous);
  };

  return { setAttendance, isPending, notice: notice.node };
}

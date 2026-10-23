import { groupResponseSchema, type CreateGroupInput, type JoinGroupInput } from '@fut-stats/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { ApiError, apiPost } from '../../lib/api';
import { sessionQueryKey } from '../session/use-session';
import { setCurrentGroupId } from './use-current-group';

/** Mensagem para a pessoa a partir do erro da API ao criar/entrar num grupo. */
export function enterGroupErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'Este convite não existe mais. Peça um link novo ao admin.';
    if (error.status === 409 && error.body?.message) return error.body.message;
    if (error.status === 400) return 'Confira os dados e tente de novo.';
  }
  return 'Não deu para concluir agora. Tente de novo em instantes.';
}

/** Depois de criar ou entrar: atualiza a sessão, marca o grupo como atual e vai para o início. */
function useAfterEnter() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return async (groupId: string) => {
    // Se o refetch falhar, a pessoa já entrou: segue para o início e o shell tenta de novo
    await queryClient.invalidateQueries({ queryKey: sessionQueryKey }).catch(() => undefined);
    setCurrentGroupId(groupId);
    void navigate('/', { replace: true });
  };
}

export function useCreateGroup() {
  const afterEnter = useAfterEnter();
  return useMutation({
    mutationFn: (input: CreateGroupInput) => apiPost('/groups', groupResponseSchema, input),
    onSuccess: (group) => afterEnter(group.id),
  });
}

export function useJoinGroup(code: string) {
  const afterEnter = useAfterEnter();
  return useMutation({
    mutationFn: (input: JoinGroupInput) =>
      apiPost(`/invites/${encodeURIComponent(code)}/join`, groupResponseSchema, input),
    onSuccess: (group) => afterEnter(group.id),
  });
}

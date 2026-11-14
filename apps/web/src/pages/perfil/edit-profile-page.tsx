import { useNavigate } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { flashState } from '../../features/group/flash';
import { MemberForm } from '../../features/group/member-form';
import { useMember } from '../../features/group/members';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RouteButton } from '../../features/rounds/route-button';
import { ApiError } from '../../lib/api';

/** `/perfil/editar`: o jogador edita o próprio apelido, bonequinho, posição principal e secundárias. */
export function EditProfilePage() {
  const { group } = useCurrentGroup();
  const navigate = useNavigate();
  const member = useMember(group?.id ?? '', group?.membershipId);
  if (!group) return null;

  const notFound = member.error instanceof ApiError && member.error.status === 404;

  return (
    <>
      <title>Editar perfil · Fut Stats</title>
      <RouteButton
        to="/perfil"
        label="Perfil"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <PixelText as="h1" size={24} wrap className="outline-none">
        Editar perfil
      </PixelText>
      {notFound ? (
        <EmptyState title="Perfil não encontrado" message="Você não faz mais parte dessa pelada." />
      ) : member.isError ? (
        <ErrorState
          title="Não deu para abrir o seu perfil"
          message="Confira a internet e tente de novo."
          onRetry={() => void member.refetch()}
          retrying={member.isFetching}
        />
      ) : member.data ? (
        <MemberForm
          key={member.data.id}
          groupId={group.id}
          member={member.data}
          adminFields={false}
          isMe
          onSaved={() => void navigate('/perfil', { state: flashState('Perfil salvo') })}
        />
      ) : (
        <SkeletonList rows={3} label="Carregando o seu perfil" />
      )}
    </>
  );
}

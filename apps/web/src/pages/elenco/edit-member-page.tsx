import { Navigate, useNavigate, useParams } from 'react-router';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { PixelText } from '../../components/ui/pixel-text';
import { flashState } from '../../features/group/flash';
import { MemberForm } from '../../features/group/member-form';
import { useRoster } from '../../features/group/members';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RouteButton } from '../../features/rounds/route-button';

/** `/elenco/:membershipId`: o admin edita o jogador: o perfil mais nota inicial, goleiro contratado e papel. */
export function EditMemberPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  // O jogador comum não tem Elenco: volta ao Perfil (a API já responde 403)
  if (group.role !== 'ADMIN') return <Navigate to="/perfil" replace />;
  return <EditMember groupId={group.id} myMembershipId={group.membershipId} />;
}

function EditMember({ groupId, myMembershipId }: { groupId: string; myMembershipId: string }) {
  const { membershipId } = useParams();
  const navigate = useNavigate();
  const roster = useRoster(groupId);
  const member = roster.data?.find((m) => m.id === membershipId);

  return (
    <>
      <title>Editar jogador · Fut Stats</title>
      <RouteButton
        to="/elenco"
        label="Elenco"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <PixelText as="h1" size={24} wrap className="outline-none">
        Editar jogador
      </PixelText>
      {roster.isError ? (
        <ErrorState
          title="Não deu para abrir o jogador"
          message="Confira a internet e tente de novo."
          onRetry={() => void roster.refetch()}
          retrying={roster.isFetching}
        />
      ) : !roster.data ? (
        <SkeletonList rows={3} label="Carregando o jogador" />
      ) : !member ? (
        <EmptyState
          title="Jogador não encontrado"
          message="Ele não está no elenco dessa pelada. Volte à lista e escolha outro."
        />
      ) : (
        <MemberForm
          key={member.id}
          groupId={groupId}
          member={member}
          adminFields
          isMe={member.id === myMembershipId}
          onSaved={() => void navigate('/elenco', { state: flashState('Jogador salvo') })}
        />
      )}
    </>
  );
}

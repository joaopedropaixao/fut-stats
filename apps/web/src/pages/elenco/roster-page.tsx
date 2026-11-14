import { NICKNAME_TAKEN_LABEL, type RosterMember } from '@fut-stats/shared';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { EmptyState, ErrorState, SkeletonList } from '../../components/ui/states';
import { useFlashNotice } from '../../features/group/flash';
import { useChangeRosterMember, useRoster } from '../../features/group/members';
import { RosterRow } from '../../features/group/roster-row';
import { splitRoster } from '../../features/group/roster-state';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { ApiError, apiErrorMessage } from '../../lib/api';
import { RouteButton } from '../../features/rounds/route-button';

/** `/elenco`: o admin vê todos os membros (ativos e inativos) e age pelo menu ⋯ de cada linha. */
export function RosterPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  // O jogador comum não tem Elenco: volta ao Perfil (a API já responde 403)
  if (group.role !== 'ADMIN') return <Navigate to="/perfil" replace />;
  return <Roster groupId={group.id} myMembershipId={group.membershipId} />;
}

function Roster({ groupId, myMembershipId }: { groupId: string; myMembershipId: string }) {
  const roster = useRoster(groupId);
  const change = useChangeRosterMember(groupId);
  const notice = useFlashNotice();
  const navigate = useNavigate();
  const [removing, setRemoving] = useState<RosterMember | null>(null);

  const edit = (member: RosterMember) => void navigate(`/elenco/${member.id}`);

  /** Aplica a mudança na hora; o aviso fala o que aconteceu (com Desfazer) ou por que não deu. */
  async function apply(
    member: RosterMember,
    patch: { role?: 'ADMIN' | 'PLAYER'; active?: boolean },
    title: string,
    undo?: { role?: 'ADMIN' | 'PLAYER'; active?: boolean },
  ) {
    try {
      await change.mutateAsync({ membershipId: member.id, change: patch });
      notice.show({
        kind: 'success',
        title,
        onUndo: undo
          ? () =>
              void change.mutateAsync({ membershipId: member.id, change: undo }).catch((error) =>
                notice.show({
                  kind: 'error',
                  title: 'Não deu certo',
                  message: apiErrorMessage(error, 'Confira a internet e tente de novo.'),
                }),
              )
          : undefined,
      });
    } catch (error) {
      const taken =
        error instanceof ApiError && error.status === 409 && error.body?.code === 'NICKNAME_TAKEN';
      notice.show({
        kind: 'error',
        title: taken ? 'Apelido em uso' : 'Não deu certo',
        message: taken
          ? `${error.body?.message ?? NICKNAME_TAKEN_LABEL}. Edite o apelido para reativar.`
          : apiErrorMessage(error, 'Confira a internet e tente de novo.'),
        onUndo: taken ? () => edit(member) : undefined,
        actionLabel: taken ? 'Editar' : undefined,
      });
    }
  }

  const { data } = roster;
  const { active, inactive } = data ? splitRoster(data) : { active: [], inactive: [] };

  const rows = (members: RosterMember[]) => (
    <ul className="flex flex-col bg-surface shadow-card">
      {members.map((member) => (
        <RosterRow
          key={member.id}
          member={member}
          mine={member.id === myMembershipId}
          onEdit={() => edit(member)}
          onToggleAdmin={() =>
            member.role === 'ADMIN'
              ? void apply(member, { role: 'PLAYER' }, `${member.nickname} não é mais admin`, {
                  role: 'ADMIN',
                })
              : void apply(member, { role: 'ADMIN' }, `${member.nickname} agora é admin`, {
                  role: 'PLAYER',
                })
          }
          onRemove={() => setRemoving(member)}
          onReactivate={() =>
            void apply(member, { active: true }, `${member.nickname} voltou ao elenco`, {
              active: false,
            })
          }
        />
      ))}
    </ul>
  );

  return (
    <>
      <title>Elenco · Fut Stats</title>
      <RouteButton
        to="/perfil"
        label="Perfil"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
      />
      <PixelText as="h1" size={24} wrap className="outline-none">
        Elenco
      </PixelText>
      {roster.isError ? (
        <ErrorState
          title="Não deu para carregar o elenco"
          message="Confira a internet e tente de novo."
          onRetry={() => void roster.refetch()}
          retrying={roster.isFetching}
        />
      ) : !data ? (
        <SkeletonList rows={5} label="Carregando o elenco" />
      ) : data.length === 0 ? (
        <EmptyState title="Elenco vazio" message="Convide a turma pelo link do Perfil." />
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2>
              <PixelText>{`Ativos · ${active.length}`}</PixelText>
            </h2>
            {rows(active)}
          </section>
          {inactive.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2>
                <PixelText className="text-text-muted">{`Inativos · ${inactive.length}`}</PixelText>
              </h2>
              {rows(inactive)}
            </section>
          )}
        </>
      )}
      {removing && (
        <Sheet
          title={`Remover ${removing.nickname}?`}
          onClose={() => setRemoving(null)}
          actions={(close) => (
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={close}
              />
              <Button
                variant="danger"
                size={52}
                icon="trash"
                label="Remover"
                className="flex-1"
                onClick={() => {
                  const member = removing;
                  close();
                  void apply(member, { active: false }, `${member.nickname} saiu do elenco`, {
                    active: true,
                  });
                }}
              />
            </>
          )}
        >
          <p>Ele sai do elenco e perde o acesso. O histórico dele fica. Dá para reativar depois.</p>
        </Sheet>
      )}
      {notice.node}
    </>
  );
}

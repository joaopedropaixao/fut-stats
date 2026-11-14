import type { MeResponse } from '@fut-stats/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState } from '../../components/ui/states';
import { useFlashNotice } from '../../features/group/flash';
import { InviteCard } from '../../features/group/invite-card';
import { useMember } from '../../features/group/members';
import { PlayerCard } from '../../features/group/player-card';
import { setCurrentGroupId, useCurrentGroup } from '../../features/group/use-current-group';
import { RouteButton } from '../../features/rounds/route-button';
import { sessionQueryKey } from '../../features/session/use-session';
import { apiPostNoContent } from '../../lib/api';
import { cn } from '../../lib/cn';

type MyGroup = MeResponse['groups'][number];

/**
 * Perfil: a figurinha do jogador (bonequinho, apelido, posição, selos e "VOCÊ"), editar perfil, o Elenco (admin),
 * as peladas, o convite do admin e sair. Nenhuma tecla amarela: o "Sair" não é a ação principal.
 */
export function ProfilePage() {
  const { data, group, groups } = useCurrentGroup();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const notice = useFlashNotice();
  const member = useMember(group?.id ?? '', group?.membershipId);
  const logout = useMutation({
    mutationFn: () => apiPostNoContent('/auth/logout'),
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(sessionQueryKey, null);
      void navigate('/entrar', { replace: true });
    },
  });

  if (!data) return null;
  const { user } = data;
  const isAdmin = group?.role === 'ADMIN';

  return (
    <>
      <title>Perfil · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Perfil
      </PixelText>

      {group && (
        <>
          {member.isError ? (
            <ErrorState
              title="Não deu para abrir o seu perfil"
              message="Confira a internet e tente de novo."
              onRetry={() => void member.refetch()}
              retrying={member.isFetching}
            />
          ) : member.data ? (
            <PlayerCard
              nickname={member.data.nickname}
              avatar={member.data.avatar}
              position={member.data.primaryPosition}
              secondaryPositions={member.data.secondaryPositions}
              isAdmin={isAdmin}
              mine
            />
          ) : (
            <PlayerCardSkeleton />
          )}
          <div className={cn('grid gap-3', isAdmin ? 'grid-cols-2' : 'grid-cols-1')}>
            <RouteButton
              to="/perfil/editar"
              label="Editar perfil"
              icon="pencil"
              variant="outline"
              size={48}
              block
            />
            {isAdmin && (
              <RouteButton
                to="/elenco"
                label="Elenco"
                icon="profile"
                variant="outline"
                size={48}
                block
              />
            )}
          </div>
        </>
      )}

      <div className="flex min-w-0 flex-col">
        <p className="text-sm break-words text-text-muted">{user.name}</p>
        <p className="text-sm break-all text-text-muted">{user.email}</p>
      </div>

      <section aria-labelledby="peladas-titulo" className="flex flex-col gap-3">
        <h2 id="peladas-titulo" className="text-text-muted">
          <PixelText>{groups.length > 1 ? 'Suas peladas' : 'Sua pelada'}</PixelText>
        </h2>
        {groups.length > 1 ? (
          <GroupSwitch groups={groups} currentId={group?.id} />
        ) : (
          group && (
            <div className="flex min-h-14 items-center gap-3 bg-surface px-4 py-2 shadow-card">
              <GroupName group={group} />
            </div>
          )
        )}
      </section>

      {isAdmin ? (
        <InviteCard key={group.id} groupId={group.id} groupName={group.name} />
      ) : (
        <p className="text-sm text-text-muted">
          Quer chamar alguém para a pelada? Peça o link de convite ao admin.
        </p>
      )}

      <div className="flex flex-col gap-3 pt-2">
        {logout.isError && (
          <p role="alert" className="text-sm text-[#fca5a5]">
            Não deu para sair agora. Tente de novo.
          </p>
        )}
        <Button
          variant="outline"
          size={48}
          label="Sair da conta"
          block
          loading={logout.isPending}
          onClick={() => logout.mutate()}
        />
      </div>
      {notice.node}
    </>
  );
}

/** A figurinha carregando: o mesmo contorno grosso, com o gramado e as linhas de texto apagados. */
function PlayerCardSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando o seu perfil"
      className="moment-frame flex flex-col bg-surface-raised"
    >
      <div className="h-52 bg-surface-3" />
      <div className="flex flex-col gap-3 p-4">
        <div className="h-6 w-1/2 bg-surface-3 shadow-card" />
        <div className="h-4 w-1/3 bg-surface-3 shadow-card" />
      </div>
    </div>
  );
}

function GroupName({ group }: { group: MyGroup }) {
  return (
    <>
      <PixelText wrap className="min-w-0 flex-1">
        {group.name}
      </PixelText>
      {/* Largura fixa: os selos ficam na mesma coluna em todas as linhas */}
      <Badge
        label={group.role === 'ADMIN' ? 'Admin' : 'Jogador'}
        variant={group.role === 'ADMIN' ? 'admin' : 'neutral'}
        className="w-30 justify-center"
      />
    </>
  );
}

/** Mais de uma pelada: a escolhida vira a atual do app (lista de opções da folha, rádio nativo). */
function GroupSwitch({ groups, currentId }: { groups: MyGroup[]; currentId?: string }) {
  const name = useId();
  return (
    <fieldset className="flex flex-col bg-surface shadow-card">
      <legend className="sr-only">Pelada que o app mostra</legend>
      {groups.map((g, i) => {
        const current = g.id === currentId;
        return (
          <label
            key={g.id}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 px-4 py-2',
              'has-focus-visible:outline-2 has-focus-visible:-outline-offset-4 has-focus-visible:outline-text',
              current
                ? 'bg-highlight shadow-[inset_0_0_0_2px_var(--color-text)]'
                : i > 0 && 'shadow-[inset_0_2px_0_0_var(--color-border)]',
            )}
          >
            <input
              type="radio"
              name={name}
              value={g.id}
              checked={current}
              onChange={() => setCurrentGroupId(g.id)}
              className="sr-only"
            />
            <GroupName group={g} />
            <span className="flex w-5 shrink-0 justify-end">
              {current && (
                <Icon name="check" size={20} strokeWidth={2.4} className="text-success" />
              )}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

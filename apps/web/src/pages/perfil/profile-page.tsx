import type { MeResponse } from '@fut-stats/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '../../components/ui/avatar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { InviteCard } from '../../features/group/invite-card';
import { setCurrentGroupId, useCurrentGroup } from '../../features/group/use-current-group';
import { sessionQueryKey } from '../../features/session/use-session';
import { apiPostNoContent } from '../../lib/api';
import { cn } from '../../lib/cn';

type MyGroup = MeResponse['groups'][number];

/** Perfil mínimo da Fase 1: quem sou, meus grupos (troca do atual), convite do admin e sair. */
export function ProfilePage() {
  const { data, group, groups } = useCurrentGroup();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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

  return (
    <>
      <title>Perfil · Fut Stats</title>
      <PixelText as="h1" size={24} wrap className="outline-none">
        Perfil
      </PixelText>

      {/* p-1: o anel do avatar fica por fora da foto e não pode passar da margem da tela */}
      <div className="flex items-center gap-4">
        <span className="flex shrink-0 p-1">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="size-14 rounded-full object-cover shadow-[0_0_0_2px_var(--color-bg),0_0_0_4px_var(--color-text)]"
            />
          ) : (
            <Avatar nickname={user.name} team="white" size={56} />
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <p className="text-lg font-semibold break-words">{user.name}</p>
          <p className="text-sm break-all text-text-muted">{user.email}</p>
        </div>
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

      {group?.role === 'ADMIN' ? (
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
    </>
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

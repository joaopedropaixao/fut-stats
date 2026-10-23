import { useMutation, useQueryClient } from '@tanstack/react-query';
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

      <div className="flex items-center gap-4">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Avatar nickname={user.name} team="white" size={56} />
        )}
        <div className="flex min-w-0 flex-col">
          <p className="text-base font-semibold break-words">{user.name}</p>
          <p className="text-sm break-all text-text-muted">{user.email}</p>
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-label="Suas peladas">
        <PixelText as="h2" size={16} className="text-text-muted">
          Suas peladas
        </PixelText>
        <ul className="flex flex-col bg-surface shadow-card">
          {groups.map((g) => {
            const current = g.id === group?.id;
            return (
              <li
                key={g.id}
                className="shadow-[inset_0_-2px_0_0_var(--color-border)] last:shadow-none"
              >
                <button
                  type="button"
                  aria-pressed={current}
                  onClick={() => setCurrentGroupId(g.id)}
                  className={cn(
                    'flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left',
                    current && 'bg-highlight',
                  )}
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <PixelText wrap>{g.name.toUpperCase()}</PixelText>
                    <span className="text-caption text-text-muted">
                      {g.role === 'ADMIN' ? 'Admin' : 'Jogador'}
                    </span>
                  </span>
                  {current && <Badge label="Atual" />}
                  {current && <Icon name="check" size={20} strokeWidth={2.4} />}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {group?.role === 'ADMIN' && (
        <InviteCard key={group.id} groupId={group.id} groupName={group.name} />
      )}

      {logout.isError && (
        <p role="alert" className="text-sm text-[#fca5a5]">
          Não deu para sair agora. Tente de novo.
        </p>
      )}
      <Button
        variant="danger"
        icon="x"
        label="Sair"
        block
        loading={logout.isPending}
        onClick={() => logout.mutate()}
      />
    </>
  );
}

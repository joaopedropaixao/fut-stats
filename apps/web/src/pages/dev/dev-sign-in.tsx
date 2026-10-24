import { useQuery, useQueryClient } from '@tanstack/react-query';
import { devUsersSchema, type DevUser } from '@fut-stats/shared';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { apiGet, apiPostNoContent } from '../../lib/api';
import { cn } from '../../lib/cn';

/**
 * Login de desenvolvimento (só em dev): escolhe uma pessoa do banco local e entra como ela, sem Google.
 * A API só tem `/api/dev/*` com NODE_ENV=development.
 */
export function DevSignInPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [entering, setEntering] = useState<string | null>(null);
  const users = useQuery({
    queryKey: ['dev', 'users'],
    queryFn: ({ signal }) => apiGet('/dev/users', devUsersSchema, { signal }),
  });

  async function enterAs(user: DevUser) {
    setEntering(user.id);
    try {
      await apiPostNoContent(`/dev/login/${user.id}`);
      queryClient.clear();
      await navigate('/');
    } finally {
      setEntering(null);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col gap-6 px-4 pt-10 pb-10">
      <title>Entrar como · Dev · Fut Stats</title>
      <div className="flex flex-col gap-2">
        <PixelText as="h1" size={24}>
          Entrar como
        </PixelText>
        <p className="text-sm text-text-muted">
          Só no ambiente local: escolha alguém do banco e entre sem Google.
        </p>
      </div>
      {users.isError ? (
        <ErrorState
          title="Sem login de desenvolvimento"
          message="A API precisa estar com NODE_ENV=development."
          onRetry={() => void users.refetch()}
          retrying={users.isFetching}
        />
      ) : users.isPending ? (
        <SkeletonList rows={6} label="Carregando as pessoas" />
      ) : (
        <ul className="flex flex-col bg-surface shadow-card">
          {users.data.map((user) => (
            <li
              key={user.id}
              className="shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none"
            >
              <button
                type="button"
                disabled={entering !== null}
                onClick={() => void enterAs(user)}
                className={cn(
                  'flex min-h-16 w-full flex-col items-start gap-1.5 px-4 py-3 text-left active:bg-highlight',
                  entering === user.id && 'bg-highlight',
                )}
              >
                <span className="text-base">{user.name}</span>
                {user.memberships.length === 0 ? (
                  <PixelText className="text-text-muted">Sem grupo</PixelText>
                ) : (
                  user.memberships.map((m) => (
                    <span key={m.groupName} className="flex flex-wrap items-center gap-2">
                      <PixelText className={m.active ? 'text-text' : 'text-text-muted'}>
                        {m.nickname}
                      </PixelText>
                      <Badge
                        label={m.role === 'ADMIN' ? 'Admin' : 'Jogador'}
                        variant={m.role === 'ADMIN' ? 'admin' : 'neutral'}
                      />
                      {!m.active && <Badge label="Inativo" />}
                      <span className="text-sm text-text-muted">{m.groupName}</span>
                    </span>
                  ))
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

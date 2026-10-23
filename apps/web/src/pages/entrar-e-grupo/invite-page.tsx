import { invitePreviewSchema } from '@fut-stats/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Link, useParams } from 'react-router';
import { ButtonLink, Button } from '../../components/ui/button';
import { GoogleMark } from '../../components/ui/google-mark';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { Surface } from '../../components/ui/surface';
import { clearPendingDestination, savePendingDestination } from '../../features/group/invite-code';
import { usePlayerFields } from '../../features/group/player-fields';
import { enterGroupErrorMessage, useJoinGroup } from '../../features/group/use-enter-group';
import { useSession } from '../../features/session/use-session';
import { ApiError, apiGet, LOGIN_URL } from '../../lib/api';

/** Prévia pública do convite; logado escolhe apelido e posição e entra, deslogado entra com Google e volta. */
export function InvitePage() {
  const { code = '' } = useParams();
  const session = useSession();
  // Se a pessoa voltou do login por aqui, o destino guardado já cumpriu o papel
  useEffect(() => {
    if (session.data) clearPendingDestination();
  }, [session.data]);
  const preview = useQuery({
    queryKey: ['invite', code],
    queryFn: ({ signal }) =>
      apiGet(`/invites/${encodeURIComponent(code)}`, invitePreviewSchema, { signal }),
  });

  const notFound = preview.error instanceof ApiError && preview.error.status === 404;

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pt-6 pb-10">
      <title>Convite · Fut Stats</title>
      {preview.isPending && <SkeletonList rows={2} label="Carregando convite" />}
      {notFound && (
        <div className="flex flex-col gap-4">
          <PixelText as="h1" size={24} wrap className="outline-none">
            Convite inválido
          </PixelText>
          <p role="alert" className="text-base text-text-muted">
            Este link não existe ou já foi trocado. Peça um novo ao admin da pelada.
          </p>
          <Link to="/comecar" className="inline-flex h-11 items-center self-start underline">
            <PixelText>Colar outro convite</PixelText>
          </Link>
        </div>
      )}
      {preview.isError && !notFound && (
        <ErrorState
          title="Não deu para abrir o convite"
          message="Parece que a internet caiu ou o servidor está acordando. Tente de novo."
          onRetry={() => void preview.refetch()}
          retrying={preview.isFetching}
        />
      )}
      {preview.data && (
        <>
          <header className="flex flex-col gap-4">
            <PixelText size={16} className="text-text-muted">
              Você foi convidado para
            </PixelText>
            <PixelText as="h1" size={32} wrap className="outline-none">
              {preview.data.groupName}
            </PixelText>
            <Surface className="flex items-center gap-3 self-start px-4 py-3">
              <PixelDigits
                value={preview.data.memberCount}
                scale={3}
                label={`${preview.data.memberCount} jogadores`}
              />
              <PixelText>{preview.data.memberCount === 1 ? 'Jogador' : 'Jogadores'}</PixelText>
            </Surface>
          </header>
          {session.data === undefined && <SkeletonList rows={1} />}
          {session.data === null && (
            <ButtonLink
              href={LOGIN_URL}
              label="Entrar com Google"
              mark={<GoogleMark />}
              block
              onClick={() => savePendingDestination(`/convite/${code}`)}
            />
          )}
          {session.data && <JoinForm code={code} />}
        </>
      )}
    </div>
  );
}

function JoinForm({ code }: { code: string }) {
  const { fields, validate } = usePlayerFields();
  const join = useJoinGroup(code);

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        const player = validate();
        if (player) join.mutate(player);
      }}
    >
      {fields}
      {join.isError && (
        <p role="alert" className="text-sm text-[#fca5a5]">
          {enterGroupErrorMessage(join.error)}
        </p>
      )}
      <Button type="submit" label="Entrar na pelada" block loading={join.isPending} />
    </form>
  );
}

import { invitePreviewSchema } from '@fut-stats/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useParams } from 'react-router';
import { Button, ButtonLink, LinkButton } from '../../components/ui/button';
import { GoogleMark } from '../../components/ui/google-mark';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState } from '../../components/ui/states';
import { clearPendingDestination, savePendingDestination } from '../../features/group/invite-code';
import { usePlayerFields } from '../../features/group/player-fields';
import { enterGroupErrorMessage, useJoinGroup } from '../../features/group/use-enter-group';
import { useSession } from '../../features/session/use-session';
import { ApiError, apiGet, LOGIN_URL } from '../../lib/api';
import { ChalkCorner } from './chalk';

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
  // Sem sessão (ou sem conseguir saber): o caminho é entrar com o Google e voltar para cá
  const signedOut = session.data === null || (session.data === undefined && session.isError);

  return (
    <div className="mx-auto flex w-full max-w-content flex-col gap-6 px-4 pt-6 pb-10">
      <title>Convite · Fut Stats</title>
      {preview.isPending && <InviteSkeleton />}
      {notFound && <InvalidInvite />}
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
          <InviteTicket groupName={preview.data.groupName} memberCount={preview.data.memberCount} />
          {session.data === undefined && !session.isError && <div className="h-14" />}
          {signedOut && (
            <div className="flex flex-col gap-4">
              <p className="text-base text-text-muted">
                Entre com o Google para aceitar. Depois do login você volta direto para cá.
              </p>
              <ButtonLink
                href={LOGIN_URL}
                label="Entrar com Google"
                mark={<GoogleMark />}
                block
                onClick={() => savePendingDestination(`/convite/${code}`)}
              />
            </div>
          )}
          {session.data && <JoinForm code={code} />}
        </>
      )}
    </div>
  );
}

/** O ingresso: nome da pelada grande, quantos já jogam e o meio-campo de giz no canto. */
function InviteTicket({ groupName, memberCount }: { groupName: string; memberCount: number }) {
  return (
    <header className="relative flex flex-col gap-4 overflow-hidden bg-surface-raised p-5 shadow-card">
      <ChalkCorner />
      <PixelText className="relative text-success">Convite</PixelText>
      <PixelText as="h1" size={32} wrap className="relative pr-10 outline-none">
        {groupName}
      </PixelText>
      <p className="relative">
        <span aria-hidden className="flex items-center gap-3">
          <PixelDigits value={memberCount} scale={3} decorative />
          <PixelText>{memberCount === 1 ? 'Jogador' : 'Jogadores'}</PixelText>
        </span>
        <span className="sr-only">{`${memberCount} ${memberCount === 1 ? 'jogador' : 'jogadores'}`}</span>
      </p>
    </header>
  );
}

function InviteSkeleton() {
  return (
    <div
      role="status"
      aria-label="Carregando convite"
      className="flex flex-col gap-4 bg-surface-raised p-5 shadow-card"
    >
      <div className="h-5 w-24 bg-surface-3 shadow-card" />
      <div className="h-9 w-3/4 bg-surface-3 shadow-card" />
      <div className="h-7 w-1/2 bg-surface-3 shadow-card" />
    </div>
  );
}

/** Link trocado ou digitado errado: o campinho vazio da folha e o caminho para colar outro. */
function InvalidInvite() {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-10 text-center shadow-card">
      <svg width="96" height="56" viewBox="0 0 96 56" fill="none" strokeWidth="2" aria-hidden>
        <rect x="2" y="2" width="92" height="52" className="stroke-chalk" />
        <line x1="48" y1="2" x2="48" y2="54" className="stroke-chalk" />
        <circle cx="48" cy="28" r="10" className="stroke-chalk" />
      </svg>
      <PixelText as="h1" size={24} wrap className="justify-center outline-none">
        Convite inválido
      </PixelText>
      <p role="alert" className="max-w-70 text-sm text-text-muted">
        Este link não existe ou já foi trocado. Peça o link novo ao admin da pelada.
      </p>
      <LinkButton to="/comecar" variant="outline" label="Colar outro convite" block />
    </div>
  );
}

function JoinForm({ code }: { code: string }) {
  const { fields, validate } = usePlayerFields();
  const join = useJoinGroup(code);

  return (
    <form
      noValidate
      aria-label="Entrar na pelada"
      className="flex flex-col gap-6"
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

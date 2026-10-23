import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { ButtonLink } from '../components/ui/button';
import { GoogleMark } from '../components/ui/google-mark';
import { PixelText } from '../components/ui/pixel-text';
import {
  clearPendingDestination,
  isInvitePath,
  savePendingDestination,
} from '../features/group/invite-code';
import { useSession } from '../features/session/use-session';
import { LOGIN_URL } from '../lib/api';

/** Entrar no app. Se veio de um convite (`?next=/convite/<código>`), guarda o destino e volta para ele. */
export function SignInPage() {
  const session = useSession();
  const [params] = useSearchParams();
  const next = params.get('next');
  const destination = isInvitePath(next) ? next : null;
  // Voltou para cá sem concluir o login: o destino guardado de antes não vale mais
  useEffect(() => {
    if (session.data === null) clearPendingDestination();
  }, [session.data]);
  if (session.data) return <Navigate to={destination ?? '/'} replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-end gap-8 px-4 pt-6 pb-10">
      <title>Entrar · Fut Stats</title>
      <div className="flex flex-col gap-4">
        <h1 className="flex flex-col">
          <PixelText size={32}>Fut</PixelText>
          <PixelText size={32}>Stats</PixelText>
        </h1>
        <p className="max-w-70 text-base text-text-muted">
          Times equilibrados, notas, ranking e craque da sua pelada.
        </p>
        {destination && (
          <p className="text-sm">Você foi convidado para uma pelada. Entre para continuar.</p>
        )}
      </div>
      <ButtonLink
        href={LOGIN_URL}
        label="Entrar com Google"
        mark={<GoogleMark />}
        block
        onClick={() => destination && savePendingDestination(destination)}
      />
    </main>
  );
}

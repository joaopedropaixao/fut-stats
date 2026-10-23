import { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router';
import { ButtonLink } from '../components/ui/button';
import { GoogleMark } from '../components/ui/google-mark';
import { Icon } from '../components/ui/icons';
import { PixelText } from '../components/ui/pixel-text';
import {
  clearPendingDestination,
  isInvitePath,
  savePendingDestination,
} from '../features/group/invite-code';
import { useSession } from '../features/session/use-session';
import { LOGIN_URL } from '../lib/api';
import { ChalkPitch } from './entrar-e-grupo/chalk';

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
    <main className="relative mx-auto flex min-h-dvh max-w-content flex-col justify-end gap-8 overflow-hidden px-4 pt-6 pb-10">
      <title>Entrar · Fut Stats</title>
      <ChalkPitch />
      <div className="relative flex flex-col gap-4">
        <h1 className="flex flex-col">
          <PixelText size={32}>Fut</PixelText>
          <PixelText size={32}>Stats</PixelText>
        </h1>
        <p className="max-w-80 text-base">
          Todo dia de pelada tem clássico. Branco contra Preto, nota pra todo mundo e um craque por
          rodada.
        </p>
      </div>
      <div className="relative flex flex-col gap-4">
        {destination && (
          <p className="flex gap-3 bg-success/8 p-4 text-sm shadow-[inset_0_0_0_2px_var(--color-success)]">
            <Icon name="check" size={20} strokeWidth={2.4} className="shrink-0 text-success" />
            Você tem um convite. Entre com o Google e a gente te leva direto para ele.
          </p>
        )}
        <ButtonLink
          href={LOGIN_URL}
          label="Entrar com Google"
          mark={<GoogleMark />}
          block
          onClick={() => destination && savePendingDestination(destination)}
        />
      </div>
    </main>
  );
}

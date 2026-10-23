import { Navigate } from 'react-router';
import { ButtonLink } from '../components/ui/button';
import { PixelText } from '../components/ui/pixel-text';
import { useSession } from '../features/session/use-session';
import { LOGIN_URL } from '../lib/api';

/** Placeholder de quem não está logado: a tela de entrar/convite ainda vai ser desenhada. */
export function SignInPage() {
  const session = useSession();
  if (session.data) return <Navigate to="/" replace />;

  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-end gap-8 px-4 pt-6 pb-10">
      <title>Entrar · Fut Stats</title>
      <h1 className="flex flex-col">
        <PixelText size={32}>Fut</PixelText>
        <PixelText size={32}>Stats</PixelText>
      </h1>
      <ButtonLink href={LOGIN_URL} label="Entrar com Google" block />
    </main>
  );
}

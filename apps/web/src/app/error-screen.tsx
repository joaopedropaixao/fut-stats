import { ErrorState } from '../components/ui/states';

/**
 * Tela de erro geral: o app quebrou de um jeito que a tela não resolve sozinha (erro de renderização, falha fora
 * do roteador). Fundo do app, o card de erro em pixel e uma tecla só: recarregar. Não depende de sessão, de
 * query nem de rota, porque pode aparecer quando qualquer uma delas é a causa.
 *
 * `embedded`: dentro da moldura do app (o erro de uma tela, com as abas ainda embaixo): só o card, centrado.
 * Sem `embedded`, ocupa a janela inteira.
 */
export function ErrorScreen({ embedded = false }: { embedded?: boolean }) {
  const card = (
    <ErrorState
      screen
      title="Deu ruim aqui"
      message="Já avisamos quem cuida do app. Tente recarregar."
      retryLabel="Recarregar"
      onRetry={() => window.location.reload()}
    />
  );
  if (embedded) return <div className="my-auto">{card}</div>;
  return (
    <main className="mx-auto flex min-h-dvh max-w-content flex-col justify-center px-4 py-10">
      <title>Deu ruim aqui · Fut Stats</title>
      {card}
    </main>
  );
}

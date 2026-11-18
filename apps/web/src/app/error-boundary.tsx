import { Component, type ReactNode } from 'react';
import { ErrorScreen } from './error-screen';
import { reportError } from './monitoring';

type State = { failed: boolean };

/**
 * Limite de erro no topo da árvore: pega o que quebra fora do roteador (o próprio roteador, o provider, o que
 * cada tela não pegou) e mostra a tela de erro geral. O erro de uma tela cai antes, no `errorElement` do router
 * (`route-error.tsx`). O erro vai para o Sentry quando ele está ligado.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    console.error(error);
    reportError(error, { source: 'boundary' });
  }

  override render() {
    return this.state.failed ? <ErrorScreen /> : this.props.children;
  }
}

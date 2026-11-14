import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useNotice } from '../../components/ui/use-notice';

type FlashState = { flash?: string } | null;

/** Para onde a tela vai depois de salvar: a tela de destino mostra o aviso (a de origem já saiu do ar). */
export function flashState(title: string): { flash: string } {
  return { flash: title };
}

/**
 * O aviso que veio da tela anterior ("Perfil salvo"): aparece uma vez e some do histórico, para não voltar
 * ao recarregar. Devolve o nó do aviso (e o `show` para os avisos da própria tela).
 */
export function useFlashNotice() {
  const notice = useNotice();
  const location = useLocation();
  const navigate = useNavigate();
  const flash = (location.state as FlashState)?.flash;
  const { show } = notice;

  useEffect(() => {
    if (!flash) return;
    show({ kind: 'success', title: flash });
    void navigate(location.pathname, { replace: true, state: null });
  }, [flash, show, navigate, location.pathname]);

  return notice;
}

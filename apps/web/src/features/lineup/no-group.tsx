import { EmptyState } from '../../components/ui/states';

/** Logado, mas ainda fora de qualquer pelada: não há times para mostrar. */
export function NoGroup() {
  return (
    <EmptyState
      title="Você ainda não está numa pelada"
      message="Entre pelo link de convite que o admin mandou. Depois disso, os times aparecem aqui."
    />
  );
}

/** Erros de campo de um formulário, por nome de campo (o mesmo do `data-field` do campo na tela). */
export type FieldErrors = Readonly<Record<string, string | undefined>>;

export type FieldError = { field: string; message: string };

/**
 * O primeiro campo com erro na ordem em que os campos aparecem na tela (de cima para baixo). Erro vazio não
 * conta. É para onde a tela rola, onde o foco vai e o texto do aviso perto do botão.
 */
export function firstFieldError(order: readonly string[], errors: FieldErrors): FieldError | null {
  for (const field of order) {
    const message = errors[field];
    if (message) return { field, message };
  }
  return null;
}

/** O que o aviso perto do botão mostra: o texto do primeiro erro, só depois de uma tentativa de enviar. */
export function submitNotice(
  order: readonly string[],
  errors: FieldErrors,
  attempted: boolean,
): string | undefined {
  return attempted ? firstFieldError(order, errors)?.message : undefined;
}

/** Erros da validação do formulário de edição: o do apelido, ou o primeiro que vier, vão para o campo do apelido. */
export function nicknameErrorFromIssues(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): string | undefined {
  return (issues.find((issue) => issue.path[0] === 'nickname') ?? issues[0])?.message;
}

type Revealable = {
  scrollIntoView: (options: ScrollIntoViewOptions) => void;
  focus: (options?: FocusOptions) => void;
  querySelector: (selectors: string) => Revealable | null;
  matches: (selectors: string) => boolean;
};

const FOCUSABLE = 'input, textarea, select, button, [tabindex]';

/**
 * Rola até o campo (centralizado; sem animação com "reduzir movimento") e põe o foco nele. O campo é achado pelo
 * `data-field`; num grupo (lista de opções) o foco vai para a opção marcada, ou para a primeira. Devolve
 * `false` se o campo não está na tela.
 */
export function revealField(
  root: Pick<Revealable, 'querySelector'> | null,
  field: string,
  reducedMotion: boolean,
): boolean {
  const target = root?.querySelector(`[data-field="${field}"]`);
  if (!target) return false;
  target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
  const focusable = target.matches(FOCUSABLE)
    ? target
    : (target.querySelector(':checked') ?? target.querySelector(FOCUSABLE));
  // O scroll já foi pedido acima; o foco não pode brigar com ele
  focusable?.focus({ preventScroll: true });
  return true;
}

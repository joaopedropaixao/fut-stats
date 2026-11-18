import { useCallback, useEffect, useRef, useState } from 'react';
import { firstFieldError, revealField, submitNotice, type FieldErrors } from './field-errors';

/**
 * A peça única do erro de campo, para Editar perfil, Editar jogador, /comecar e /convite: quando o envio falha
 * (validação do formulário ou erro de campo da API), rola até o primeiro campo com erro, põe o foco nele e dá o
 * texto do aviso que fica logo acima do botão (`FieldErrorNotice`).
 *
 * - `order`: os nomes dos campos na ordem da tela (o `data-field` de cada um);
 * - `errors`: o erro de cada campo (o que a tela já mostra no próprio campo);
 * - `apiFieldError`: o erro da API que é de campo (ex.: 409 `NICKNAME_TAKEN`), ou `null`. Cada falha nova da API
 *   (objeto novo) rola de novo; apagar o erro ao digitar não rola.
 *
 * Use `formRef` no `<form>` e chame `failed()` quando a validação recusar o envio.
 */
export function useRevealFieldError(
  order: readonly string[],
  errors: FieldErrors,
  apiFieldError: unknown,
) {
  const formRef = useRef<HTMLFormElement>(null);
  const [attempts, setAttempts] = useState(0);
  const first = firstFieldError(order, errors);
  const latest = useRef(first);
  useEffect(() => {
    latest.current = first;
  });

  const reveal = useCallback(() => {
    const target = latest.current;
    if (!target) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    revealField(formRef.current, target.field, reduced);
  }, []);

  // Validação recusou o envio: o erro já está no estado quando este efeito roda
  useEffect(() => {
    if (attempts > 0) reveal();
  }, [attempts, reveal]);
  // A API recusou um campo
  useEffect(() => {
    if (apiFieldError) reveal();
  }, [apiFieldError, reveal]);

  return {
    formRef,
    failed: () => setAttempts((n) => n + 1),
    notice: submitNotice(order, errors, attempts > 0 || Boolean(apiFieldError)),
  };
}

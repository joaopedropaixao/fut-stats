/** O que vem depois de `/resenhas/`: `nova` ou `<id>/editar`. Qualquer outra coisa volta para o Feed. */
export function postScreen(
  rest: string | undefined,
): { screen: 'new' } | { screen: 'edit'; postId: string } | null {
  if (rest === 'nova') return { screen: 'new' };
  const edit = /^([^/]+)\/editar$/.exec(rest ?? '');
  return edit?.[1] ? { screen: 'edit', postId: edit[1] } : null;
}

import {
  commentSchema,
  feedAlertSchema,
  POSTS_PAGE_DEFAULT,
  postListSchema,
  postSchema,
  type Comment,
  type CommentInput,
  type Post,
  type PostInput,
  type PostList,
  type PostReaction,
} from '@fut-stats/shared';
import {
  mutationOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import {
  ApiError,
  apiDelete,
  apiDeleteJson,
  apiGet,
  apiPatch,
  apiPost,
  apiPut,
} from '../../lib/api';
import { alertsKey } from '../rounds/queries';

const feedPath = (groupId: string) => `/groups/${groupId}`;

/** Os avisos (calculados pela API a partir das rodadas). A chave fica sob a da lista de rodadas. */
export function useAlerts(groupId: string) {
  return useQuery({
    queryKey: alertsKey(groupId),
    queryFn: ({ signal }) =>
      apiGet(`${feedPath(groupId)}/feed/alerts`, feedAlertSchema.array(), { signal }),
  });
}

export const postsKey = (groupId: string) => ['posts', groupId] as const;
const commentsKey = (groupId: string, postId: string) =>
  [...postsKey(groupId), postId, 'comments'] as const;

const onePostKey = (groupId: string, postId: string) =>
  [...postsKey(groupId), postId, 'one'] as const;

type PostPages = InfiniteData<PostList, string | null>;

/** As resenhas, da mais nova para a mais antiga, em páginas com cursor ("Carregar mais"). */
export function usePosts(groupId: string) {
  return useInfiniteQuery({
    queryKey: postsKey(groupId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams({ limit: String(POSTS_PAGE_DEFAULT) });
      if (pageParam) query.set('cursor', pageParam);
      return apiGet(`${feedPath(groupId)}/posts?${query}`, postListSchema, { signal });
    },
    getNextPageParam: (last) => last.nextCursor,
  });
}

/** Troca uma resenha em todas as páginas já carregadas (`null` do `change` tira a resenha da lista). */
function patchPost(
  queryClient: QueryClient,
  groupId: string,
  postId: string,
  change: (post: Post) => Post | null,
) {
  queryClient.setQueryData<PostPages>(postsKey(groupId), (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.flatMap((post) => {
              if (post.id !== postId) return [post];
              const next = change(post);
              return next ? [next] : [];
            }),
          })),
        }
      : data,
  );
}

/** Uma resenha achada no cache das páginas, para desfazer a previsão. */
function findPost(queryClient: QueryClient, groupId: string, postId: string): Post | undefined {
  return queryClient
    .getQueryData<PostPages>(postsKey(groupId))
    ?.pages.flatMap((page) => page.items)
    .find((post) => post.id === postId);
}

/** Publicar refaz a lista (a nova entra no topo); a página volta para a primeira. */
export function useCreatePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) => apiPost(`${feedPath(groupId)}/posts`, postSchema, input),
    onSuccess: () => queryClient.resetQueries({ queryKey: postsKey(groupId), exact: true }),
  });
}

export function useUpdatePost(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PostInput) =>
      apiPatch(`${feedPath(groupId)}/posts/${postId}`, postSchema, input),
    onSuccess: (post) => {
      patchPost(queryClient, groupId, postId, () => post);
      // A próxima edição abre com o texto salvo, não com o de antes
      queryClient.setQueryData(onePostKey(groupId, postId), post);
    },
  });
}

export function useDeletePost(groupId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => apiDelete(`${feedPath(groupId)}/posts/${postId}`),
    onSuccess: (_void, postId) => {
      patchPost(queryClient, groupId, postId, () => null);
      queryClient.removeQueries({ queryKey: [...postsKey(groupId), postId] });
    },
  });
}

/** O que a reação muda nos contadores: sai a minha anterior, entra a nova (`null` só tira). */
export function reactTo(post: Post, reaction: PostReaction | null): Post {
  if (post.myReaction === reaction) return post;
  const reactions = { ...post.reactions } as Post['reactions'];
  if (post.myReaction)
    reactions[post.myReaction] = Math.max(0, (reactions[post.myReaction] ?? 0) - 1);
  if (reaction) reactions[reaction] = (reactions[reaction] ?? 0) + 1;
  return { ...post, reactions, myReaction: reaction };
}

/**
 * Reagir ou tirar a reação de uma resenha com atualização otimista: o contador muda na hora. As chamadas da mesma
 * resenha vão em fila (`scope`), para a resposta de um toque antigo nunca chegar depois da de um novo. Só a última
 * da fila mexe no cache: a resposta dela (a resenha inteira) substitui a previsão; se ela falhar, volta ao que
 * estava antes dela. No fim da fila, a lista é conferida de novo com a API.
 */
export function useReact(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation(reactOptions(queryClient, groupId, postId));
}

/** As opções da mutação de `useReact`, separadas para o teste da fila rodar sem React. */
export function reactOptions(queryClient: QueryClient, groupId: string, postId: string) {
  const mutationKey = ['post-reaction', groupId, postId];
  /** Esta é a única da fila ainda pendente (as que esperam na fila também contam como pendentes). */
  const last = () => queryClient.isMutating({ mutationKey, exact: true }) === 1;
  return mutationOptions({
    mutationKey,
    scope: { id: mutationKey.join(':') },
    mutationFn: (reaction: PostReaction | null): Promise<Post> =>
      reaction
        ? apiPut(`${feedPath(groupId)}/posts/${postId}/reaction`, postSchema, { reaction })
        : apiDeleteJson(`${feedPath(groupId)}/posts/${postId}/reaction`, postSchema),
    onMutate: async (reaction) => {
      await queryClient.cancelQueries({ queryKey: postsKey(groupId), exact: true });
      const previous = findPost(queryClient, groupId, postId);
      patchPost(queryClient, groupId, postId, (post) => reactTo(post, reaction));
      return { previous };
    },
    onError: (_err, _reaction, context) => {
      const previous = context?.previous;
      if (previous && last()) patchPost(queryClient, groupId, postId, () => previous);
    },
    onSuccess: (post) => {
      if (last()) patchPost(queryClient, groupId, postId, () => post);
    },
    onSettled: () => {
      if (last()) void queryClient.invalidateQueries({ queryKey: postsKey(groupId), exact: true });
    },
  });
}

/** Os comentários de uma resenha, carregados na primeira vez que ela abre. */
export function useComments(groupId: string, postId: string, enabled: boolean) {
  return useQuery({
    queryKey: commentsKey(groupId, postId),
    queryFn: ({ signal }) =>
      apiGet(`${feedPath(groupId)}/posts/${postId}/comments`, commentSchema.array(), { signal }),
    enabled,
  });
}

/** Mexe no número de comentários que o card mostra. */
function bumpCount(queryClient: QueryClient, groupId: string, postId: string, by: 1 | -1) {
  patchPost(queryClient, groupId, postId, (post) => ({
    ...post,
    commentCount: Math.max(0, post.commentCount + by),
  }));
}

export function useAddComment(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CommentInput) =>
      apiPost(`${feedPath(groupId)}/posts/${postId}/comments`, commentSchema, input),
    onSuccess: (comment) => {
      queryClient.setQueryData<Comment[]>(commentsKey(groupId, postId), (list) => [
        ...(list ?? []),
        comment,
      ]);
      bumpCount(queryClient, groupId, postId, 1);
    },
  });
}

export function useDeleteComment(groupId: string, postId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      apiDelete(`${feedPath(groupId)}/posts/${postId}/comments/${commentId}`),
    onSuccess: (_void, commentId) => {
      queryClient.setQueryData<Comment[]>(commentsKey(groupId, postId), (list) =>
        list?.filter((c) => c.id !== commentId),
      );
      bumpCount(queryClient, groupId, postId, -1);
    },
  });
}

/**
 * Uma resenha só, para a tela de editar: `GET /posts/:postId`. A que já está no cache da lista entra como dado
 * inicial (a tela abre na hora e a API confere). Resenha que não existe (404) vira `null`.
 */
export function usePost(groupId: string, postId: string | undefined) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: onePostKey(groupId, postId ?? ''),
    queryFn: async ({ signal }): Promise<Post | null> => {
      try {
        return await apiGet(`${feedPath(groupId)}/posts/${postId}`, postSchema, { signal });
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }
    },
    initialData: () => (postId ? findPost(queryClient, groupId, postId) : undefined),
    enabled: postId !== undefined,
  });
}

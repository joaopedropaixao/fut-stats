import {
  POST_BODY_MAX_LENGTH,
  POST_TITLE_MAX_LENGTH,
  postInputSchema,
  type Post,
} from '@fut-stats/shared';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useBlocker, useNavigate } from 'react-router';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { TextArea } from '../../components/ui/text-area';
import { TextField } from '../../components/ui/text-field';
import { useNotice } from '../../components/ui/use-notice';
import { useCreatePost, usePost, useUpdatePost } from '../../features/feed/queries';
import { countCharacters } from '../../features/feed/text-count';
import { flashState } from '../../features/group/flash';
import { useCurrentGroup } from '../../features/group/use-current-group';
import { RouteButton } from '../../features/rounds/route-button';
import { apiErrorMessage } from '../../lib/api';

/** /resenhas/nova: só o admin escreve; quem não é admin volta para o Feed (a API também confere). */
export function NewPostPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  if (group.role !== 'ADMIN') return <Navigate to="/" replace />;
  return <PostForm groupId={group.id} />;
}

/** /resenhas/:postId/editar: qualquer admin edita qualquer resenha. */
export function EditPostPage({ postId }: { postId: string }) {
  const { group } = useCurrentGroup();
  const post = usePost(group?.id ?? '', group ? postId : undefined);
  if (!group) return null;
  if (group.role !== 'ADMIN') return <Navigate to="/" replace />;

  if (post.isError)
    return (
      <>
        <Back />
        <ErrorState
          title="Não deu para abrir a resenha"
          message="Confira a internet e tente de novo."
          onRetry={() => void post.refetch()}
          retrying={post.isFetching}
        />
      </>
    );
  if (post.data === undefined)
    return (
      <>
        <Back />
        <SkeletonList rows={3} label="Carregando a resenha" />
      </>
    );
  if (post.data === null)
    return (
      <>
        <Back />
        <ErrorState title="Resenha não encontrada" message="Ela pode ter sido apagada." />
      </>
    );
  return <PostForm groupId={group.id} post={post.data} />;
}

function Back({ onClick }: { onClick?: () => void }) {
  if (onClick)
    return (
      <Button
        label="Voltar"
        icon="chevronLeft"
        variant="outline"
        size={44}
        className="self-start"
        onClick={onClick}
      />
    );
  return (
    <RouteButton
      to="/"
      label="Voltar"
      icon="chevronLeft"
      variant="outline"
      size={44}
      className="self-start"
    />
  );
}

/** Erro de cada campo, pelo `path` de cada problema do schema do shared. */
type FieldErrors = { title?: string; body?: string };

function PostForm({ groupId, post }: { groupId: string; post?: Post }) {
  const navigate = useNavigate();
  const notice = useNotice();
  const [title, setTitle] = useState(post?.title ?? '');
  const [body, setBody] = useState(post?.body ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});

  const create = useCreatePost(groupId);
  const update = useUpdatePost(groupId, post?.id ?? '');
  const saving = create.isPending || update.isPending;

  // Escreveu algo e não salvou: sair (voltar, abas, gesto do sistema) pede confirmação
  const dirty = title !== (post?.title ?? '') || body !== (post?.body ?? '');
  const [saved, setSaved] = useState(false);
  const blocker = useBlocker(dirty && !saved);

  // Salvou: só navega depois que o bloqueio já soube (o estado vale antes da navegação)
  useEffect(() => {
    if (!saved) return;
    void navigate('/', {
      replace: true,
      state: flashState(post ? 'Resenha salva' : 'Resenha publicada'),
    });
  }, [saved, navigate, post]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsed = postInputSchema.safeParse({ title, body });
    if (!parsed.success) {
      const found: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] === 'title' ? 'title' : 'body';
        found[field] ??= issue.message;
      }
      setErrors(found);
      return;
    }
    setErrors({});
    const done = () => setSaved(true);
    const fail = (err: unknown) =>
      notice.show({
        kind: 'error',
        title: 'Não deu para salvar',
        message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
      });
    if (post) update.mutate(parsed.data, { onSuccess: done, onError: fail });
    else create.mutate(parsed.data, { onSuccess: done, onError: fail });
  };

  const leave = () => void navigate('/');
  const titleCount = countCharacters(title.trim());
  const bodyCount = countCharacters(body.trim());

  return (
    <>
      <title>{`${post ? 'Editar resenha' : 'Nova resenha'} · Fut Stats`}</title>
      <Back onClick={leave} />
      <PixelText as="h1" size={24} wrap className="outline-none">
        {post ? 'Editar resenha' : 'Nova resenha'}
      </PixelText>
      <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
        <TextField
          label="Título"
          value={title}
          placeholder="Que jogão"
          hint="Opcional."
          error={errors.title}
          counter={{ current: titleCount, max: POST_TITLE_MAX_LENGTH }}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((prev) => ({ ...prev, title: undefined }));
          }}
        />
        <TextArea
          label="Texto"
          rows={8}
          value={body}
          placeholder="Conte como foi a pelada"
          error={errors.body}
          counter={{ current: bodyCount, max: POST_BODY_MAX_LENGTH }}
          onChange={(e) => {
            setBody(e.target.value);
            setErrors((prev) => ({ ...prev, body: undefined }));
          }}
        />
        <Button
          type="submit"
          label={post ? 'Salvar' : 'Publicar'}
          icon="check"
          loading={saving}
          block
        />
      </form>
      {blocker.state === 'blocked' && (
        <Sheet
          title={post ? 'Sair sem salvar?' : 'Sair sem publicar?'}
          onClose={() => blocker.reset()}
          actions={(close) => (
            <>
              <Button label="Voltar" variant="outline" className="flex-1" onClick={close} />
              <Button
                label="Sair"
                icon="x"
                variant="danger"
                className="flex-1"
                onClick={() => blocker.proceed()}
              />
            </>
          )}
        >
          O que você escreveu vai ser perdido.
        </Sheet>
      )}
      {notice.node}
    </>
  );
}

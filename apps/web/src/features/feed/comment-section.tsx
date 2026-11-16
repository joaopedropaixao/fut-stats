import { commentInputSchema, NOT_OWN_COMMENT_LABEL, type Comment } from '@fut-stats/shared';
import { useState, type FormEvent } from 'react';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { ErrorState } from '../../components/ui/states';
import { TextArea } from '../../components/ui/text-area';
import type { NoticeData } from '../../components/ui/notice';
import { ApiError, apiErrorMessage } from '../../lib/api';
import { MemberAvatar } from '../rounds/member-avatar';
import { postWhen } from './post-when';
import { useAddComment, useComments, useDeleteComment } from './queries';
import { countCharacters } from './text-count';
import { COMMENT_MAX } from './text-limits';

type CommentSectionProps = {
  groupId: string;
  postId: string;
  notify: (notice: NoticeData) => void;
};

/**
 * Os comentários de uma resenha, abertos no próprio card (sem gaveta): a lista em ordem de envio, o campo
 * "Escreva um comentário" com contador e "Enviar". Carrega na primeira abertura.
 */
export function CommentSection({ groupId, postId, notify }: CommentSectionProps) {
  const comments = useComments(groupId, postId, true);
  return (
    <div className="flex flex-col gap-3 p-3 shadow-[inset_0_2px_0_0_var(--color-border)]">
      {comments.isError ? (
        <ErrorState
          title="Não deu para abrir os comentários"
          message="Confira a internet e tente de novo."
          onRetry={() => void comments.refetch()}
          retrying={comments.isFetching}
        />
      ) : !comments.data ? (
        <p role="status" className="px-1 text-sm text-text-muted">
          Carregando os comentários...
        </p>
      ) : comments.data.length === 0 ? (
        <p className="px-1 text-sm text-text-muted">Nenhum comentário ainda. Comece a conversa.</p>
      ) : (
        <ul className="flex flex-col">
          {comments.data.map((comment) => (
            <CommentRow
              key={comment.id}
              groupId={groupId}
              postId={postId}
              comment={comment}
              notify={notify}
            />
          ))}
        </ul>
      )}
      <CommentForm groupId={groupId} postId={postId} notify={notify} />
    </div>
  );
}

function CommentRow({
  groupId,
  postId,
  comment,
  notify,
}: { comment: Comment } & CommentSectionProps) {
  const [confirm, setConfirm] = useState(false);
  const remove = useDeleteComment(groupId, postId);

  const apagar = () => {
    setConfirm(false);
    remove.mutate(comment.id, {
      onSuccess: () => notify({ kind: 'success', title: 'Comentário apagado' }),
      onError: (err) =>
        notify({
          kind: 'error',
          title: 'Não deu para apagar',
          message:
            err instanceof ApiError && err.body?.code === 'NOT_OWN_COMMENT'
              ? NOT_OWN_COMMENT_LABEL
              : apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        }),
    });
  };

  return (
    <li className="animate-row-in flex items-start gap-3 py-2 shadow-[inset_0_2px_0_0_var(--color-border)] first:shadow-none">
      <MemberAvatar nickname={comment.author.nickname} avatar={comment.author.avatar} size={32} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-col gap-1">
          <PixelText wrap>{comment.author.nickname}</PixelText>
          <PixelText className="text-text-muted">{postWhen(comment.createdAt)}</PixelText>
        </span>
        <p className="text-base whitespace-pre-wrap [overflow-wrap:anywhere]">{comment.text}</p>
      </div>
      {comment.canDelete && (
        <button
          type="button"
          aria-label={`Apagar o comentário de ${comment.author.nickname}`}
          onClick={() => setConfirm(true)}
          className="inline-flex size-11 shrink-0 items-center justify-center text-text-muted active:bg-highlight"
        >
          <Icon name="trash" size={20} />
        </button>
      )}
      {confirm && (
        <Sheet
          title="Apagar comentário?"
          onClose={() => setConfirm(false)}
          actions={(close) => (
            <>
              <Button label="Voltar" variant="outline" className="flex-1" onClick={close} />
              <Button
                label="Apagar"
                icon="trash"
                variant="danger"
                className="flex-1"
                onClick={apagar}
              />
            </>
          )}
        >
          O comentário some para todo mundo. Isso não dá para desfazer.
        </Sheet>
      )}
    </li>
  );
}

function CommentForm({ groupId, postId, notify }: CommentSectionProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const add = useAddComment(groupId, postId);
  const count = countCharacters(text.trim());

  const change = (value: string) => {
    setText(value);
    // Passou do limite: o erro aparece na hora; o resto só ao enviar
    setError(countCharacters(value.trim()) > COMMENT_MAX ? firstError(value) : undefined);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (add.isPending) return;
    const parsed = commentInputSchema.safeParse({ text });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message);
      return;
    }
    add.mutate(parsed.data, {
      onSuccess: () => {
        setText('');
        setError(undefined);
      },
      onError: (err) =>
        notify({
          kind: 'error',
          title: 'Não deu para comentar',
          message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        }),
    });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <TextArea
        label="Escreva um comentário"
        hideLabel
        placeholder="Escreva um comentário"
        rows={3}
        value={text}
        error={error}
        counter={{ current: count, max: COMMENT_MAX }}
        onChange={(e) => change(e.target.value)}
      />
      <Button
        type="submit"
        label="Enviar"
        icon="chevronRight"
        variant="outline"
        size={48}
        loading={add.isPending}
        block
      />
    </form>
  );
}

function firstError(text: string): string | undefined {
  const parsed = commentInputSchema.safeParse({ text });
  return parsed.success ? undefined : parsed.error.issues[0]?.message;
}

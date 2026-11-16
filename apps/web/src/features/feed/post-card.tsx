import type { Post } from '@fut-stats/shared';
import { useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import type { NoticeData } from '../../components/ui/notice';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { MenuItem, RowMenu } from '../../components/ui/row-menu';
import { Sheet } from '../../components/ui/sheet';
import { apiErrorMessage } from '../../lib/api';
import { MemberAvatar } from '../rounds/member-avatar';
import { CommentSection } from './comment-section';
import { postWhen } from './post-when';
import { whatsappUrl } from './post-share';
import { useDeletePost, useReact } from './queries';
import { ReactionBar } from './reaction-bar';

type PostCardProps = {
  groupId: string;
  post: Post;
  /** Posição na lista: só os 3 primeiros entram em degraus, escalonados. */
  index: number;
  notify: (notice: NoticeData) => void;
};

/**
 * Uma resenha: grande momento (contorno de 3px, sombra dura, entrada em degraus nos 3 primeiros) com o autor
 * (rosto, apelido, selo ADMIN, quando), o título em pixel, o texto corrido com as quebras de linha, as 5 reações
 * e os comentários, que abrem no card. O "⋯" (editar, compartilhar, apagar) só vem para o admin (`canManage`).
 */
export function PostCard({ groupId, post, index, notify }: PostCardProps) {
  const [open, setOpen] = useState(false);
  const react = useReact(groupId);
  const entering = index < 3;

  return (
    <article
      aria-label={post.title ?? `Resenha de ${post.author.nickname}`}
      className={`moment-frame flex flex-col bg-surface-raised ${entering ? 'animate-moment-in' : ''}`}
      style={
        {
          boxShadow: '5px 5px 0 var(--color-shadow)',
          '--moment-delay': `${index * 100}ms`,
        } as CSSProperties
      }
    >
      <header className="flex items-start gap-3 p-4 shadow-[inset_0_-2px_0_0_var(--color-border)]">
        <MemberAvatar nickname={post.author.nickname} avatar={post.author.avatar} size={40} />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PixelText wrap className="[overflow-wrap:anywhere]">
              {post.author.nickname}
            </PixelText>
            {post.author.role === 'ADMIN' && <Badge label="Admin" variant="admin" />}
          </span>
          <span className="flex flex-wrap items-center gap-x-2">
            <PixelText className="text-text-muted">{postWhen(post.createdAt)}</PixelText>
            {post.editedAt && <span className="text-caption text-text-muted">editada</span>}
          </span>
        </div>
        {post.canManage && <PostMenu groupId={groupId} post={post} notify={notify} />}
      </header>

      <div className="flex flex-col gap-3 p-4">
        {post.title && (
          <PixelText
            as="h3"
            size={24}
            wrap
            className="text-text [overflow-wrap:anywhere] [text-shadow:2px_2px_0_#000]"
          >
            {post.title}
          </PixelText>
        )}
        <p className="text-base whitespace-pre-wrap [overflow-wrap:anywhere]">{post.body}</p>
      </div>

      <div className="px-3 pb-3">
        <ReactionBar
          post={post}
          onReact={(reaction) =>
            react.mutate(
              { postId: post.id, reaction },
              {
                onError: (err) =>
                  notify({
                    kind: 'error',
                    title: 'Não deu para reagir',
                    message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
                  }),
              },
            )
          }
        />
      </div>

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 shadow-[inset_0_2px_0_0_var(--color-border)] active:bg-highlight"
      >
        <span className="flex flex-wrap items-center gap-x-2">
          <PixelText>Comentários ·</PixelText>
          <PixelDigits
            value={post.commentCount}
            scale={2}
            label={`${post.commentCount} ${post.commentCount === 1 ? 'comentário' : 'comentários'}`}
          />
        </span>
        <Icon name="chevronRight" size={20} className={open ? 'rotate-90' : undefined} />
      </button>
      {open && <CommentSection groupId={groupId} postId={post.id} notify={notify} />}
    </article>
  );
}

function PostMenu({
  groupId,
  post,
  notify,
}: {
  groupId: string;
  post: Post;
  notify: (notice: NoticeData) => void;
}) {
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const remove = useDeletePost(groupId);

  const share = () =>
    window.open(whatsappUrl(post, `${window.location.origin}/`), '_blank', 'noopener,noreferrer');

  const apagar = () => {
    setConfirm(false);
    remove.mutate(post.id, {
      onSuccess: () => notify({ kind: 'success', title: 'Resenha apagada' }),
      onError: (err) =>
        notify({
          kind: 'error',
          title: 'Não deu para apagar',
          message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        }),
    });
  };

  return (
    <>
      <RowMenu label={`Mais opções da resenha de ${post.author.nickname}`}>
        {(close) => (
          <>
            <MenuItem
              icon="pencil"
              label="Editar"
              onClick={() => {
                close();
                void navigate(`/resenhas/${post.id}/editar`);
              }}
            />
            <MenuItem
              icon="share"
              label="Compartilhar no WhatsApp"
              onClick={() => {
                close();
                share();
              }}
            />
            <MenuItem
              icon="trash"
              label="Apagar"
              className="text-[#fca5a5]"
              onClick={() => {
                close();
                setConfirm(true);
              }}
            />
          </>
        )}
      </RowMenu>
      {confirm && (
        <Sheet
          title="Apagar a resenha?"
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
          Reações e comentários vão junto. Isso não dá para desfazer.
        </Sheet>
      )}
    </>
  );
}

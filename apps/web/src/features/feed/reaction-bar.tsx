import {
  POST_REACTION_LABELS,
  POST_REACTIONS,
  type Post,
  type PostReaction,
} from '@fut-stats/shared';
import { Bump } from '../../components/ui/bump';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { cn } from '../../lib/cn';
import { reactionAriaLabel } from './reaction-label';
import { ReactionIcon } from './reaction-icon';

/**
 * As 5 reações de uma resenha: só o ícone pixel e o contador de cada uma, em 5 colunas (≥ 44 px em 320 px). Sem nome
 * visível: o nome inteiro vai no `title` e no nome acessível ("Bagre, 3 reações, a sua").
 * A minha fica com contorno grosso e ✓ (ao lado do contador, nunca sobre o ícone); tocar em outra troca, tocar na mesma tira. O contador "bate" quando muda.
 */
export function ReactionBar({
  post,
  onReact,
}: {
  post: Post;
  /** `null` tira a minha reação. */
  onReact: (reaction: PostReaction | null) => void;
}) {
  return (
    <div role="group" aria-label="Reações" className="grid grid-cols-5 gap-1">
      {POST_REACTIONS.map((reaction) => {
        const count = post.reactions[reaction] ?? 0;
        const mine = post.myReaction === reaction;
        return (
          <button
            key={reaction}
            type="button"
            aria-pressed={mine}
            aria-label={reactionAriaLabel(reaction, count, mine)}
            title={POST_REACTION_LABELS[reaction]}
            onClick={() => onReact(mine ? null : reaction)}
            className={cn(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1.5 bg-surface py-2 active:translate-x-0.5 active:translate-y-0.5',
              mine
                ? 'text-text shadow-[inset_0_0_0_3px_var(--color-text)]'
                : 'text-text-muted shadow-card',
            )}
          >
            <ReactionIcon reaction={reaction} />
            {/* O ✓ da minha reação fica ao lado do contador, em linha: nunca por cima do ícone (o OSS! é largo) */}
            <span className="flex max-w-full flex-wrap items-center justify-center gap-1">
              <Bump value={count} scale={1.5}>
                <PixelDigits value={count} scale={2} decorative />
              </Bump>
              {mine && (
                <span
                  aria-hidden
                  data-mine-check
                  className="inline-flex size-4 shrink-0 items-center justify-center bg-text text-bg"
                >
                  <Icon name="check" size={12} strokeWidth={4} />
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

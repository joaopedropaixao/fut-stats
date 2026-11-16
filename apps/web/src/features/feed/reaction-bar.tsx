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
import { reactionAriaLabel, reactionShortName } from './reaction-label';
import { ReactionIcon } from './reaction-icon';

/**
 * As 5 reações de uma resenha: ícone pixel, nome curto e contador de cada uma, em 5 colunas (≥ 44 px em 320 px). O
 * nome fica sempre visível embaixo do ícone (o desenho sozinho não basta para todas) e também vai no `title`.
 * A minha fica com contorno grosso e ✓; tocar em outra troca, tocar na mesma tira. O contador "bate" quando muda.
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
              'relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 bg-surface py-1.5 active:translate-x-0.5 active:translate-y-0.5',
              mine
                ? 'text-text shadow-[inset_0_0_0_3px_var(--color-text)]'
                : 'text-text-muted shadow-card',
            )}
          >
            <ReactionIcon reaction={reaction} />
            <span
              aria-hidden
              className="max-w-full text-caption leading-none font-medium tracking-tight"
            >
              {reactionShortName(reaction)}
            </span>
            <Bump value={count} scale={1.5}>
              <PixelDigits value={count} scale={2} decorative />
            </Bump>
            {mine && (
              <span
                aria-hidden
                className="absolute top-0.5 right-0.5 inline-flex size-4 items-center justify-center bg-text text-bg"
              >
                <Icon name="check" size={12} strokeWidth={4} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

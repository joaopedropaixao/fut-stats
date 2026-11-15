import { MATCH_EVENT_TYPE_LABELS, type MatchEventItem, type ResultPlayer } from '@fut-stats/shared';
import type { CSSProperties, ReactNode } from 'react';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { formatRating } from '../../lib/rating-format';
import { craqueMoves } from './craque-moves';

const delay = (ms: number) => ({ '--moment-delay': `${ms}ms` }) as CSSProperties;

/**
 * A frase de impacto (ou a piada do Perna de Pau) embaixo da carta: faixa escura com contorno grosso e sombra dura,
 * letras claras. A carta continua o foco; a frase só a assina.
 */
export function PhraseBanner({
  phrase,
  tone = 'craque',
  className,
}: {
  phrase: string;
  tone?: 'craque' | 'flop';
  className?: string;
}) {
  return (
    <p
      style={{ borderColor: tone === 'flop' ? 'var(--color-flop)' : 'var(--color-gold)' }}
      className={cn(
        'animate-moment-in border-[3px] bg-team-black px-3 py-2 text-center text-text shadow-[4px_4px_0_0_#000]',
        className,
      )}
    >
      <PixelText wrap className="text-center">
        {phrase}
      </PixelText>
    </p>
  );
}

function Tile({
  label,
  children,
  step,
  gold,
}: {
  label: string;
  children: ReactNode;
  step: number;
  gold?: boolean;
}) {
  return (
    <div
      style={delay(120 + step * 70)}
      className="animate-moment-in flex min-w-0 flex-col gap-1 border-[3px] border-border-strong bg-surface px-3 py-1.5 shadow-[3px_3px_0_0_#000]"
    >
      <PixelText className="text-text-muted">{label}</PixelText>
      <span className={cn('flex items-center', gold && 'text-gold')}>{children}</span>
    </div>
  );
}

/**
 * O painel de números do Craque: nota, gols, assistências e posição na rodada. Gol contra não conta. Votos de
 * Craque recebidos não entram (a votação é anônima, só a média aparece).
 */
export function CraqueNumbers({ player, className }: { player: ResultPlayer; className?: string }) {
  const rating = player.score !== null ? formatRating(player.score) : null;
  return (
    <section
      aria-label={`Números de ${player.nickname}`}
      className={cn('grid w-full max-w-sm grid-cols-2 gap-2.5', className)}
    >
      <Tile label="Nota" step={0} gold>
        {rating !== null ? (
          <PixelDigits value={rating} scale={3} label={`Nota ${rating}`} />
        ) : (
          <PixelText size={24}>-</PixelText>
        )}
      </Tile>
      <Tile label="Posição" step={1}>
        {player.rank !== null ? (
          <PixelText size={24}>{`#${player.rank}`}</PixelText>
        ) : (
          <PixelText size={24}>-</PixelText>
        )}
      </Tile>
      <Tile label="Gols" step={2}>
        <PixelDigits value={player.goals} scale={3} label={`${player.goals} gols`} />
      </Tile>
      <Tile label="Assist." step={3}>
        <PixelDigits value={player.assists} scale={3} label={`${player.assists} assistências`} />
      </Tile>
    </section>
  );
}

/** "Lances de Felipinho": cada gol e assistência dele na partida, na ordem. Sem nenhum, diz isso. */
export function CraqueMoves({
  events,
  player,
  className,
}: {
  events: readonly MatchEventItem[];
  player: ResultPlayer;
  className?: string;
}) {
  const moves = craqueMoves(events, player.membershipId);
  return (
    <section
      aria-label={`Lances de ${player.nickname}`}
      className={cn('flex w-full max-w-sm flex-col gap-2', className)}
    >
      <PixelText className="text-text-muted">Lances na partida</PixelText>
      {moves.length === 0 ? (
        <p className="border-[3px] border-border-strong bg-surface px-3 py-3 text-sm text-text-muted shadow-[3px_3px_0_0_#000]">
          Sem gol nem assistência nesta partida.
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {moves.map((move, i) => (
            <li
              key={move.id}
              style={delay(Math.min(i, 6) * 60)}
              className="animate-row-in flex min-h-11 items-center gap-3 border-[3px] border-border-strong bg-surface px-3 shadow-[3px_3px_0_0_#000]"
            >
              <span className="inline-flex h-6 min-w-6 items-center justify-center bg-text px-1 text-team-black">
                <PixelText>{String(i + 1)}</PixelText>
              </span>
              <PixelText className={move.type === 'GOAL' ? 'text-gold' : 'text-text'}>
                {MATCH_EVENT_TYPE_LABELS[move.type]}
              </PixelText>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

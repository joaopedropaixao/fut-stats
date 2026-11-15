import type { VotingView } from '@fut-stats/shared';
import { Button } from '../../components/ui/button';
import { PixelBodyLarge } from '../../components/ui/pixel-body-large';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { RouteButton } from '../rounds/route-button';
import { countdownParts, formatDeadlineAt } from './deadline';
import { Meter } from './meter';

type SentCardProps = {
  view: VotingView;
  /** Quanto falta para o prazo (ms); `null` sem prazo. */
  remaining: number | null;
  onEdit: () => void;
};

/**
 * "VOTOS ENVIADOS!" (folha: Fim de jogo): grande momento com o meu bonequinho comemorando (pulinho de 2 quadros;
 * parado com "reduzir movimento"), o medidor e a contagem em horas e minutos. A data do prazo é a real.
 */
export function SentCard({ view, remaining, onEdit }: SentCardProps) {
  const me = view.players.find((p) => p.membershipId === view.me.membershipId);
  const until = view.deadline ? formatDeadlineAt(view.deadline) : null;
  const parts = remaining !== null && remaining > 0 ? countdownParts(remaining) : null;
  return (
    <section
      aria-label="Votos enviados"
      className="moment-frame animate-moment-in flex flex-col items-center gap-4 bg-surface-raised px-4 pt-7 pb-4"
    >
      {me && (
        <span aria-hidden className="inline-flex h-24 items-end">
          <span className="animate-hop inline-flex">
            <PixelBodyLarge
              team={me.team === 'WHITE' ? 'white' : 'black'}
              avatar={me.avatar}
              scale={3}
            />
          </span>
        </span>
      )}
      <PixelText as="h2" size={32} wrap className="text-center">
        Votos enviados!
      </PixelText>
      <p className="max-w-72 text-center text-base text-text-muted">
        {until
          ? `O resultado sai ${until}, ou antes, se todo mundo votar.`
          : 'O resultado sai quando o prazo acabar, ou antes, se todo mundo votar.'}
      </p>
      <Meter
        voted={view.progress.voted}
        total={view.progress.total}
        showMissing
        className="w-full"
      />
      {parts && (
        <div
          className="flex gap-2"
          aria-label={`Faltam ${parts.hours} horas e ${parts.minutes} minutos`}
        >
          <CountBox value={parts.hours} label="Horas" />
          <CountBox value={parts.minutes} label="Minutos" />
        </div>
      )}
      <p className="text-center text-sm text-text-muted">
        {until
          ? `Dá para mudar até o fim do prazo (${until}).`
          : 'Dá para mudar até o fim do prazo.'}
      </p>
      <Button
        variant="outline"
        size={52}
        icon="pencil"
        label="Editar votos"
        block
        onClick={onEdit}
      />
      <RouteButton to="/" variant="outline" size={52} label="Voltar para o início" block />
    </section>
  );
}

function CountBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      aria-hidden
      className="flex min-w-24 flex-col items-center gap-1 bg-surface-raised px-3 py-2 shadow-card"
    >
      <PixelDigits value={value} scale={4} decorative />
      <PixelText className="text-text-muted">{label}</PixelText>
    </div>
  );
}

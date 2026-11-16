import type { RoundDetail } from '@fut-stats/shared';
import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Icon } from '../../components/ui/icons';
import { PixelDigits } from '../../components/ui/pixel-digits';
import { PixelText } from '../../components/ui/pixel-text';
import { MemberAvatar } from './member-avatar';
import { MyPresence } from './my-presence';
import { PresenceTally } from './presence-tally';
import { RoundWhen } from './round-when';
import { usePresence } from './use-presence';

/** Quantos rostos de quem vai cabem na fileira em 320 px (o resto vira "+N"). */
const FACES = 5;

/**
 * Presença aberta, o card grande: grande momento verde (contorno de 3px, sombra dura, entrada em degraus) com
 * a data e o local, CONFIRMAR / AUSÊNCIA, a contagem e a fileira de rostos de quem vai, que leva ao detalhe da
 * rodada. Verde é o papel da presença; nenhuma tecla amarela aqui (as respostas são verde e vermelho).
 */
export function PresenceCard({ groupId, round }: { groupId: string; round: RoundDetail }) {
  const presence = usePresence(groupId, round);
  const going = round.attendance.confirmed;
  const shown = going.slice(0, FACES);
  const more = going.length - shown.length;
  const set = (confirmed: boolean) => presence.setAttendance(round.myMembershipId, confirmed);

  return (
    <>
      <section
        aria-label="Presença aberta"
        className="moment-frame animate-moment-in flex flex-col bg-surface-raised"
        style={{ borderColor: 'var(--color-success)', boxShadow: '5px 5px 0 var(--color-shadow)' }}
      >
        <div className="flex items-center gap-3 bg-success/12 px-4 py-4 shadow-[inset_0_-3px_0_0_var(--color-success)]">
          <Icon name="check" size={28} strokeWidth={3} className="text-[#86efac]" />
          <PixelText as="h2" size={24} wrap className="text-text [text-shadow:2px_2px_0_#000]">
            Presença aberta
          </PixelText>
        </div>
        <div
          className="flex flex-col gap-5 p-4"
          style={{ '--moment-delay': '120ms' } as CSSProperties}
        >
          <div className="animate-row-in flex flex-col gap-5">
            <RoundWhen
              number={round.number}
              scheduledAt={round.scheduledAt}
              location={round.location}
              numberClassName="text-[#86efac]"
            />
          </div>
          <div className="animate-row-in [--moment-delay:180ms]">
            <MyPresence round={round} onChange={set} calm />
          </div>
          <div className="animate-row-in flex flex-col gap-4 shadow-[inset_0_2px_0_0_var(--color-border)] pt-4 [--moment-delay:240ms]">
            <PresenceTally round={round} />
            <Link
              to={`/rodadas/${round.id}`}
              aria-label={`Quem vai: ${going.length} ${going.length === 1 ? 'confirmado' : 'confirmados'}. Ver a rodada`}
              className="flex min-h-12 items-center gap-3 bg-surface px-3 py-2 shadow-card active:bg-highlight"
            >
              {going.length === 0 ? (
                <PixelText wrap className="min-w-0 flex-1 text-text-muted">
                  Ninguém confirmou ainda
                </PixelText>
              ) : (
                <span className="flex min-w-0 flex-1 items-center">
                  <span className="flex items-center -space-x-2">
                    {shown.map((m) => (
                      <span
                        key={m.membershipId}
                        className="rounded-full shadow-[0_0_0_2px_var(--color-surface)]"
                      >
                        <MemberAvatar
                          nickname={m.nickname}
                          avatar={m.avatar}
                          goalkeeper={m.isHiredGoalkeeper}
                          size={32}
                        />
                      </span>
                    ))}
                  </span>
                  {more > 0 && (
                    <span
                      role="img"
                      aria-label={`mais ${more}`}
                      className="ml-2 inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-surface-3 px-2 shadow-card"
                    >
                      <PixelDigits value={`+${more}`} scale={2} decorative />
                    </span>
                  )}
                </span>
              )}
              <Icon name="chevronRight" size={20} className="text-text-muted" />
            </Link>
          </div>
        </div>
      </section>
      {presence.notice}
    </>
  );
}

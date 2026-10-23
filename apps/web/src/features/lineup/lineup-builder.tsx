import {
  POSITION_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  TEAM_LABELS,
  type Lineup,
} from '@fut-stats/shared';
import { useMemo, useState } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { ErrorState } from '../../components/ui/states';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { cn } from '../../lib/cn';
import { ConfirmSheet } from './confirm-sheet';
import {
  countStarters,
  draftFromLineup,
  locate,
  placeInReserve,
  placeInSlot,
  RESERVE_BOXES,
  sendToBench,
  toSaveInput,
  type Draft,
  type SlotKey,
  type TeamKey,
} from './lineup-draft';
import { Pitch } from './pitch';
import { errorMessage, usePublishLineup, useSaveLineup } from './queries';
import { TeamSegmented } from './team-segmented';

type LineupBuilderProps = { groupId: string; roundId: string; lineup: Lineup };

/** Montar Branco x Preto: banco com os confirmados, campo 1-2-3-1, reservas, salvar e publicar. */
export function LineupBuilder({ groupId, roundId, lineup }: LineupBuilderProps) {
  const save = useSaveLineup(groupId, roundId);
  const publish = usePublishLineup(groupId, roundId);

  const [draft, setDraft] = useState<Draft>(() => draftFromLineup(lineup));
  const [history, setHistory] = useState<Draft[]>([]);
  const [team, setTeam] = useState<TeamKey>('WHITE');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const members = useMemo(() => {
    const map = new Map<string, Lineup['unassigned'][number]>();
    for (const m of lineup.unassigned) map.set(m.membershipId, m);
    for (const t of ['WHITE', 'BLACK'] as const) {
      for (const p of [...lineup.teams[t].starters, ...lineup.teams[t].reserves]) {
        map.set(p.membershipId, p);
      }
    }
    return map;
  }, [lineup]);

  const bench = useMemo(
    () => [...members.values()].filter((m) => !locate(draft, m.membershipId)),
    [members, draft],
  );

  const dirty =
    JSON.stringify(toSaveInput(draft)) !== JSON.stringify(toSaveInput(draftFromLineup(lineup)));
  const pickedSpot = pickedId ? locate(draft, pickedId) : null;
  const picked = pickedId ? members.get(pickedId) : undefined;

  function change(next: Draft) {
    if (next === draft) return;
    setHistory((h) => [...h, draft]);
    setDraft(next);
    save.reset();
    publish.reset();
  }

  function onSlot(key: SlotKey) {
    const occupant = draft[team].slots[key];
    if (pickedId) {
      if (occupant === pickedId) setPickedId(null);
      else {
        change(placeInSlot(draft, team, key, pickedId));
        setPickedId(null);
      }
    } else if (occupant) setPickedId(occupant);
  }

  function onReserve(index: number) {
    const occupant = draft[team].reserves[index];
    if (pickedId) {
      if (occupant === pickedId) setPickedId(null);
      else {
        change(placeInReserve(draft, team, pickedId));
        setPickedId(null);
      }
    } else if (occupant) setPickedId(occupant);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setDraft(previous);
    setPickedId(null);
  }

  async function publishNow() {
    try {
      if (dirty) await save.mutateAsync(toSaveInput(draft));
      await publish.mutateAsync();
    } catch {
      // O erro fica em save.error / publish.error e aparece na gaveta.
    }
  }

  const error = publish.error ?? save.error;

  return (
    <>
      <div className="flex flex-col gap-4">
        <TeamSegmented value={team} onChange={setTeam} />
        <Counts draft={draft} team={team} />

        <p className="min-h-10 text-sm text-text-muted" aria-live="polite">
          {picked
            ? `Agora toque na vaga de ${picked.nickname}.`
            : 'Toque no jogador e depois na vaga.'}
        </p>

        <Pitch
          team={team}
          draft={draft[team]}
          members={members}
          picking={pickedId !== null}
          pickedId={pickedId}
          onSlot={onSlot}
        />

        <section aria-label="Reservas" className="flex flex-col gap-2">
          <PixelText>{`Reservas do ${TEAM_LABELS[team]}`}</PixelText>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: RESERVE_BOXES }, (_, i) => {
              const id = draft[team].reserves[i];
              const member = id ? members.get(id) : undefined;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onReserve(i)}
                  aria-pressed={id !== undefined && id === pickedId}
                  className={cn(
                    'flex min-h-14 items-center gap-2 bg-surface px-3',
                    id !== undefined && id === pickedId
                      ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                      : 'shadow-card',
                  )}
                >
                  {member ? (
                    <>
                      <Avatar
                        nickname={member.nickname}
                        team={team === 'WHITE' ? 'white' : 'black'}
                        size={32}
                        gap="surface"
                      />
                      <PixelText>{member.nickname}</PixelText>
                    </>
                  ) : (
                    <PixelText className="text-text-muted">Livre</PixelText>
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {pickedSpot && pickedId && (
          <Button
            variant="outline"
            size={44}
            label="Voltar pro banco"
            onClick={() => {
              change(sendToBench(draft, pickedId));
              setPickedId(null);
            }}
          />
        )}

        <Bench
          players={bench}
          pickedId={pickedId}
          onPick={(id) => setPickedId(id === pickedId ? null : id)}
        />

        <div className="flex flex-col gap-3">
          {!dirty && lineup.errors.length > 0 && (
            <div className="flex gap-2 text-sm text-text-muted">
              <Icon name="alert" size={18} className="mt-0.5 shrink-0 text-warning" />
              <p>
                Para publicar:{' '}
                {[
                  ...new Set(lineup.errors.map((code) => ROUND_TRANSITION_ERROR_LABELS[code])),
                ].join('; ')}
                .
              </p>
            </div>
          )}
          {save.isSuccess && !dirty && (
            <div className="flex items-center gap-2 text-sm text-text-muted" role="status">
              <Icon name="check" size={18} className="shrink-0 text-success" />
              <p>Rascunho salvo.</p>
            </div>
          )}
          {save.isError && <ErrorState title="Não salvou" message={errorMessage(save.error)} />}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size={44}
              label="Desfazer"
              disabled={history.length === 0}
              onClick={undo}
            />
            <Button
              variant="secondary"
              size={44}
              label="Salvar"
              loading={save.isPending}
              disabled={!dirty}
              onClick={() => save.mutate(toSaveInput(draft))}
            />
          </div>
          <Button
            label="Publicar times"
            block
            onClick={() => {
              publish.reset();
              setConfirming(true);
            }}
          />
        </div>
      </div>

      {confirming && (
        <ConfirmSheet
          title="Publicar os times?"
          message="Todos do grupo vão ver Branco x Preto. Depois disso a presença só muda pelo admin, mas dá para despublicar e refazer antes do jogo."
          onClose={() => setConfirming(false)}
        >
          {error && <ErrorState title="Não publicou" message={errorMessage(error)} />}
          <Button
            label="Publicar"
            block
            loading={save.isPending || publish.isPending}
            onClick={() => void publishNow()}
          />
          <Button variant="outline" label="Voltar" block onClick={() => setConfirming(false)} />
        </ConfirmSheet>
      )}
    </>
  );
}

function Counts({ draft, team }: { draft: Draft; team: TeamKey }) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1">
      <PixelText>{`Titulares ${countStarters(draft, team)} de 7`}</PixelText>
      <PixelText>{`Reservas ${draft[team].reserves.length} de ${RESERVE_BOXES}`}</PixelText>
    </div>
  );
}

type BenchPlayer = Lineup['unassigned'][number];

function Bench({
  players,
  pickedId,
  onPick,
}: {
  players: BenchPlayer[];
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <section aria-label="Banco" className="flex flex-col gap-2">
      <PixelText>{`Banco ${players.length}`}</PixelText>
      {players.length === 0 ? (
        <p className="text-sm text-text-muted">Todos os confirmados já estão num time.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {players
            .toSorted((a, b) => a.nickname.localeCompare(b.nickname, 'pt-BR'))
            .map((p) => (
              <li key={p.membershipId}>
                <button
                  type="button"
                  aria-pressed={p.membershipId === pickedId}
                  onClick={() => onPick(p.membershipId)}
                  className={cn(
                    'flex min-h-11 items-center gap-2 bg-surface pr-3 pl-2',
                    p.membershipId === pickedId
                      ? 'shadow-[inset_0_0_0_2px_var(--color-accent)]'
                      : 'shadow-card',
                  )}
                >
                  <span
                    aria-hidden
                    className="inline-flex size-8 items-center justify-center rounded-full bg-surface-raised pl-px"
                  >
                    <PixelText>{[...p.nickname].slice(0, 2).join('')}</PixelText>
                  </span>
                  <span className="flex flex-col items-start">
                    <PixelText>{p.nickname}</PixelText>
                    <span className="text-caption text-text-muted">
                      {POSITION_LABELS[p.primaryPosition]}
                    </span>
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </section>
  );
}

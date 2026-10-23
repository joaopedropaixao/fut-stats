import {
  POSITION_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  TEAM_LABELS,
  type Lineup,
} from '@fut-stats/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Icon } from '../../components/ui/icons';
import { PixelText } from '../../components/ui/pixel-text';
import { ErrorState } from '../../components/ui/states';
import { Bench } from './bench';
import { ConfirmSheet } from './confirm-sheet';
import { FloatingAction, FloatingBar } from './floating-bar';
import { Initials } from './initials';
import {
  draftFromLineup,
  locate,
  membersOf,
  placeInReserve,
  placeInSlot,
  sendToBench,
  SLOTS,
  toSaveInput,
  type Draft,
  type SlotKey,
  type TeamKey,
} from './lineup-draft';
import { LineupStatus } from './lineup-status';
import { Pitch } from './pitch';
import { errorMessage, usePublishLineup, useSaveLineup } from './queries';
import { Reserves } from './reserves';
import { TeamSegmented } from './team-segmented';

type LineupBuilderProps = { groupId: string; roundId: string; lineup: Lineup };

/** Quanto tempo o aviso "foi para a ala · Desfazer" fica na tela. */
const TOAST_MS = 5000;

type Step = { draft: Draft; message: string };

/** Montar Branco x Preto: campo 1-2-3-1, reservas, banco com os confirmados, salvar e publicar. */
export function LineupBuilder({ groupId, roundId, lineup }: LineupBuilderProps) {
  const save = useSaveLineup(groupId, roundId);
  const publish = usePublishLineup(groupId, roundId);

  const [draft, setDraft] = useState<Draft>(() => draftFromLineup(lineup));
  const [history, setHistory] = useState<Step[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamKey>('WHITE');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pitchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  const members = useMemo(() => membersOf(lineup), [lineup]);

  const bench = useMemo(
    () => [...members.values()].filter((m) => !locate(draft, m.membershipId)),
    [members, draft],
  );

  const saved = useMemo(() => JSON.stringify(toSaveInput(draftFromLineup(lineup))), [lineup]);
  const dirty = JSON.stringify(toSaveInput(draft)) !== saved;
  const picked = pickedId ? members.get(pickedId) : undefined;
  const pickedSpot = pickedId ? locate(draft, pickedId) : null;

  // A vaga livre da vez: a primeira da posição principal de quem está na mão (o campo tem um amarelo só)
  const targetSlot: SlotKey | null =
    picked && !pickedSpot
      ? (SLOTS.find(
          (s) => s.position === picked.primaryPosition && draft[team].slots[s.key] === null,
        )?.key ?? null)
      : null;

  function change(next: Draft, message: string) {
    setPickedId(null);
    if (next === draft) return;
    setHistory((h) => [...h, { draft, message }]);
    setDraft(next);
    setToast(message);
    save.reset();
    publish.reset();
  }

  function nickname(id: string) {
    return members.get(id)?.nickname ?? 'Jogador';
  }

  function pick(id: string | null, { fromBench = false } = {}) {
    setPickedId(id);
    setToast(null);
    // Do banco, o campo fica lá em cima: leva a pessoa até ele
    if (id && fromBench) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      pitchRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function onSlot(key: SlotKey) {
    const occupant = draft[team].slots[key];
    if (!pickedId) {
      if (occupant) pick(occupant);
      return;
    }
    if (occupant === pickedId) return pick(null);
    const position = SLOTS.find((s) => s.key === key)!.position;
    change(
      placeInSlot(draft, team, key, pickedId),
      `${nickname(pickedId)} entrou de ${POSITION_LABELS[position].toLowerCase()} no ${TEAM_LABELS[team]}`,
    );
  }

  function onReserve(index: number) {
    const occupant = draft[team].reserves[index];
    if (!pickedId) {
      if (occupant) pick(occupant);
      return;
    }
    if (occupant === pickedId) return pick(null);
    change(
      placeInReserve(draft, team, pickedId, index),
      `${nickname(pickedId)} é reserva do ${TEAM_LABELS[team]}`,
    );
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    setHistory((h) => h.slice(0, -1));
    setDraft(previous.draft);
    setPickedId(null);
    setToast(null);
    save.reset();
    publish.reset();
  }

  async function publishNow() {
    try {
      if (dirty) await save.mutateAsync(toSaveInput(draft));
      await publish.mutateAsync();
    } catch {
      // O erro fica em save.error / publish.error e aparece na gaveta.
    }
  }

  const blocker =
    !dirty && lineup.errors.length > 0
      ? [...new Set(lineup.errors.map((code) => ROUND_TRANSITION_ERROR_LABELS[code]))].join('. ') +
        '.'
      : undefined;
  const publishError = publish.error ?? save.error;

  return (
    <>
      <div className="flex flex-col gap-4">
        <TeamSegmented
          value={team}
          onChange={(next) => {
            setTeam(next);
            setToast(null);
          }}
        />
        <LineupStatus draft={draft} blocker={blocker} />

        <Pitch
          ref={pitchRef}
          team={team}
          draft={draft[team]}
          members={members}
          pickedId={pickedId}
          targetSlot={targetSlot}
          onSlot={onSlot}
        />

        <Reserves
          team={team}
          reserves={draft[team].reserves}
          members={members}
          pickedId={pickedId}
          onBox={onReserve}
        />

        <Bench
          players={bench}
          pickedId={pickedId}
          onPick={(id) => pick(id === pickedId ? null : id, { fromBench: true })}
        />

        <div className="flex flex-col gap-3 pt-2">
          {save.isError && <ErrorState title="Não salvou" message={errorMessage(save.error)} />}
          {save.isSuccess && !dirty && (
            <p role="status" className="flex items-center gap-2 text-sm text-text-muted">
              <Icon name="check" size={18} strokeWidth={2.6} className="shrink-0 text-success" />
              Rascunho salvo. Só você vê até publicar.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size={52}
              icon="redo"
              label="Desfazer"
              disabled={history.length === 0}
              onClick={undo}
            />
            <Button
              variant="secondary"
              size={52}
              label="Salvar"
              loading={save.isPending && !confirming}
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

      {picked && (
        <FloatingBar>
          {pickedSpot ? (
            <Avatar
              nickname={picked.nickname}
              team={pickedSpot.team === 'WHITE' ? 'white' : 'black'}
              size={40}
              gap="surface-3"
            />
          ) : (
            <Initials nickname={picked.nickname} />
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <PixelText>{picked.nickname}</PixelText>
            <span className="text-caption text-text-muted">Toque numa vaga</span>
          </span>
          {pickedSpot ? (
            <FloatingAction
              label="Pro banco"
              onClick={() =>
                change(
                  sendToBench(draft, picked.membershipId),
                  `${picked.nickname} voltou para o banco`,
                )
              }
            />
          ) : (
            <FloatingAction label="Cancelar" onClick={() => pick(null)} />
          )}
        </FloatingBar>
      )}
      {!picked && toast && history.length > 0 && (
        <FloatingBar>
          <p className="min-w-0 flex-1 text-base font-semibold">{toast}</p>
          <FloatingAction label="Desfazer" accent onClick={undo} />
        </FloatingBar>
      )}

      {confirming && (
        <ConfirmSheet
          title="Publicar os times?"
          message="Todo o grupo passa a ver Branco x Preto. Se precisar mexer, dá para despublicar antes do jogo."
          notice={
            publishError && <ErrorState title="Não publicou" message={errorMessage(publishError)} />
          }
          onClose={() => setConfirming(false)}
        >
          <Button variant="outline" size={52} label="Voltar" onClick={() => setConfirming(false)} />
          <Button
            size={52}
            label="Publicar"
            loading={save.isPending || publish.isPending}
            onClick={() => void publishNow()}
          />
        </ConfirmSheet>
      )}
    </>
  );
}

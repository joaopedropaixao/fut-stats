import {
  draftBalance,
  POSITION_LABELS,
  ROUND_TRANSITION_ERROR_LABELS,
  TEAM_LABELS,
  type Lineup,
} from '@fut-stats/shared';
import { useMemo, useRef, useState } from 'react';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { ErrorState } from '../../components/ui/states';
import { useNotice } from '../../components/ui/use-notice';
import { apiErrorMessage } from '../../lib/api';
import { MemberAvatar } from '../rounds/member-avatar';
import { BalanceCard } from './balance-card';
import { Bench } from './bench';
import { FloatingAction, FloatingBar } from './floating-bar';
import {
  draftFromLineup,
  draftFromSuggestion,
  hasAnyone,
  isDirty,
  pushDraft,
  startHistory,
  undoDraft,
  locate,
  membersOf,
  placeInReserve,
  placeInSlot,
  sendToBench,
  SLOTS,
  toSaveInput,
  type DraftHistory,
  type SlotKey,
  type TeamKey,
} from './lineup-draft';
import { GenerateBlock } from './generate-block';
import { LineupStatus } from './lineup-status';
import { Pitch } from './pitch';
import { usePublishLineup, useSaveLineup, useSuggestLineup } from './queries';
import { Reserves } from './reserves';
import { TeamSegmented } from './team-segmented';

type LineupBuilderProps = { groupId: string; roundId: string; lineup: Lineup };

/** Montar Branco x Preto: campo 1-2-3-1, reservas, banco com os confirmados, salvar e publicar. */
export function LineupBuilder({ groupId, roundId, lineup }: LineupBuilderProps) {
  const save = useSaveLineup(groupId, roundId);
  const publish = usePublishLineup(groupId, roundId);
  const suggest = useSuggestLineup(groupId, roundId);
  const notice = useNotice();

  const [{ draft, past }, setHistory] = useState<DraftHistory>(() =>
    startHistory(draftFromLineup(lineup)),
  );
  const [team, setTeam] = useState<TeamKey>('WHITE');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmingGenerate, setConfirmingGenerate] = useState(false);
  const pitchRef = useRef<HTMLDivElement>(null);

  const members = useMemo(() => membersOf(lineup), [lineup]);
  // Quem desconfirmou não volta para o banco: só entra no time quem confirmou
  const bench = useMemo(
    () => [...members.values()].filter((m) => m.confirmed && !locate(draft, m.membershipId)),
    [members, draft],
  );

  const balance = draftBalance(toSaveInput(draft), [...members.values()]);
  const dirty = isDirty(draft, lineup);
  const picked = pickedId ? members.get(pickedId) : undefined;
  const pickedSpot = pickedId ? locate(draft, pickedId) : null;

  // A vaga livre da vez: a primeira da posição principal de quem está na mão (o campo tem um amarelo só)
  const targetSlot: SlotKey | null =
    picked && !pickedSpot
      ? (SLOTS.find(
          (s) => s.position === picked.primaryPosition && draft[team].slots[s.key] === null,
        )?.key ?? null)
      : null;

  function undo() {
    setHistory(undoDraft);
    setPickedId(null);
    notice.dismiss();
  }

  function change(next: DraftHistory['draft'], message: string) {
    setPickedId(null);
    if (next === draft) return;
    setHistory((h) => pushDraft(h, next));
    notice.show({ kind: 'success', title: message, onUndo: undo });
  }

  const nickname = (id: string) => members.get(id)?.nickname ?? 'Jogador';

  function pick(id: string | null, { fromBench = false } = {}) {
    setPickedId(id);
    notice.dismiss();
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

  /** Pede a sugestão (não grava): entra no rascunho como um passo, com Desfazer. */
  function generate() {
    setConfirmingGenerate(false);
    notice.dismiss();
    suggest.mutate(hasAnyone(draft) ? { avoid: toSaveInput(draft) } : {}, {
      onSuccess: (suggestion) => {
        setPickedId(null);
        setHistory((h) => pushDraft(h, draftFromSuggestion(suggestion)));
        notice.show({ kind: 'success', title: 'Times gerados', onUndo: undo });
      },
      onError: (err) =>
        notice.show({
          kind: 'error',
          title: 'Não gerou',
          message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        }),
    });
  }

  function saveDraft() {
    notice.dismiss();
    save.mutate(toSaveInput(draft), {
      onSuccess: () => notice.show({ kind: 'success', title: 'Rascunho salvo' }),
      onError: (err) =>
        notice.show({
          kind: 'error',
          title: 'Não salvou',
          message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        }),
    });
  }

  const reasons = [...new Set(lineup.errors.map((code) => ROUND_TRANSITION_ERROR_LABELS[code]))];
  const publishBlocked = dirty || lineup.errors.length > 0;

  return (
    <>
      <div className="flex flex-col gap-4">
        <TeamSegmented
          value={team}
          onChange={(next) => {
            setTeam(next);
            notice.dismiss();
          }}
        />
        <BalanceCard balance={balance} />
        <LineupStatus draft={draft} errors={lineup.errors} dirty={dirty} />
        {lineup.permissions.edit && (
          <GenerateBlock
            regenerate={hasAnyone(draft)}
            loading={suggest.isPending}
            onGenerate={() => (hasAnyone(draft) ? setConfirmingGenerate(true) : generate())}
          />
        )}

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
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size={52}
              icon="redo"
              label="Desfazer"
              disabled={past.length === 0}
              onClick={undo}
            />
            <Button
              variant="secondary"
              size={52}
              label="Salvar"
              loading={save.isPending}
              disabled={!dirty || !lineup.permissions.edit}
              onClick={saveDraft}
            />
          </div>
          {lineup.permissions.publish && (
            <>
              <Button
                label="Publicar times"
                block
                disabled={publishBlocked}
                onClick={() => {
                  publish.reset();
                  setConfirming(true);
                }}
              />
              {publishBlocked && (
                <p className="text-caption text-text-muted">
                  {dirty ? 'Salve o rascunho antes de publicar.' : `${reasons.join('. ')}.`}
                </p>
              )}
            </>
          )}
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
            <MemberAvatar nickname={picked.nickname} goalkeeper={picked.isHiredGoalkeeper} />
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
      {!picked && notice.node}

      {confirmingGenerate && (
        <Sheet
          title="Gerar times novos?"
          onClose={() => setConfirmingGenerate(false)}
          actions={
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={() => setConfirmingGenerate(false)}
              />
              <Button size={52} label="Gerar" className="flex-1" onClick={generate} />
            </>
          }
        >
          <p>Os times de agora saem do rascunho. Dá para desfazer.</p>
        </Sheet>
      )}

      {confirming && (
        <Sheet
          title="Publicar os times?"
          onClose={() => setConfirming(false)}
          actions={
            <>
              <Button
                variant="outline"
                size={52}
                label="Voltar"
                className="flex-1"
                onClick={() => setConfirming(false)}
              />
              <Button
                size={52}
                label="Publicar"
                className="flex-1"
                loading={publish.isPending}
                onClick={() => publish.mutate()}
              />
            </>
          }
        >
          <p>
            Todo o grupo passa a ver Branco x Preto. Se precisar mexer, dá para despublicar antes do
            jogo.
          </p>
          {publish.isError && (
            <div className="pt-3">
              <ErrorState
                title="Não publicou"
                message={apiErrorMessage(publish.error, 'Falha de conexão. Tente de novo.')}
              />
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

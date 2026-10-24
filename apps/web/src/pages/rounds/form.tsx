import {
  ROUND_LOCATION_MAX_LENGTH,
  ROUND_NOT_EDITABLE_LABEL,
  type RoundDetail,
  type RoundList,
} from '@fut-stats/shared';
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button } from '../../components/ui/button';
import { DateTimeField } from '../../components/ui/date-time-field';
import { useNotice } from '../../components/ui/use-notice';
import { PixelText } from '../../components/ui/pixel-text';
import { Sheet } from '../../components/ui/sheet';
import { ErrorState, SkeletonList } from '../../components/ui/states';
import { TextField } from '../../components/ui/text-field';
import { useCurrentGroup } from '../../features/group/use-current-group';
import {
  useCreateRound,
  useDeleteRound,
  useRound,
  useRounds,
  useUpdateRound,
} from '../../features/rounds/queries';
import { RouteButton } from '../../features/rounds/route-button';
import { apiErrorMessage } from '../../lib/api';

const DEFAULT_HOUR = 20;

/** Sem rodada anterior no grupo: amanhã à noite (o admin muda; o dia da pelada não é fixo). */
function defaultWhen(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, DEFAULT_HOUR, 0);
}

/** /rodadas/nova: só o admin cria (a API também confere). */
export function NewRoundPage() {
  const { group } = useCurrentGroup();
  if (!group) return null;
  if (group.role !== 'ADMIN') return <AdminOnly />;
  return <NewRound groupId={group.id} />;
}

/**
 * A rodada nova já vem com a sugestão da API: mesmo dia da semana, hora e local da última. Se a lista
 * falhar, cai em "amanhã à noite" (o admin ajusta de qualquer jeito).
 */
function NewRound({ groupId }: { groupId: string }) {
  const rounds = useRounds(groupId);
  // Espera a lista desta abertura: a do cache pode ser de antes da última rodada criada
  if (!rounds.isFetchedAfterMount && !rounds.isError) {
    return (
      <>
        <Back to="/rodadas" />
        <SkeletonList rows={3} label="Carregando a sugestão" />
      </>
    );
  }
  return <RoundForm groupId={groupId} suggestion={rounds.data?.suggestion ?? null} />;
}

/** /rodadas/:roundId/editar: só o admin, e só antes do jogo. */
export function EditRoundPage() {
  const { group } = useCurrentGroup();
  const { roundId } = useParams();
  const round = useRound(group?.id ?? '', group ? roundId : undefined);
  if (!group) return null;
  if (group.role !== 'ADMIN') return <AdminOnly />;

  if (round.isError) {
    return (
      <>
        <Back to="/rodadas" />
        <ErrorState
          title="Não deu para abrir a rodada"
          message="Ela pode ter sido apagada, ou a internet caiu."
          onRetry={() => void round.refetch()}
          retrying={round.isFetching}
        />
      </>
    );
  }
  if (!round.data) {
    return (
      <>
        <Back to="/rodadas" />
        <SkeletonList rows={3} label="Carregando a rodada" />
      </>
    );
  }
  if (!round.data.permissions.edit) {
    return (
      <>
        <Back to={`/rodadas/${round.data.id}`} />
        <ErrorState title="Rodada travada" message={ROUND_NOT_EDITABLE_LABEL} />
      </>
    );
  }
  return <RoundForm groupId={group.id} round={round.data} />;
}

function AdminOnly() {
  return (
    <>
      <Back to="/rodadas" />
      <ErrorState
        title="Só o admin faz isso"
        message="Peça para um admin do grupo marcar a rodada."
      />
    </>
  );
}

function Back({ to }: { to: string }) {
  return (
    <RouteButton
      to={to}
      label="Voltar"
      icon="chevronLeft"
      variant="outline"
      size={44}
      className="self-start"
    />
  );
}

function RoundForm({
  groupId,
  round,
  suggestion = null,
}: {
  groupId: string;
  round?: RoundDetail;
  suggestion?: RoundList['suggestion'];
}) {
  const navigate = useNavigate();
  const notice = useNotice();
  const [when, setWhen] = useState(() =>
    round
      ? new Date(round.scheduledAt)
      : suggestion
        ? new Date(suggestion.scheduledAt)
        : defaultWhen(),
  );
  const [location, setLocation] = useState(round?.location ?? suggestion?.location ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const create = useCreateRound(groupId);
  const update = useUpdateRound(groupId, round?.id ?? '');
  const remove = useDeleteRound(groupId, round?.id ?? '');
  const saving = create.isPending || update.isPending;

  const fail = (err: unknown) =>
    notice.show({
      kind: 'error',
      title: 'Não deu para salvar',
      message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const input = { scheduledAt: when.toISOString(), location };
    const done = (saved: RoundDetail) => void navigate(`/rodadas/${saved.id}`, { replace: true });
    if (round) update.mutate(input, { onSuccess: done, onError: fail });
    else create.mutate(input, { onSuccess: done, onError: fail });
  };

  const apagar = () =>
    remove.mutate(undefined, {
      onSuccess: () => void navigate('/rodadas', { replace: true }),
      onError: (err) => {
        setConfirmDelete(false);
        notice.show({
          kind: 'error',
          title: 'Não deu para apagar',
          message: apiErrorMessage(err, 'Falha de conexão. Tente de novo.'),
        });
      },
    });

  return (
    <>
      <title>{`${round ? 'Editar rodada' : 'Nova rodada'} · Fut Stats`}</title>
      <Back to={round ? `/rodadas/${round.id}` : '/rodadas'} />
      <PixelText as="h1" size={24} wrap className="outline-none">
        {round ? 'Editar rodada' : 'Nova rodada'}
      </PixelText>
      <form onSubmit={submit} className="flex flex-col gap-6">
        <DateTimeField value={when} onChange={setWhen} />
        <TextField
          label="Local"
          value={location}
          maxLength={ROUND_LOCATION_MAX_LENGTH}
          placeholder="Arena do Bairro"
          hint="Opcional. Aparece para o grupo na rodada."
          onChange={(e) => setLocation(e.target.value)}
        />
        <Button
          type="submit"
          label={round ? 'Salvar' : 'Criar rodada'}
          icon="check"
          loading={saving}
          block
        />
        {round?.permissions.delete && (
          <Button
            label="Apagar rodada"
            icon="trash"
            variant="danger"
            size={48}
            block
            onClick={() => setConfirmDelete(true)}
          />
        )}
      </form>
      {confirmDelete && (
        <Sheet
          title="Apagar a rodada?"
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <Button
                label="Voltar"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmDelete(false)}
              />
              <Button
                label="Apagar"
                icon="trash"
                variant="danger"
                className="flex-1"
                loading={remove.isPending}
                onClick={apagar}
              />
            </>
          }
        >
          As presenças dessa rodada também somem. Isso não dá para desfazer.
        </Sheet>
      )}
      {notice.node}
    </>
  );
}

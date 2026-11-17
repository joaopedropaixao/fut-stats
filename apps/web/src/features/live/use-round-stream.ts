import {
  ROUND_STREAM_SCOPES,
  roundStreamEventSchema,
  type RoundStreamScope,
} from '@fut-stats/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { setChannelMode } from './channel-mode';
import { invalidateScopes } from './invalidate-scopes';
import { connectRoundStream } from './round-stream';

/** Lê a mensagem `changed` com o contrato do `shared`; `null` se não bate. */
export function parseRoundStreamEvent(data: string): readonly RoundStreamScope[] | null {
  try {
    const result = roundStreamEventSchema.safeParse(JSON.parse(data));
    return result.success ? result.data.scopes : null;
  } catch {
    return null;
  }
}

/**
 * Abre o canal ao vivo de uma rodada enquanto o componente existe e invalida as consultas pelo escopo do aviso.
 * Ao (re)conectar, invalida os três escopos (pode ter perdido aviso). O modo do canal fica registrado para a
 * rodada: as consultas do jogo e da votação leem dele para escolher o intervalo.
 */
export function useRoundStream(groupId: string, roundId: string): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const close = connectRoundStream<RoundStreamScope>({
      url: `/api/groups/${groupId}/rounds/${roundId}/stream`,
      parse: parseRoundStreamEvent,
      fallbackScopes: ROUND_STREAM_SCOPES,
      onChanged: (scopes) => invalidateScopes(queryClient, groupId, roundId, scopes),
      onMode: (mode) => setChannelMode(roundId, mode),
    });
    return () => {
      close();
      setChannelMode(roundId, null);
    };
  }, [queryClient, groupId, roundId]);
}

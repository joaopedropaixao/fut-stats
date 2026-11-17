import { SAFETY_REFRESH_MS, type ChannelMode } from '../live/stream-state';

/** De quanto em quanto tempo a votação aberta se atualiza sozinha no modo antigo (ms): o medidor mostra quem votou. */
export const VOTING_REFRESH_MS = 15_000;

/**
 * O intervalo da votação: aberta, 15 s no modo antigo e 60 s (rede de segurança) com o canal ao vivo conectado.
 * `false` = fechada ou antes de abrir, nada muda sozinho.
 */
export function votingRefreshInterval(
  status: string | undefined,
  channel: ChannelMode = 'polling',
): number | false {
  if (status !== 'VOTING') return false;
  return channel === 'live' ? SAFETY_REFRESH_MS : VOTING_REFRESH_MS;
}

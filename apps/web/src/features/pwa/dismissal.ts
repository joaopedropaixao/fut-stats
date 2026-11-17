/**
 * "Dispensei": as linhas "Instale o app" e "Ative os avisos" do Feed são do aparelho (não da pelada nem do
 * jogador), e voltam depois de 14 dias. Sem armazenamento (modo privado, bloqueado), nada quebra: lê como
 * "não dispensei".
 */
export const DISMISS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type DismissTarget = 'install' | 'push';

const key = (target: DismissTarget) => `fut-stats:dispensou:${target}`;

export function isDismissed(
  target: DismissTarget,
  now: number = Date.now(),
  storage?: Pick<Storage, 'getItem'>,
): boolean {
  try {
    const since = Number((storage ?? window.localStorage).getItem(key(target)));
    return Number.isFinite(since) && since > 0 && now - since < DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
}

export function dismiss(
  target: DismissTarget,
  now: number = Date.now(),
  storage?: Pick<Storage, 'setItem'>,
): void {
  try {
    (storage ?? window.localStorage).setItem(key(target), String(now));
  } catch {
    // sem armazenamento: a linha volta na próxima visita
  }
}

/**
 * O que o card "Avisos" (Perfil) e a linha "Ative os avisos" (Feed) mostram. A decisão fica numa função pura:
 * o `use-push` só junta os fatos do aparelho e do servidor, e a tela desenha o resultado.
 */
export type PushPermission = 'default' | 'granted' | 'denied';

export type PushStateInput = {
  /** `GET /push/config`: `undefined` enquanto não chegou (ou se falhou). */
  serverEnabled: boolean | undefined;
  /** iPhone/iPad (o push do iOS só existe no app instalado). */
  ios: boolean;
  /** O app está aberto como app instalado (`display-mode: standalone`). */
  standalone: boolean;
  /** Service worker, `PushManager` e `Notification` existem neste navegador. */
  supported: boolean;
  permission: PushPermission;
  /** Este aparelho tem assinatura: `undefined` enquanto o navegador responde. */
  subscribed: boolean | undefined;
};

export type PushState =
  /** Servidor sem push (ou ainda sem resposta): o card não aparece. */
  | 'hidden'
  /** iPhone sem o app instalado: pede para instalar primeiro. */
  | 'ios-install'
  | 'unsupported'
  /** A pessoa negou a permissão: só ela libera, nas configurações do navegador. */
  | 'blocked'
  /** Perguntando ao navegador se há assinatura: interruptor carregando. */
  | 'checking'
  | 'off'
  | 'on';

export function pushState(input: PushStateInput): PushState {
  if (input.serverEnabled !== true) return 'hidden';
  // No Safari do iPhone fora do app instalado não há `PushManager`: o caminho é instalar, não "sem suporte"
  if (input.ios && !input.standalone) return 'ios-install';
  if (!input.supported) return 'unsupported';
  if (input.permission === 'denied') return 'blocked';
  if (input.subscribed === undefined) return 'checking';
  return input.subscribed && input.permission === 'granted' ? 'on' : 'off';
}

/**
 * A linha "Ative os avisos" do Feed: só para quem pode ligar agora e ainda não foi perguntado. Quem desligou de
 * propósito (permissão já dada) ou bloqueou não recebe a cobrança.
 */
export function showEnablePushLine(input: PushStateInput): boolean {
  return pushState(input) === 'off' && input.permission === 'default';
}

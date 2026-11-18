/** Como o app pode ser instalado neste aparelho agora. */
export type InstallMode =
  /** Já aberto como app instalado. */
  | 'installed'
  /** O navegador guardou o `beforeinstallprompt`: a tecla chama o pedido dele. */
  | 'prompt'
  /** iPhone/iPad: não há pedido; a gaveta ensina o caminho pelo Compartilhar. */
  | 'ios'
  /** Sem como instalar daqui (o card some). */
  | 'none';

export function installMode(input: {
  standalone: boolean;
  ios: boolean;
  hasPrompt: boolean;
}): InstallMode {
  if (input.standalone) return 'installed';
  if (input.hasPrompt) return 'prompt';
  return input.ios ? 'ios' : 'none';
}

/** iPhone, iPod e iPad (o iPadOS se diz Macintosh, mas tem toque). */
export function isIos(
  userAgent: string,
  platform: string = '',
  maxTouchPoints: number = 0,
): boolean {
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1);
}

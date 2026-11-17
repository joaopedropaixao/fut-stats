/**
 * A cor de identidade de cada aviso do Feed (decisão do dono, 16 nov 2026): moldura, faixa do cabeçalho e ícone do
 * aviso grande; faixa à esquerda e ícone da linha. A tecla de ação é sempre a amarela e nunca leva esta cor; esta cor
 * nunca vira amarelo. O tipo vem como texto (não importa valor do `shared`: este arquivo é do `components/ui`).
 */
export type AlertToneKey =
  'IN_PROGRESS' | 'POST_MATCH' | 'RESULT' | 'VOTING' | 'TEAMS_PUBLISHED' | 'PRESENCE';

/** O corte diagonal do placar (assinatura 1 do DS): Branco de um lado, Preto do outro. */
export const DIAGONAL_CUT = 'linear-gradient(112deg, #fff 0%, #fff 50%, #000 50%, #000 100%)';

export type AlertTone = {
  /** Cor da moldura de 3 px e da faixa do cabeçalho (CSS). */
  frame: string;
  /** Classe de texto do ícone, legível sobre as superfícies verdes. */
  ink: string;
  /** Classe do fundo da faixa do cabeçalho. */
  band: string;
  /** Textura da faixa do cabeçalho (CSS `background-image`), quando a cor sozinha não separa o tipo de outro. */
  bandImage?: string;
  /** Fundo da faixa à esquerda da linha (CSS `background`). */
  stripe: string;
};

export const ALERT_TONES: Readonly<Record<AlertToneKey, AlertTone>> = {
  IN_PROGRESS: {
    frame: 'var(--color-danger)',
    ink: 'text-[#f87171]',
    band: 'bg-danger/22',
    stripe: 'var(--color-danger)',
  },
  POST_MATCH: {
    frame: 'var(--color-warning)',
    ink: 'text-warning',
    band: 'bg-warning/14',
    stripe: 'var(--color-warning)',
  },
  RESULT: {
    frame: 'var(--color-gold)',
    ink: 'text-gold',
    band: 'bg-gold/14',
    stripe: 'var(--color-gold)',
  },
  // Prata com listras de cédula na faixa: a textura e a urna separam do prata do pódio (2º lugar)
  VOTING: {
    frame: 'var(--color-silver)',
    ink: 'text-silver',
    band: 'bg-silver/14',
    bandImage:
      'repeating-linear-gradient(135deg, rgb(255 255 255 / 0%) 0 4px, rgb(255 255 255 / 16%) 4px 6px)',
    stripe:
      'repeating-linear-gradient(135deg, var(--color-silver) 0 3px, var(--color-silver-shadow) 3px 5px)',
  },
  TEAMS_PUBLISHED: {
    frame: 'var(--color-team-white)',
    ink: 'text-team-white',
    band: 'bg-team-black',
    stripe: 'linear-gradient(160deg, #fff 0%, #fff 50%, #000 50%, #000 100%)',
  },
  PRESENCE: {
    frame: 'var(--color-success)',
    ink: 'text-[#86efac]',
    band: 'bg-success/12',
    stripe: 'var(--color-success)',
  },
};

/** Estilo do divisor entre a faixa/placar e o corpo do card, na cor do tipo. */
export function toneDivider(tone: AlertToneKey): { boxShadow: string } {
  return { boxShadow: `inset 0 3px 0 0 ${ALERT_TONES[tone].frame}` };
}

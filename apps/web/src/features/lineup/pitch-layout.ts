import type { SlotKey } from './lineup-draft';

/**
 * Onde cada vaga do 1-2-3-1 fica no campo (px do alto do campo; ataque em cima, goleiro embaixo).
 * Cada linha tem o seu degrau: apelido de 10 letras tem ~120 px e, em 320 px, o campo tem 288, então jogadores de
 * linhas vizinhas nunca podem dividir a mesma faixa de altura (nome, etiqueta "VOCÊ" e rosto se encostariam).
 */
export const SLOT_POSITION: Record<SlotKey, { left: string; top: number }> = {
  FWD: { left: '50%', top: 30 },
  // Nos extremos o nome (até 10 letras) não pode passar da borda do campo em 320 px
  WING1: { left: 'max(18.4%, 70px)', top: 124 },
  WING2: { left: 'min(77.1%, calc(100% - 70px))', top: 124 },
  MID: { left: '50%', top: 226 },
  DEF1: { left: '27.9%', top: 326 },
  DEF2: { left: '72.1%', top: 326 },
  GK: { left: '50%', top: 446 },
};

/**
 * Altura do bloco mais alto de uma vaga: rosto (40) + vão + nome (16) + vão + uma etiqueta (20), que é o "VOCÊ" ou o
 * "Sem presença". Quem é os dois ao mesmo tempo é o único caso que passa disso, e só acontece fora do histórico.
 */
export const SLOT_BLOCK = { avatar: 40, gap: 6, name: 16, tag: 20 } as const;

export const SLOT_BLOCK_MAX =
  SLOT_BLOCK.avatar + 2 * SLOT_BLOCK.gap + SLOT_BLOCK.name + SLOT_BLOCK.tag;

/** Altura do campo: com "VOCÊ" embaixo do goleiro precisa de um pouco mais. */
export const PITCH_HEIGHT = 552;
export const PITCH_HEIGHT_ME = 584;

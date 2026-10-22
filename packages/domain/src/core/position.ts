/** Posições da formação 1-2-3-1 (fut7). */
export const POSITIONS = ['GOALKEEPER', 'DEFENDER', 'WINGER', 'MIDFIELDER', 'FORWARD'] as const;

export type Position = (typeof POSITIONS)[number];

export function isPosition(value: unknown): value is Position {
  return typeof value === 'string' && (POSITIONS as readonly string[]).includes(value);
}

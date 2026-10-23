/** Junta classes ignorando as vazias: cn('a', cond && 'b'). */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
